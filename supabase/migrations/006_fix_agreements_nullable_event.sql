-- Исправление: разрешить создание соглашений без события

-- 1. Удаляем старый уникальный индекс
DROP INDEX IF EXISTS idx_pre_match_agreements_unique_pending;

-- 2. Делаем event_id nullable (разрешаем NULL)
ALTER TABLE pre_match_agreements 
ALTER COLUMN event_id DROP NOT NULL;

-- 3. Создаём новый индекс, который корректно обрабатывает NULL в event_id
-- Используем COALESCE для замены NULL на специальное значение
CREATE UNIQUE INDEX idx_pre_match_agreements_unique_pending 
ON pre_match_agreements(sender_team_id, receiver_team_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
WHERE status = 'pending';
