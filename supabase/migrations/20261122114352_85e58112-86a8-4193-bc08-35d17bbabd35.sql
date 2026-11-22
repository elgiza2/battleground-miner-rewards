alter table public.bg_players add column if not exists activated boolean not null default false;
alter table public.bg_payments drop constraint if exists bg_payments_purpose_check;

insert into public.bg_config(key, value) values
  ('free_mining', '{"per_day": 10}'::jsonb),
  ('daily_contest', '{"pool": 100000, "currency": "PUBG", "shares": [25,15,12,10,8,7,6,6,6,5]}'::jsonb)
on conflict (key) do update set value = excluded.value;

create or replace function public.bg_pending(_tid bigint, _cap_hours numeric default 8)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare p record; base numeric; mult numeric; op_boost int; free_rate numeric; free_secs numeric;
begin
  select * into p from bg_players where telegram_id = _tid;
  if p is null or not p.activated then return 0; end if;
  select coalesce(sum(s.daily_rate / 86400.0 * greatest(0, extract(epoch from (
            least(now(), o.expires_at, p.last_claim_at + make_interval(secs => _cap_hours * 3600))
            - greatest(p.last_claim_at, o.acquired_at))))), 0)
    into base
  from bg_owned_servers o join bg_servers s on s.id = o.server_id
  where o.telegram_id = _tid and o.expires_at > p.last_claim_at;
  select coalesce((value->>'per_day')::numeric, 0) into free_rate from bg_config where key = 'free_mining';
  free_secs := greatest(0, extract(epoch from (least(now(), p.last_claim_at + make_interval(secs => _cap_hours * 3600)) - p.last_claim_at)));
  base := base + coalesce(free_rate, 0) / 86400.0 * free_secs;
  select boost_pct into op_boost from bg_operators where id = p.operator_id;
  mult := (1 + coalesce(op_boost, 0) / 100.0) * (case when p.boost_until is not null and p.boost_until > now() then 2 else 1 end);
  return round(base * mult, 9);
end $$;

create table if not exists public.bg_contest_payouts (
  day date not null,
  rank integer not null,
  telegram_id bigint not null references public.bg_players(telegram_id),
  invites integer not null,
  prize numeric(20,9) not null,
  currency text not null default 'PUBG',
  created_at timestamptz not null default now(),
  primary key (day, rank)
);
create index if not exists bg_contest_payouts_tid_idx on public.bg_contest_payouts(telegram_id);
grant all on public.bg_contest_payouts to service_role;
alter table public.bg_contest_payouts enable row level security;
create index if not exists bg_players_referrer_created_idx on public.bg_players(referrer_id, created_at);

create or replace function public.bg_daily_ranks(_day date, _limit integer default 10)
returns table(rank bigint, telegram_id bigint, first_name text, username text, invites bigint)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by count(*) desc, max(p.created_at) asc) as rank,
         r.telegram_id, r.first_name, r.username, count(*)::bigint as invites
  from bg_players p join bg_players r on r.telegram_id = p.referrer_id
  where p.created_at >= _day::timestamptz and p.created_at < (_day + 1)::timestamptz
  group by r.telegram_id, r.first_name, r.username
  order by invites desc, max(p.created_at) asc
  limit _limit
$$;

create or replace function public.bg_settle_daily_contest(_day date)
returns integer language plpgsql security definer set search_path = public as $$
declare cfg jsonb; pool numeric; cur text; shares jsonb; r record; prize numeric; paid int := 0;
begin
  if exists (select 1 from bg_contest_payouts where day = _day) then return 0; end if;
  select value into cfg from bg_config where key = 'daily_contest';
  pool := coalesce((cfg->>'pool')::numeric, 0);
  cur := coalesce(cfg->>'currency', 'PUBG');
  shares := coalesce(cfg->'shares', '[25,15,12,10,8,7,6,6,6,5]'::jsonb);
  if pool <= 0 then return 0; end if;
  for r in select * from bg_daily_ranks(_day, 10) loop
    prize := round(pool * coalesce((shares->>(r.rank::int - 1))::numeric, 0) / 100.0, 9);
    if prize <= 0 then continue; end if;
    insert into bg_contest_payouts(day, rank, telegram_id, invites, prize, currency)
      values (_day, r.rank, r.telegram_id, r.invites, prize, cur);
    if cur = 'GRAM' then
      perform bg_credit_gram(r.telegram_id, prize, 'contest_prize', jsonb_build_object('day', _day, 'rank', r.rank));
    else
      perform bg_credit(r.telegram_id, prize, 'contest_prize', jsonb_build_object('day', _day, 'rank', r.rank));
    end if;
    paid := paid + 1;
  end loop;
  return paid;
end $$;

revoke all on function public.bg_daily_ranks(date, integer) from public, anon, authenticated;
revoke all on function public.bg_settle_daily_contest(date) from public, anon, authenticated;
grant execute on function public.bg_daily_ranks(date, integer) to service_role;
grant execute on function public.bg_settle_daily_contest(date) to service_role;