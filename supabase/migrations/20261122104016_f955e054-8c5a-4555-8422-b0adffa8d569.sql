-- DROPZONE game schema. All objects are prefixed bg_ because this database is shared.

create table public.bg_players (
  telegram_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  language_code text,
  is_premium boolean not null default false,
  referrer_id bigint,
  referrer2_id bigint,
  balance numeric(20,9) not null default 0,
  total_mined numeric(20,9) not null default 0,
  total_ref_earned numeric(20,9) not null default 0,
  total_spent numeric(20,9) not null default 0,
  ads_total integer not null default 0,
  ads_today integer not null default 0,
  ads_day date,
  ad_last_at timestamptz,
  ref_count integer not null default 0,
  last_claim_at timestamptz not null default now(),
  boost_until timestamptz,
  operator_id text not null default 'rookie',
  wallet_address text,
  joined_channel boolean not null default false,
  streak integer not null default 0,
  last_checkin date,
  started_bot boolean not null default false,
  bot_blocked boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bg_players_referrer_idx on public.bg_players(referrer_id);
create index bg_players_created_idx on public.bg_players(created_at);

create table public.bg_servers (
  id integer primary key,
  slug text not null unique,
  tier integer not null,
  level integer not null,
  name text not null,
  image text not null,
  rarity text not null,
  price numeric(20,9) not null default 0,
  daily_rate numeric(20,9) not null,
  duration_days integer not null,
  unlock text not null check (unlock in ('gram','ads','referrals','trial')),
  unlock_goal integer not null default 0,
  sort integer not null default 0,
  active boolean not null default true
);

create table public.bg_owned_servers (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.bg_players(telegram_id) on delete cascade,
  server_id integer not null references public.bg_servers(id),
  source text not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index bg_owned_servers_player_idx on public.bg_owned_servers(telegram_id, expires_at);

create table public.bg_operators (
  id text primary key,
  name text not null,
  image text not null,
  rarity text not null,
  boost_pct integer not null,
  price numeric(20,9) not null default 0,
  unlock_ads integer not null default 0,
  sort integer not null default 0
);

create table public.bg_owned_operators (
  telegram_id bigint not null references public.bg_players(telegram_id) on delete cascade,
  operator_id text not null references public.bg_operators(id),
  acquired_at timestamptz not null default now(),
  primary key (telegram_id, operator_id)
);

create table public.bg_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null check (kind in ('ads_daily','ads_total','referrals','channel','link','checkin')),
  goal integer not null default 1,
  reward numeric(20,9) not null default 0,
  url text,
  chat_username text,
  icon text not null default 'target',
  repeat text not null default 'once' check (repeat in ('once','daily')),
  active boolean not null default true,
  sort integer not null default 100,
  created_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bg_task_claims (
  telegram_id bigint not null references public.bg_players(telegram_id) on delete cascade,
  task_id uuid not null references public.bg_tasks(id) on delete cascade,
  period text not null,
  claimed_at timestamptz not null default now(),
  primary key (telegram_id, task_id, period)
);

create table public.bg_ledger (
  id bigserial primary key,
  telegram_id bigint not null,
  amount numeric(20,9) not null,
  reason text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index bg_ledger_player_idx on public.bg_ledger(telegram_id, created_at desc);

create table public.bg_ad_daily (
  telegram_id bigint not null,
  day date not null,
  count integer not null default 0,
  primary key (telegram_id, day)
);
create index bg_ad_daily_day_idx on public.bg_ad_daily(day);

create table public.bg_payments (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.bg_players(telegram_id) on delete cascade,
  memo text not null unique,
  amount_nano bigint not null,
  purpose text not null check (purpose in ('server','operator','withdraw_fee','boost')),
  ref text,
  status text not null default 'pending' check (status in ('pending','confirmed','expired')),
  tx_hash text unique,
  sender text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 minutes'
);
create index bg_payments_status_idx on public.bg_payments(status, created_at desc);

create table public.bg_withdrawals (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.bg_players(telegram_id) on delete cascade,
  amount numeric(20,9) not null,
  wallet text not null,
  status text not null default 'awaiting_fee' check (status in ('awaiting_fee','pending','paid','rejected')),
  fee_payment_id uuid references public.bg_payments(id),
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by bigint
);
create index bg_withdrawals_status_idx on public.bg_withdrawals(status, created_at desc);

create table public.bg_gifts (
  id uuid primary key default gen_random_uuid(),
  amount numeric(20,9) not null,
  title text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table public.bg_gift_claims (
  gift_id uuid not null references public.bg_gifts(id) on delete cascade,
  telegram_id bigint not null,
  claimed_at timestamptz not null default now(),
  primary key (gift_id, telegram_id)
);

create table public.bg_posts (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique,
  text text,
  message_id bigint,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);

create table public.bg_admins (
  username text primary key,
  telegram_id bigint,
  role text not null check (role in ('owner','tasks')),
  added_by text,
  created_at timestamptz not null default now()
);

create table public.bg_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.bg_jobs (
  key text primary key,
  cursor bigint not null default 0,
  done boolean not null default false,
  sent integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Server-only access: the app talks to these tables through verified server code.
do $$
declare t text;
begin
  foreach t in array array['bg_players','bg_servers','bg_owned_servers','bg_operators','bg_owned_operators','bg_tasks','bg_task_claims','bg_ledger','bg_ad_daily','bg_payments','bg_withdrawals','bg_gifts','bg_gift_claims','bg_posts','bg_admins','bg_config','bg_jobs']
  loop
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
grant usage, select on sequence public.bg_ledger_id_seq to service_role;

create or replace function public.bg_touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger bg_players_touch before update on public.bg_players for each row execute function public.bg_touch_updated_at();
create trigger bg_tasks_touch before update on public.bg_tasks for each row execute function public.bg_touch_updated_at();

-- Credit/debit a balance and record it in the ledger.
create or replace function public.bg_credit(_tid bigint, _amount numeric, _reason text, _meta jsonb default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare nb numeric;
begin
  update bg_players set balance = balance + _amount where telegram_id = _tid returning balance into nb;
  if nb is null then raise exception 'player_not_found'; end if;
  if nb < 0 then raise exception 'insufficient_balance'; end if;
  insert into bg_ledger(telegram_id, amount, reason, meta) values (_tid, _amount, _reason, _meta);
  return nb;
end $$;

-- Mining: per-second accrual from active servers, capped by storage hours, times operator and ad boosts.
create or replace function public.bg_pending(_tid bigint, _cap_hours numeric default 8)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare p record; base numeric; mult numeric; op_boost int;
begin
  select * into p from bg_players where telegram_id = _tid;
  if p is null then return 0; end if;
  select coalesce(sum(s.daily_rate / 86400.0 * greatest(0, extract(epoch from (
            least(now(), o.expires_at, p.last_claim_at + make_interval(secs => _cap_hours * 3600))
            - greatest(p.last_claim_at, o.acquired_at))))), 0)
    into base
  from bg_owned_servers o join bg_servers s on s.id = o.server_id
  where o.telegram_id = _tid and o.expires_at > p.last_claim_at;
  select boost_pct into op_boost from bg_operators where id = p.operator_id;
  mult := (1 + coalesce(op_boost, 0) / 100.0) * (case when p.boost_until is not null and p.boost_until > now() then 2 else 1 end);
  return round(base * mult, 9);
end $$;

create or replace function public.bg_claim(_tid bigint, _bonus numeric default 1)
returns numeric language plpgsql security definer set search_path = public as $$
declare amt numeric; p record;
begin
  select * into p from bg_players where telegram_id = _tid for update;
  if p is null then raise exception 'player_not_found'; end if;
  amt := round(bg_pending(_tid) * greatest(1, least(_bonus, 2)), 9);
  update bg_players set last_claim_at = now(), total_mined = total_mined + amt where telegram_id = _tid;
  if amt > 0 then
    perform bg_credit(_tid, amt, 'mining');
    if p.referrer_id is not null then
      perform bg_credit(p.referrer_id, round(amt * 0.20, 9), 'squad_l1', jsonb_build_object('from', _tid));
      update bg_players set total_ref_earned = total_ref_earned + round(amt * 0.20, 9) where telegram_id = p.referrer_id;
    end if;
    if p.referrer2_id is not null then
      perform bg_credit(p.referrer2_id, round(amt * 0.05, 9), 'squad_l2', jsonb_build_object('from', _tid));
      update bg_players set total_ref_earned = total_ref_earned + round(amt * 0.05, 9) where telegram_id = p.referrer2_id;
    end if;
  end if;
  return amt;
end $$;

-- Record one completed rewarded video. Enforces spacing and a daily cap.
create or replace function public.bg_record_ad(_tid bigint, _reward numeric, _boost_minutes int, _min_gap_seconds int, _daily_cap int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record; today date := (now() at time zone 'utc')::date; cnt int;
begin
  select * into p from bg_players where telegram_id = _tid for update;
  if p is null then raise exception 'player_not_found'; end if;
  if p.ad_last_at is not null and p.ad_last_at > now() - make_interval(secs => _min_gap_seconds) then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  cnt := case when p.ads_day = today then p.ads_today else 0 end;
  if cnt >= _daily_cap then return jsonb_build_object('ok', false, 'error', 'daily_cap'); end if;
  update bg_players set
    ads_today = cnt + 1, ads_day = today, ads_total = ads_total + 1, ad_last_at = now(),
    boost_until = least(greatest(coalesce(boost_until, now()), now()) + make_interval(mins => _boost_minutes), now() + interval '6 hours')
  where telegram_id = _tid;
  insert into bg_ad_daily(telegram_id, day, count) values (_tid, today, 1)
    on conflict (telegram_id, day) do update set count = bg_ad_daily.count + 1;
  if _reward > 0 then perform bg_credit(_tid, _reward, 'ad'); end if;
  return jsonb_build_object('ok', true, 'ads_today', cnt + 1, 'ads_total', p.ads_total + 1);
end $$;

revoke all on function public.bg_credit(bigint, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.bg_pending(bigint, numeric) from public, anon, authenticated;
revoke all on function public.bg_claim(bigint, numeric) from public, anon, authenticated;
revoke all on function public.bg_record_ad(bigint, numeric, int, int, int) from public, anon, authenticated;
grant execute on function public.bg_credit(bigint, numeric, text, jsonb) to service_role;
grant execute on function public.bg_pending(bigint, numeric) to service_role;
grant execute on function public.bg_claim(bigint, numeric) to service_role;
grant execute on function public.bg_record_ad(bigint, numeric, int, int, int) to service_role;

-- ===== Seed: 90 servers =====
-- 88 paid (tiers 1-8 x 9 levels, tiers 9-10 x 8 levels), 1 free via 300 videos, 1 free via 50 invites, plus a hidden 24h trial.
with tiers(tier, name, base, roi, rarity) as (values
  (1,'Field Radio',0.10,1.20,'Common'),
  (2,'Ammo Rig',0.25,1.22,'Common'),
  (3,'Supply Drop',0.50,1.25,'Uncommon'),
  (4,'Jeep Rig',1.00,1.28,'Uncommon'),
  (5,'Bunker Node',2.00,1.30,'Rare'),
  (6,'Radar Tower',4.00,1.33,'Rare'),
  (7,'Gunship',8.00,1.36,'Epic'),
  (8,'Cargo Hauler',15.00,1.40,'Epic'),
  (9,'Command Fortress',30.00,1.45,'Legendary'),
  (10,'Golden Airdrop',60.00,1.50,'Mythic')
), lv as (
  select t.*, l as level from tiers t cross join generate_series(1,9) l
  where not (t.tier >= 9 and l = 9)
)
insert into public.bg_servers(id, slug, tier, level, name, image, rarity, price, daily_rate, duration_days, unlock, unlock_goal, sort)
select (tier * 10 + level), 't' || tier || '-' || level, tier, level,
  name || ' Mk ' || (array['I','II','III','IV','V','VI','VII','VIII','IX'])[level],
  'server-t' || tier, rarity,
  round(base * (1 + (level - 1) * 0.35), 2),
  round(round(base * (1 + (level - 1) * 0.35), 2) * roi / 30.0, 9),
  30, 'gram', 0, tier * 10 + level
from lv;

insert into public.bg_servers(id, slug, tier, level, name, image, rarity, price, daily_rate, duration_days, unlock, unlock_goal, sort) values
  (1, 'free-ads', 0, 1, 'Ad Hunter Crate', 'server-ads', 'Free', 0, 0.004, 30, 'ads', 300, 1),
  (2, 'free-squad', 0, 1, 'Squad Beacon', 'server-squad', 'Free', 0, 0.03, 60, 'referrals', 50, 2),
  (3, 'trial', 0, 0, 'Recruit Radio', 'server-t1', 'Trial', 0, 0.003, 1, 'trial', 0, 0);

insert into public.bg_operators(id, name, image, rarity, boost_pct, price, unlock_ads, sort) values
  ('rookie','Rookie','op-rookie','Common',0,0,0,1),
  ('scout','Scout','op-scout','Uncommon',5,0,150,2),
  ('medic','Medic','op-medic','Rare',10,0.5,0,3),
  ('sniper','Sniper','op-sniper','Epic',20,1.5,0,4),
  ('commander','Commander','op-commander','Legendary',35,4,0,5),
  ('legend','Legend','op-legend','Mythic',60,10,0,6);

insert into public.bg_tasks(title, description, kind, goal, reward, icon, repeat, sort) values
  ('Daily check-in','Report for duty every day','checkin',1,0.0005,'calendar','daily',1),
  ('Warm up','Watch 10 videos today','ads_daily',10,0.0005,'play','daily',10),
  ('Rookie grind','Watch 25 videos today','ads_daily',25,0.001,'play','daily',11),
  ('Patrol','Watch 50 videos today','ads_daily',50,0.002,'play','daily',12),
  ('Centurion','Watch 100 videos today','ads_daily',100,0.004,'play','daily',13),
  ('Hot zone','Watch 200 videos today','ads_daily',200,0.008,'flame','daily',14),
  ('Blitz','Watch 300 videos today','ads_daily',300,0.012,'flame','daily',15),
  ('Siege','Watch 500 videos today','ads_daily',500,0.02,'flame','daily',16),
  ('Marathon','Watch 750 videos today','ads_daily',750,0.03,'trophy','daily',17),
  ('Chicken dinner','Watch 1000 videos today','ads_daily',1000,0.06,'crown','daily',18),
  ('First blood','Watch 100 videos in total','ads_total',100,0.003,'star','once',30),
  ('Veteran','Watch 1000 videos in total','ads_total',1000,0.02,'star','once',31),
  ('Elite','Watch 5000 videos in total','ads_total',5000,0.08,'star','once',32),
  ('Warlord','Watch 20000 videos in total','ads_total',20000,0.3,'crown','once',33),
  ('Recruit a buddy','Invite 1 friend','referrals',1,0.005,'users','once',50),
  ('Fire team','Invite 3 friends','referrals',3,0.012,'users','once',51),
  ('Squad up','Invite 5 friends','referrals',5,0.025,'users','once',52),
  ('Platoon','Invite 10 friends','referrals',10,0.06,'users','once',53),
  ('Company','Invite 25 friends','referrals',25,0.15,'users','once',54),
  ('Battalion','Invite 100 friends','referrals',100,0.7,'crown','once',55),
  ('Regiment','Invite 250 friends','referrals',250,2,'crown','once',56),
  ('Army','Invite 500 friends','referrals',500,4.5,'crown','once',57),
  ('Swap on STON.fi','Open the GRAM market','link',1,0.001,'link','once',70);
update public.bg_tasks set url = 'https://app.ston.fi/swap?chartVisible=false&ft=GRAM&tt=EQBmR1S2TdeCDMl956IxzoZ7IPx4f-D2s6Fj2seoUxRy1dbG' where kind = 'link';

insert into public.bg_admins(username, role, added_by) values ('eigiza','owner','seed'), ('torker','owner','seed');

insert into public.bg_config(key, value) values
  ('community', '{"username": null}'::jsonb),
  ('bot', '{"username": null}'::jsonb);