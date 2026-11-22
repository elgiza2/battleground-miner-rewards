-- Indexes for foreign keys. Tables stay server-only on purpose (no client policies).
create index if not exists bg_owned_operators_op_idx on public.bg_owned_operators(operator_id);
create index if not exists bg_owned_servers_server_idx on public.bg_owned_servers(server_id);
create index if not exists bg_payments_player_idx on public.bg_payments(telegram_id);
create index if not exists bg_task_claims_task_idx on public.bg_task_claims(task_id);
create index if not exists bg_withdrawals_fee_idx on public.bg_withdrawals(fee_payment_id);
create index if not exists bg_withdrawals_player_idx on public.bg_withdrawals(telegram_id);