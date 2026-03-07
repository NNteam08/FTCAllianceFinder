-- Добавляем поле rank в quick_stats (рейтинг команды по OPR)
ALTER TABLE quick_stats ADD COLUMN IF NOT EXISTS rank INTEGER;

-- Создаём индекс для быстрого поиска по рейтингу
CREATE INDEX IF NOT EXISTS idx_quick_stats_rank ON quick_stats(rank) WHERE rank IS NOT NULL;
