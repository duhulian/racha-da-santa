-- =============================================
-- RACHA DA SANTA v11 - CORRECOES DE SEGURANCA
-- Aplicado no projeto wourrnmhsnqynrfvkqay em 15/09/2026.
-- Este arquivo existe para o repositorio refletir o que ja esta no banco.
-- Rodar de novo e inofensivo.
-- =============================================

-- =============================================
-- 1. PERMISSOES DO BUCKET DE FOTOS
--
-- Como estava: as policies "Admin faz upload", "Admin atualiza foto" e
-- "Admin deleta foto" verificavam apenas bucket_id = 'avatars'. Apesar do nome,
-- nao checavam papel nenhum, entao qualquer conta autenticada podia sobrescrever
-- ou apagar a foto de qualquer jogador.
--
-- Os nomes antigos sao removidos no mesmo passo: policies permissivas se somam
-- por OR, entao criar a versao restrita sem apagar a permissiva deixaria a regra
-- fraca valendo.
--
-- public.players e qualificado de proposito: a API de storage nao roda com o
-- mesmo search_path do PostgREST.
-- =============================================
drop policy if exists "Fotos publicas" on storage.objects;
drop policy if exists "Admin faz upload" on storage.objects;
drop policy if exists "Admin atualiza foto" on storage.objects;
drop policy if exists "Admin deleta foto" on storage.objects;

drop policy if exists "Leitura publica avatars" on storage.objects;
create policy "Leitura publica avatars"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Admin sobe avatars" on storage.objects;
create policy "Admin sobe avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and exists (select 1 from public.players where user_id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admin atualiza avatars" on storage.objects;
create policy "Admin atualiza avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and exists (select 1 from public.players where user_id = auth.uid() and role = 'admin')
  );

drop policy if exists "Admin deleta avatars" on storage.objects;
create policy "Admin deleta avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and exists (select 1 from public.players where user_id = auth.uid() and role = 'admin')
  );

-- =============================================
-- 2. SEARCH_PATH FIXO NAS FUNCOES
--
-- Sem isso o schema resolvido depende do search_path de quem chama, e um objeto
-- de mesmo nome em outro schema pode ser alcancado primeiro. Nao altera o corpo
-- nem o comportamento das funcoes.
-- =============================================
alter function public.mark_overdue_payments() set search_path = public, pg_temp;
alter function public.update_updated_at() set search_path = public, pg_temp;

-- =============================================
-- 3. EXECUTE PUBLICO EM rls_auto_enable
--
-- rls_auto_enable retorna event_trigger e nao pode ser chamada por RPC: o
-- Postgres recusa com "trigger functions can only be called as triggers",
-- verificado neste banco em 15/09/2026. O grant para anon e authenticated
-- portanto nao dava poder nenhum, e tambem nao servia para nada, porque event
-- trigger e disparado pelo mecanismo do Postgres e nao depende desse grant.
-- Revogado para encerrar o alerta do linter. O event trigger continua ativo.
-- =============================================
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.rls_auto_enable() from public;

-- =============================================
-- PENDENTE, NAO DA PARA FAZER POR SQL
--
-- A protecao contra senha vazada (HaveIBeenPwned) esta desligada no Supabase
-- Auth. Habilitar em Authentication > Policies no painel do Supabase.
-- =============================================
