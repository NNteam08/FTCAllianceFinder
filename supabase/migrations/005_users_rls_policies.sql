-- RLS политики: пользователь может читать/обновлять свою запись
-- auth.uid() = id (users.id ссылается на auth.users.id)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Пользователь может читать свою запись
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Пользователь может создавать свою запись (при регистрации)
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Пользователь может обновлять свою запись (team_id, display_name)
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- user_team_searches: пользователь управляет своими записями
ALTER TABLE public.user_team_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_team_searches_select_own" ON public.user_team_searches;
CREATE POLICY "user_team_searches_select_own" ON public.user_team_searches FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_team_searches_insert_own" ON public.user_team_searches;
CREATE POLICY "user_team_searches_insert_own" ON public.user_team_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_team_searches_update_own" ON public.user_team_searches;
CREATE POLICY "user_team_searches_update_own" ON public.user_team_searches FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_team_searches_delete_own" ON public.user_team_searches;
CREATE POLICY "user_team_searches_delete_own" ON public.user_team_searches FOR DELETE USING (auth.uid() = user_id);
