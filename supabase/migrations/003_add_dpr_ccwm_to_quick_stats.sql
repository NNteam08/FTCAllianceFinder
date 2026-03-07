-- Добавляем поля DPR и CCWM в quick_stats
-- DPR (Defensive Power Rating) - оборонительный рейтинг
-- CCWM (Calculated Contribution to Winning Margin) - вклад в маржу победы

ALTER TABLE quick_stats ADD COLUMN IF NOT EXISTS dpr DECIMAL(10, 4);
ALTER TABLE quick_stats ADD COLUMN IF NOT EXISTS ccwm DECIMAL(10, 4);

-- Создаём индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_quick_stats_dpr ON quick_stats(dpr) WHERE dpr IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quick_stats_ccwm ON quick_stats(ccwm) WHERE ccwm IS NOT NULL;
