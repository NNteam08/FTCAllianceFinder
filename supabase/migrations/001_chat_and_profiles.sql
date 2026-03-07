-- ============================================================
-- Миграция: Чат между командами + профили команд
-- ============================================================

-- 1. Добавляем поля профиля в таблицу teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';

-- 2. Создаём таблицу чатов (переписка между командами)
CREATE TABLE IF NOT EXISTS team_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_a_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (team_a_id < team_b_id), -- Гарантируем уникальность пары
  UNIQUE(team_a_id, team_b_id)
);
CREATE INDEX IF NOT EXISTS idx_team_chats_team_a ON team_chats(team_a_id);
CREATE INDEX IF NOT EXISTS idx_team_chats_team_b ON team_chats(team_b_id);
CREATE INDEX IF NOT EXISTS idx_team_chats_last_message ON team_chats(last_message_at DESC);

-- 3. Создаём тип сообщения
DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'file');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Создаём таблицу сообщений
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES team_chats(id) ON DELETE CASCADE,
  sender_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type message_type DEFAULT 'text',
  content TEXT, -- Текст сообщения
  file_url TEXT, -- URL файла в Storage
  file_name TEXT, -- Оригинальное имя файла
  file_size INTEGER, -- Размер в байтах
  file_mime_type TEXT, -- MIME тип
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_team_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(chat_id, is_read) WHERE is_read = false;

-- 5. Функция для получения или создания чата между командами
CREATE OR REPLACE FUNCTION get_or_create_chat(team1_id UUID, team2_id UUID)
RETURNS UUID AS $$
DECLARE
  chat_uuid UUID;
  a_id UUID;
  b_id UUID;
BEGIN
  -- Упорядочиваем ID для соблюдения constraint
  IF team1_id < team2_id THEN
    a_id := team1_id;
    b_id := team2_id;
  ELSE
    a_id := team2_id;
    b_id := team1_id;
  END IF;
  
  -- Ищем существующий чат
  SELECT id INTO chat_uuid FROM team_chats WHERE team_a_id = a_id AND team_b_id = b_id;
  
  -- Если не найден — создаём
  IF chat_uuid IS NULL THEN
    INSERT INTO team_chats (team_a_id, team_b_id)
    VALUES (a_id, b_id)
    RETURNING id INTO chat_uuid;
  END IF;
  
  RETURN chat_uuid;
END;
$$ LANGUAGE plpgsql;

-- 6. Триггер для обновления last_message_at в чате
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_chats SET last_message_at = NEW.created_at, updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_last_message ON chat_messages;
CREATE TRIGGER trigger_update_chat_last_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_last_message();

-- 7. Триггер updated_at для chat_messages
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Триггер updated_at для team_chats
DROP TRIGGER IF EXISTS update_team_chats_updated_at ON team_chats;
CREATE TRIGGER update_team_chats_updated_at
  BEFORE UPDATE ON team_chats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Представление: есть ли у команды зарегистрированный представитель
CREATE OR REPLACE VIEW teams_with_registration AS
SELECT 
  t.*,
  CASE WHEN EXISTS (SELECT 1 FROM users u WHERE u.team_id = t.id) THEN true ELSE false END AS has_registered_user,
  (SELECT COUNT(*) FROM users u WHERE u.team_id = t.id) AS registered_users_count
FROM teams t;

-- 10. Создание Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('team-avatars', 'team-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('chat-files', 'chat-files', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 11. Политики доступа к Storage
-- Политика для team-avatars: все могут читать, авторизованные могут загружать
CREATE POLICY "team-avatars: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'team-avatars');

CREATE POLICY "team-avatars: authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'team-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "team-avatars: authenticated update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'team-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "team-avatars: authenticated delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'team-avatars' AND auth.role() = 'authenticated');

-- Политика для chat-files: авторизованные могут всё
CREATE POLICY "chat-files: authenticated read" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

CREATE POLICY "chat-files: authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

CREATE POLICY "chat-files: authenticated update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

CREATE POLICY "chat-files: authenticated delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

-- Готово!
