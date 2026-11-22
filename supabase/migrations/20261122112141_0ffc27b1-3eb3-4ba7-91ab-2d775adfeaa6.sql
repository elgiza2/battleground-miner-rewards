-- DROPZONE: players mine $PUBG; GRAM (TON) becomes a second balance filled by swapping.
alter table public.bg_players add column if not exists gram_balance numeric(20,9) not null default 0;
alter table public.bg_players add column if not exists total_swapped numeric(20,9) not null default 0;
alter table public.bg_ledger add column if not exists currency text not null default 'PUBG';
alter table public.bg_withdrawals add column if not exists currency text not null default 'PUBG';
alter table public.bg_withdrawals drop constraint if exists bg_withdrawals_currency_check;
alter table public.bg_withdrawals add constraint bg_withdrawals_currency_check check (currency in ('PUBG','GRAM'));

create or replace function public.bg_credit_gram(_tid bigint, _amount numeric, _reason text, _meta jsonb default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare nb numeric;
begin
  update bg_players set gram_balance = gram_balance + _amount where telegram_id = _tid returning gram_balance into nb;
  if nb is null then raise exception 'player_not_found'; end if;
  if nb < 0 then raise exception 'insufficient_balance'; end if;
  insert into bg_ledger(telegram_id, amount, reason, meta, currency) values (_tid, _amount, _reason, _meta, 'GRAM');
  return nb;
end $$;

create or replace function public.bg_swap(_tid bigint, _pubg numeric, _gram numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if _pubg <= 0 or _gram <= 0 then raise exception 'invalid_amount'; end if;
  perform bg_credit(_tid, -_pubg, 'swap_out', jsonb_build_object('gram', _gram));
  perform bg_credit_gram(_tid, _gram, 'swap_in', jsonb_build_object('pubg', _pubg));
  update bg_players set total_swapped = total_swapped + _pubg where telegram_id = _tid;
  return (select jsonb_build_object('pubg', balance, 'gram', gram_balance) from bg_players where telegram_id = _tid);
end $$;

revoke all on function public.bg_credit_gram(bigint, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.bg_swap(bigint, numeric, numeric) from public, anon, authenticated;
grant execute on function public.bg_credit_gram(bigint, numeric, text, jsonb) to service_role;
grant execute on function public.bg_swap(bigint, numeric, numeric) to service_role;

-- Rescale mining output from GRAM to PUBG (≈11,000 PUBG per GRAM at launch).
update public.bg_servers set daily_rate = round(daily_rate * 11000, 4) where daily_rate < 100;
update public.bg_players set balance = balance * 11000, total_mined = total_mined * 11000, total_ref_earned = total_ref_earned * 11000 where balance < 1000;
update public.bg_ledger set amount = amount * 11000 where currency = 'PUBG' and abs(amount) < 100;

update public.bg_tasks set reward = case
  when kind = 'checkin' then 5
  when kind = 'link' then 10
  when kind = 'ads_daily' and goal = 10 then 5
  when kind = 'ads_daily' and goal = 25 then 12
  when kind = 'ads_daily' and goal = 50 then 25
  when kind = 'ads_daily' and goal = 100 then 50
  when kind = 'ads_daily' and goal = 200 then 100
  when kind = 'ads_daily' and goal = 300 then 150
  when kind = 'ads_daily' and goal = 500 then 250
  when kind = 'ads_daily' and goal = 750 then 400
  when kind = 'ads_daily' and goal = 1000 then 800
  when kind = 'ads_total' and goal = 100 then 30
  when kind = 'ads_total' and goal = 1000 then 250
  when kind = 'ads_total' and goal = 5000 then 1000
  when kind = 'ads_total' and goal = 20000 then 4000
  when kind = 'referrals' and goal = 1 then 60
  when kind = 'referrals' and goal = 3 then 150
  when kind = 'referrals' and goal = 5 then 300
  when kind = 'referrals' and goal = 10 then 700
  when kind = 'referrals' and goal = 25 then 2000
  when kind = 'referrals' and goal = 100 then 9000
  when kind = 'referrals' and goal = 250 then 25000
  when kind = 'referrals' and goal = 500 then 55000
  else reward end
where reward < 100;
update public.bg_tasks set title = 'Trade PUBG on STON.fi', description = 'Open the PUBG market' where kind = 'link';

insert into public.bg_config(key, value) values ('market', '{"pubg_per_gram": 11000, "swap_fee": 0.05}'::jsonb)
on conflict (key) do nothing;