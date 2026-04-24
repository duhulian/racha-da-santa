-- =============================================
-- RACHA DA SANTA v9 - MIGRACAO NAO DESTRUTIVA
-- Execute no Supabase SQL Editor (seguro, nao apaga nada)
-- =============================================

-- Adiciona stats FIFA na tabela players (valores default 70 para quem ja existe)
alter table players add column if not exists overall integer default 70 check (overall >= 40 and overall <= 99);
alter table players add column if not exists pace integer default 70 check (pace >= 40 and pace <= 99);
alter table players add column if not exists shooting integer default 70 check (shooting >= 40 and shooting <= 99);
alter table players add column if not exists passing integer default 70 check (passing >= 40 and passing <= 99);
alter table players add column if not exists dribbling integer default 70 check (dribbling >= 40 and dribbling <= 99);
alter table players add column if not exists defending integer default 70 check (defending >= 40 and defending <= 99);
alter table players add column if not exists physical integer default 70 check (physical >= 40 and physical <= 99);
alter table players add column if not exists nationality text default 'BR';

-- Adiciona MOTM e rating na match_stats
alter table match_stats add column if not exists motm boolean default false;
alter table match_stats add column if not exists rating numeric(3,1);

-- Adiciona nome e local na matches (para o Next Match)
alter table matches add column if not exists name text;
alter table matches add column if not exists location text default 'Arena Santa';
alter table matches add column if not exists match_time time default '20:00';

-- Dica: apos rodar, use a pagina Admin > Jogadores para ajustar stats
-- de cada jogador. O default e 70 em tudo, o que gera sorteios equilibrados
-- ate voce definir valores individuais.
