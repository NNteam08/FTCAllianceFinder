-- ============================================================
-- FTC Alliance Finder — полный сброс и создание схемы Supabase
-- Вставьте в SQL Editor: https://supabase.com/dashboard → SQL Editor
-- ============================================================

-- 1. Удаляем таблицы (порядок из-за внешних ключей)
DROP TABLE IF EXISTS team_favorites CASCADE;
DROP TABLE IF EXISTS compatibility_scores CASCADE;
DROP TABLE IF EXISTS pre_match_agreements CASCADE;
DROP TABLE IF EXISTS team_event_participations CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS quick_stats CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- 2. Удаляем типы
DROP TYPE IF EXISTS agreement_status;
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS event_type;

-- 3. Расширения и типы
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE event_type AS ENUM ('qualifier', 'regional', 'championship', 'scrimmage', 'premier');
CREATE TYPE user_role AS ENUM ('team_member', 'coach', 'admin');
CREATE TYPE agreement_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- 4. Таблицы

-- Команды
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  rookie_year INTEGER,
  robot_photo_url TEXT,
  robot_features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_teams_number ON teams(number);
CREATE INDEX idx_teams_region ON teams(region);

-- События
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  location TEXT,
  type event_type,
  has_matches BOOLEAN DEFAULT false,
  ftcscout_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_events_code ON events(code);
CREATE INDEX idx_events_season ON events(season);
CREATE INDEX idx_events_start_date ON events(start_date);

-- Участие команд в событиях
CREATE TABLE team_event_participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  is_confirmed BOOLEAN DEFAULT false,
  stats JSONB DEFAULT '{}',
  awards JSONB DEFAULT '[]',
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, event_id)
);
CREATE INDEX idx_team_event_participations_team_event ON team_event_participations(team_id, event_id);
CREATE INDEX idx_team_event_participations_event ON team_event_participations(event_id);
CREATE INDEX idx_team_event_participations_confirmed ON team_event_participations(is_confirmed) WHERE is_confirmed = true;

-- Матчи
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  match_number TEXT NOT NULL,
  alliance_red_teams INTEGER[],
  alliance_blue_teams INTEGER[],
  score_red INTEGER,
  score_blue INTEGER,
  period_details JSONB DEFAULT '{}',
  ftcscout_match_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_matches_event ON matches(event_id);
CREATE INDEX idx_matches_event_number ON matches(event_id, match_number);

-- Quick stats (OPR, DPR, CCWM и т.д. из FTCScout)
CREATE TABLE quick_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  region TEXT,
  opr FLOAT,
  dpr FLOAT,
  ccwm FLOAT,
  avg_autonomous FLOAT,
  avg_teleop FLOAT,
  avg_endgame FLOAT,
  matches_played INTEGER,
  win_rate FLOAT,
  ftcscout_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, season)
);
CREATE INDEX idx_quick_stats_team_season ON quick_stats(team_id, season);
CREATE INDEX idx_quick_stats_season ON quick_stats(season);
CREATE INDEX idx_quick_stats_opr ON quick_stats(opr);

-- Пользователи (расширение auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role user_role DEFAULT 'team_member',
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_users_team ON users(team_id);
CREATE INDEX idx_users_email ON users(email);

-- Предматчевые соглашения
CREATE TABLE pre_match_agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sender_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  receiver_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  video_url TEXT,
  status agreement_status DEFAULT 'pending',
  compatibility_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  CHECK (sender_team_id != receiver_team_id)
);
CREATE INDEX idx_pre_match_agreements_event ON pre_match_agreements(event_id);
CREATE INDEX idx_pre_match_agreements_sender ON pre_match_agreements(sender_team_id);
CREATE INDEX idx_pre_match_agreements_receiver ON pre_match_agreements(receiver_team_id);
CREATE INDEX idx_pre_match_agreements_status ON pre_match_agreements(status);
CREATE UNIQUE INDEX idx_pre_match_agreements_unique_pending
  ON pre_match_agreements(sender_team_id, receiver_team_id, event_id)
  WHERE status = 'pending';

-- Оценки совместимости
CREATE TABLE compatibility_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_a_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  compatibility_score FLOAT NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  factors JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (team_a_id != team_b_id)
);
CREATE INDEX idx_compatibility_scores_teams ON compatibility_scores(team_a_id, team_b_id, event_id);
CREATE INDEX idx_compatibility_scores_score ON compatibility_scores(compatibility_score);

-- Избранные команды
CREATE TABLE team_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);
CREATE INDEX idx_team_favorites_user_team ON team_favorites(user_id, team_id);

-- 5. Триггеры updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_event_participations_updated_at
  BEFORE UPDATE ON team_event_participations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quick_stats_updated_at
  BEFORE UPDATE ON quick_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pre_match_agreements_updated_at
  BEFORE UPDATE ON pre_match_agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Готово.
