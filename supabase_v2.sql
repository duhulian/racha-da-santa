-- =============================================
-- RACHA DA SANTA v2 - MIGRAÇÃO COMPLETA
-- Apaga tudo e recria com nova estrutura
-- Execute no Supabase SQL Editor
-- =============================================

-- LIMPAR TUDO (ordem importa por causa das dependencias)
drop table if exists match_stats cascade;
drop table if exists team_players cascade;
drop table if exists teams cascade;
drop table if exists confirmations cascade;
drop table if exists matches cascade;
drop table if exists players cascade;

-- =============================================
-- 1. JOGADORES (mensalistas e avulsos)
-- =============================================
create table players (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  nickname text,
  role text not null default 'player' check (role in ('player', 'admin')),
  player_type text not null default 'mensalista' check (player_type in ('mensalista', 'avulso')),
  position text check (position in ('goleiro', 'zagueiro', 'meia', 'atacante')),
  shirt_number integer,
  photo_url text,
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- =============================================
-- 2. RACHAS (com token para link de confirmacao)
-- =============================================
create table matches (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  status text not null default 'open' check (status in ('open', 'sorted', 'finished')),
  token text not null default encode(gen_random_bytes(6), 'hex'),
  notes text,
  created_by uuid references players(id),
  created_at timestamp with time zone default now()
);

-- =============================================
-- 3. CONFIRMAÇÕES (sem necessidade de login)
-- =============================================
create table confirmations (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'declined')),
  confirmed_at timestamp with time zone default now(),
  unique(match_id, player_id)
);

-- =============================================
-- 4. TIMES SORTEADOS
-- =============================================
create table teams (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade,
  name text not null,
  won boolean default false
);

-- =============================================
-- 5. JOGADORES POR TIME
-- =============================================
create table team_players (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  unique(team_id, player_id)
);

-- =============================================
-- 6. ESTATÍSTICAS POR JOGADOR POR RACHA
-- =============================================
create table match_stats (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  goals integer default 0,
  assists integer default 0,
  present boolean default true,
  unique(match_id, player_id)
);

-- =============================================
-- ÍNDICES
-- =============================================
create index idx_matches_date on matches(date desc);
create index idx_matches_status on matches(status);
create index idx_matches_token on matches(token);
create index idx_confirmations_match on confirmations(match_id);
create index idx_confirmations_player on confirmations(player_id);
create index idx_match_stats_match on match_stats(match_id);
create index idx_match_stats_player on match_stats(player_id);
create index idx_teams_match on teams(match_id);
create index idx_team_players_team on team_players(team_id);
create index idx_players_user_id on players(user_id);
create index idx_players_type on players(player_type);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

alter table players enable row level security;
alter table matches enable row level security;
alter table confirmations enable row level security;
alter table teams enable row level security;
alter table team_players enable row level security;
alter table match_stats enable row level security;

-- PLAYERS
create policy "Leitura publica jogadores" on players for select to anon, authenticated using (true);
create policy "Admin insere jogadores" on players for insert to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin') or not exists (select 1 from players));
create policy "Avulso se cadastra" on players for insert to anon
  with check (player_type = 'avulso' and role = 'player');
create policy "Admin atualiza jogadores" on players for update to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin') or user_id = auth.uid());
create policy "Admin deleta jogadores" on players for delete to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- MATCHES
create policy "Leitura publica rachas" on matches for select to anon, authenticated using (true);
create policy "Admin cria rachas" on matches for insert to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin atualiza rachas" on matches for update to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin deleta rachas" on matches for delete to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- CONFIRMATIONS
create policy "Leitura publica confirmacoes" on confirmations for select to anon, authenticated using (true);
create policy "Qualquer um confirma presenca" on confirmations for insert to anon, authenticated with check (true);
create policy "Qualquer um remove confirmacao" on confirmations for delete to anon, authenticated using (true);
create policy "Qualquer um atualiza confirmacao" on confirmations for update to anon, authenticated using (true);

-- TEAMS
create policy "Leitura publica times" on teams for select to anon, authenticated using (true);
create policy "Admin cria times" on teams for insert to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin atualiza times" on teams for update to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin deleta times" on teams for delete to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- TEAM_PLAYERS
create policy "Leitura publica jogadores do time" on team_players for select to anon, authenticated using (true);
create policy "Admin insere jogadores no time" on team_players for insert to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin deleta jogadores do time" on team_players for delete to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- MATCH_STATS
create policy "Leitura publica estatisticas" on match_stats for select to anon, authenticated using (true);
create policy "Admin insere estatisticas" on match_stats for insert to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin atualiza estatisticas" on match_stats for update to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin deleta estatisticas" on match_stats for delete to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

-- =============================================
-- TABELAS ADICIONAIS (v7) - sistema de jogos de 7 min
-- =============================================

create table if not exists games (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade,
  game_number integer not null,
  team_a_id uuid references teams(id) on delete cascade,
  team_b_id uuid references teams(id) on delete cascade,
  score_a integer default 0,
  score_b integer default 0,
  winner_team_id uuid references teams(id),
  status text not null default 'in_progress' check (status in ('in_progress', 'finished')),
  created_at timestamp with time zone default now()
);

create table if not exists game_goals (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references games(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  scorer_id uuid references players(id) on delete cascade,
  assist_id uuid references players(id) on delete set null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_games_match on games(match_id);
create index if not exists idx_game_goals_game on game_goals(game_id);

alter table games enable row level security;
alter table game_goals enable row level security;

create policy "Leitura publica games" on games for select to anon, authenticated using (true);
create policy "Admin insere games" on games for insert to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin atualiza games" on games for update to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin deleta games" on games for delete to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));

create policy "Leitura publica game_goals" on game_goals for select to anon, authenticated using (true);
create policy "Admin insere game_goals" on game_goals for insert to authenticated
  with check (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin atualiza game_goals" on game_goals for update to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
create policy "Admin deleta game_goals" on game_goals for delete to authenticated
  using (exists (select 1 from players where user_id = auth.uid() and role = 'admin'));
