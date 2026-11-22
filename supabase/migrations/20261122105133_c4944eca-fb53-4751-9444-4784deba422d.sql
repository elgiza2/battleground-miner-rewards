-- Keep paid boosts when ads extend the boost; ad boosts alone cap at 6h ahead.
create or replace function public.bg_record_ad(_tid bigint, _reward numeric, _boost_minutes int, _min_gap_seconds int, _daily_cap int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record; today date := (now() at time zone 'utc')::date; cnt int; cur timestamptz;
begin
  select * into p from bg_players where telegram_id = _tid for update;
  if p is null then raise exception 'player_not_found'; end if;
  if p.ad_last_at is not null and p.ad_last_at > now() - make_interval(secs => _min_gap_seconds) then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  cnt := case when p.ads_day = today then p.ads_today else 0 end;
  if cnt >= _daily_cap then return jsonb_build_object('ok', false, 'error', 'daily_cap'); end if;
  cur := greatest(coalesce(p.boost_until, now()), now());
  update bg_players set
    ads_today = cnt + 1, ads_day = today, ads_total = ads_total + 1, ad_last_at = now(),
    boost_until = greatest(cur, least(cur + make_interval(mins => _boost_minutes), now() + interval '6 hours'))
  where telegram_id = _tid;
  insert into bg_ad_daily(telegram_id, day, count) values (_tid, today, 1)
    on conflict (telegram_id, day) do update set count = bg_ad_daily.count + 1;
  if _reward > 0 then perform bg_credit(_tid, _reward, 'ad'); end if;
  return jsonb_build_object('ok', true, 'ads_today', cnt + 1, 'ads_total', p.ads_total + 1);
end $$;

create or replace function public.bg_top_inviters(_since timestamptz, _limit int default 20)
returns table(telegram_id bigint, first_name text, username text, invites bigint)
language sql stable security definer set search_path = public as $$
  select r.telegram_id, r.first_name, r.username, count(*)::bigint as invites
  from bg_players p join bg_players r on r.telegram_id = p.referrer_id
  where p.created_at >= _since
  group by r.telegram_id, r.first_name, r.username
  order by invites desc
  limit _limit
$$;

create or replace function public.bg_admin_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'players', (select count(*) from bg_players),
    'new_today', (select count(*) from bg_players where created_at >= date_trunc('day', now())),
    'active_today', (select count(*) from bg_players where last_seen_at >= date_trunc('day', now())),
    'bot_users', (select count(*) from bg_players where started_bot and not bot_blocked),
    'ads_today', (select coalesce(sum(count), 0) from bg_ad_daily where day = (now() at time zone 'utc')::date),
    'ads_total', (select coalesce(sum(ads_total), 0) from bg_players),
    'revenue_today', (select coalesce(sum(amount_nano), 0) / 1e9 from bg_payments where status = 'confirmed' and confirmed_at >= date_trunc('day', now())),
    'revenue_total', (select coalesce(sum(amount_nano), 0) / 1e9 from bg_payments where status = 'confirmed'),
    'payers_today', (select count(distinct telegram_id) from bg_payments where status = 'confirmed' and confirmed_at >= date_trunc('day', now())),
    'balances_total', (select coalesce(sum(balance), 0) from bg_players),
    'withdraw_pending', (select count(*) from bg_withdrawals where status = 'pending'),
    'withdraw_pending_amount', (select coalesce(sum(amount), 0) from bg_withdrawals where status = 'pending'),
    'withdrawn_total', (select coalesce(sum(amount), 0) from bg_withdrawals where status = 'paid'),
    'servers_active', (select count(*) from bg_owned_servers where expires_at > now() and source <> 'trial')
  )
$$;

revoke all on function public.bg_top_inviters(timestamptz, int) from public, anon, authenticated;
revoke all on function public.bg_admin_stats() from public, anon, authenticated;
grant execute on function public.bg_top_inviters(timestamptz, int) to service_role;
grant execute on function public.bg_admin_stats() to service_role;
revoke all on function public.bg_record_ad(bigint, numeric, int, int, int) from public, anon, authenticated;
grant execute on function public.bg_record_ad(bigint, numeric, int, int, int) to service_role;