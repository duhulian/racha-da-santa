-- =============================================
-- RACHA DA SANTA v10 - MIGRACAO NAO DESTRUTIVA
-- Execute no Supabase SQL Editor (seguro, nao apaga nada)
--
-- Esta migracao adiciona:
-- 1. Sistema de mensalidades (Treasury)
-- 2. Estado ao vivo do matchday (fila de times, cronometro)
-- 3. Tactical notes por racha
-- 4. Guest pool (role de convidado)
-- 5. Campos extras para Live Match Control
-- =============================================

-- ============ 1. MENSALIDADE POR JOGADOR ============
-- Valor individual de mensalidade (default R$ 50)
alter table players add column if not exists monthly_fee numeric(10,2) default 50.00;

-- Campo de observacao livre pra guest
alter table players add column if not exists guest_notes text;

-- Extende role existente para aceitar 'guest' (convidado)
-- Primeiro removemos o check antigo, depois criamos novo
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'players' and constraint_name = 'players_role_check'
  ) then
    alter table players drop constraint players_role_check;
  end if;
end $$;

alter table players add constraint players_role_check
  check (role in ('player', 'admin', 'guest'));

-- ============ 2. TABELA DE PAGAMENTOS (TREASURY) ============
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  player_id uuid not null references players(id) on delete cascade,
  amount numeric(10,2) not null,
  reference_month text not null,
  due_date date not null,
  paid_date date,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'overdue', 'waived')),
  payment_method text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(player_id, reference_month)
);

create index if not exists idx_payments_player on payments(player_id);
create index if not exists idx_payments_status on payments(status);
create index if not exists idx_payments_due on payments(due_date desc);
create index if not exists idx_payments_month on payments(reference_month);

alter table payments enable row level security;

create policy "Leitura publica pagamentos" on payments for select
  to anon, authenticated using (true);
create policy "Admin insere pagamentos" on payments for insert
  to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin atualiza pagamentos" on payments for update
  to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin deleta pagamentos" on payments for delete
  to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- ============ 3. TAXA DA QUADRA (PITCH FEE) ============
create table if not exists pitch_fees (
  id uuid default gen_random_uuid() primary key,
  due_date date not null,
  total_amount numeric(10,2) not null,
  per_player_amount numeric(10,2),
  description text,
  paid boolean default false,
  paid_date date,
  created_at timestamp with time zone default now()
);

create index if not exists idx_pitch_fees_due on pitch_fees(due_date desc);

alter table pitch_fees enable row level security;

create policy "Leitura publica pitch_fees" on pitch_fees for select
  to anon, authenticated using (true);
create policy "Admin gerencia pitch_fees" on pitch_fees for all
  to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- ============ 4. ESTADO AO VIVO DO MATCHDAY ============
create table if not exists match_live_state (
  match_id uuid primary key references matches(id) on delete cascade,
  current_game_id uuid references games(id) on delete set null,
  team_queue jsonb default '[]',
  game_started_at timestamp with time zone,
  game_paused_at timestamp with time zone,
  live_notes text,
  updated_at timestamp with time zone default now()
);

alter table match_live_state enable row level security;

create policy "Leitura publica match_live_state" on match_live_state for select
  to anon, authenticated using (true);
create policy "Admin gerencia match_live_state" on match_live_state for all
  to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- ============ 5. TACTICAL NOTES NOS RACHAS ============
alter table matches add column if not exists tactical_notes text;

-- ============ 6. MELHORIAS EM GAMES ============
alter table games add column if not exists started_at timestamp with time zone;
alter table games add column if not exists finished_at timestamp with time zone;
alter table games add column if not exists duration_seconds integer;

alter table game_goals add column if not exists minute integer;

-- ============ 7. FUNCAO UTILITARIA: UPDATE STATUS DE PAGAMENTO ============
create or replace function mark_overdue_payments()
returns void as $$
begin
  update payments
  set status = 'overdue', updated_at = now()
  where status = 'pending'
    and due_date < current_date;
end;
$$ language plpgsql;

-- ============ 8. TRIGGER: UPDATED_AT AUTOMATICO ============
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at
  before update on payments
  for each row execute function update_updated_at();

drop trigger if exists match_live_state_updated_at on match_live_state;
create trigger match_live_state_updated_at
  before update on match_live_state
  for each row execute function update_updated_at();

-- ============ 9. MIGRAR DADOS EXISTENTES (opcional) ============
update players set monthly_fee = 50.00
where monthly_fee is null and player_type = 'mensalista';

-- =============================================
-- PRONTO! Schema v10 aplicado.
-- =============================================
