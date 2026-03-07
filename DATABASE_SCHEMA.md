# Структура базы данных (Supabase / PostgreSQL)

## Обзор

База данных спроектирована для поддержки системы поиска альянсов, анализа совместимости команд и предварительных соглашений между командами FTC.

---

## Таблицы

### 1. `teams`
Основная информация о командах FTC.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `number` | INTEGER (UNIQUE, NOT NULL) | Номер команды FTC (например, 12345) |
| `name` | TEXT | Название команды |
| `region` | TEXT | Регион команды |
| `rookie_year` | INTEGER | Год основания команды |
| `robot_photo_url` | TEXT (NULLABLE) | URL фото робота (для виртуального пит-скаутинга) |
| `robot_features` | JSONB | Метаданные робота: тип захвата, колёса, особенности |
| `created_at` | TIMESTAMP | Дата создания записи |
| `updated_at` | TIMESTAMP | Дата последнего обновления |

**Индексы:**
- `idx_teams_number` на `number`
- `idx_teams_region` на `region`

**Пример `robot_features`:**
```json
{
  "gripper_type": "claw",
  "wheel_type": "omni",
  "special_features": ["hanging", "autonomous_parking"],
  "season": 2025
}
```

---

### 2. `events`
События FTC (квалификации, региональные, чемпионаты).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `season` | INTEGER (NOT NULL) | Год сезона (например, 2024, 2025) |
| `code` | TEXT (UNIQUE, NOT NULL) | Код события из FTCScout/FTC Events API |
| `name` | TEXT (NOT NULL) | Название события |
| `start_date` | DATE | Дата начала |
| `end_date` | DATE | Дата окончания |
| `location` | TEXT | Место проведения |
| `type` | ENUM | Тип: `qualifier`, `regional`, `championship`, `scrimmage`, `premier` |
| `has_matches` | BOOLEAN | Есть ли данные о матчах в FTCScout |
| `ftcscout_synced_at` | TIMESTAMP (NULLABLE) | Когда последний раз синхронизировалось с FTCScout |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Индексы:**
- `idx_events_code` на `code`
- `idx_events_season` на `season`
- `idx_events_start_date` на `start_date`

---

### 3. `team_event_participations`
Участие команд в событиях.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `team_id` | UUID (FK → teams.id) | ID команды |
| `event_id` | UUID (FK → events.id) | ID события |
| `is_confirmed` | BOOLEAN (DEFAULT false) | Подтвердила ли команда участие (кнопка "Я участвую") |
| `stats` | JSONB | Статистика команды на событии из FTCScout |
| `awards` | JSONB | Список наград, полученных на событии |
| `rank` | INTEGER (NULLABLE) | Финальный ранг на событии |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Индексы:**
- `idx_team_event_participations_team_event` на `(team_id, event_id)` (UNIQUE)
- `idx_team_event_participations_event` на `event_id`
- `idx_team_event_participations_confirmed` на `is_confirmed`

**Пример `stats`:**
```json
{
  "OPR": 85.5,
  "DPR": 45.2,
  "CCWM": 40.3,
  "avg_autonomous": 25.0,
  "avg_teleop": 60.5,
  "avg_endgame": 15.0,
  "matches_played": 8,
  "wins": 6,
  "losses": 2
}
```

---

### 4. `matches`
Матчи на событиях.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `event_id` | UUID (FK → events.id) | ID события |
| `match_number` | TEXT | Номер матча (например, "Q1", "SF1") |
| `alliance_red_teams` | INTEGER[] | Номера команд красного альянса |
| `alliance_blue_teams` | INTEGER[] | Номера команд синего альянса |
| `score_red` | INTEGER | Счёт красного альянса |
| `score_blue` | INTEGER | Счёт синего альянса |
| `period_details` | JSONB | Детали по периодам (автоном, телеоп, эндшпиль) |
| `ftcscout_match_id` | TEXT (NULLABLE) | ID матча в FTCScout для синхронизации |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Индексы:**
- `idx_matches_event` на `event_id`
- `idx_matches_event_number` на `(event_id, match_number)`

---

### 5. `quick_stats`
Быстрая статистика команд по сезонам (кеш из FTCScout).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `team_id` | UUID (FK → teams.id) | ID команды |
| `season` | INTEGER (NOT NULL) | Год сезона |
| `region` | TEXT | Регион |
| `OPR` | FLOAT | Offensive Power Rating |
| `DPR` | FLOAT | Defensive Power Rating |
| `CCWM` | FLOAT | Calculated Contribution to Winning Margin |
| `avg_autonomous` | FLOAT | Средний балл в автономном периоде |
| `avg_teleop` | FLOAT | Средний балл в телеопе |
| `avg_endgame` | FLOAT | Средний балл в эндшпиле |
| `matches_played` | INTEGER | Количество сыгранных матчей |
| `win_rate` | FLOAT | Процент побед |
| `ftcscout_synced_at` | TIMESTAMP | Когда последний раз синхронизировалось |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Индексы:**
- `idx_quick_stats_team_season` на `(team_id, season)` (UNIQUE)
- `idx_quick_stats_season` на `season`
- `idx_quick_stats_OPR` на `OPR` (для сортировки)

---

### 6. `users`
Пользователи системы (через Supabase Auth).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор (из Supabase Auth) |
| `email` | TEXT (UNIQUE) | Email пользователя |
| `role` | ENUM | Роль: `team_member`, `coach`, `admin` |
| `team_id` | UUID (FK → teams.id, NULLABLE) | ID команды, к которой привязан пользователь |
| `display_name` | TEXT | Отображаемое имя |
| `created_at` | TIMESTAMP | Дата регистрации |
| `updated_at` | TIMESTAMP | Дата обновления |

**Индексы:**
- `idx_users_team` на `team_id`
- `idx_users_email` на `email`

**Примечание:** Пароли и другие данные аутентификации хранятся в Supabase Auth, не в этой таблице.

---

### 7. `pre_match_agreements`
Предварительные соглашения между командами.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `event_id` | UUID (FK → events.id) | ID события |
| `sender_team_id` | UUID (FK → teams.id) | ID команды-отправителя |
| `receiver_team_id` | UUID (FK → teams.id) | ID команды-получателя |
| `message` | TEXT | Сообщение с описанием сильных сторон, просьб |
| `video_url` | TEXT (NULLABLE) | URL видео робота |
| `status` | ENUM | Статус: `pending`, `accepted`, `rejected`, `cancelled` |
| `compatibility_score` | FLOAT (NULLABLE) | Рассчитанный балл совместимости (0-100) |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |
| `responded_at` | TIMESTAMP (NULLABLE) | Дата ответа |

**Индексы:**
- `idx_pre_match_agreements_event` на `event_id`
- `idx_pre_match_agreements_sender` на `sender_team_id`
- `idx_pre_match_agreements_receiver` на `receiver_team_id`
- `idx_pre_match_agreements_status` на `status`

**Ограничения:**
- Одна команда не может отправить два активных запроса одной и той же команде на одно событие (UNIQUE на `(sender_team_id, receiver_team_id, event_id, status='pending')`)

---

### 8. `compatibility_scores`
Кеш рассчитанных баллов совместимости между командами.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `team_a_id` | UUID (FK → teams.id) | ID первой команды |
| `team_b_id` | UUID (FK → teams.id) | ID второй команды |
| `event_id` | UUID (FK → events.id, NULLABLE) | ID события (если применимо) |
| `compatibility_score` | FLOAT (0-100) | Балл совместимости |
| `factors` | JSONB | Факторы, влияющие на балл |
| `calculated_at` | TIMESTAMP | Когда был рассчитан |
| `created_at` | TIMESTAMP | Дата создания |

**Индексы:**
- `idx_compatibility_scores_teams` на `(team_a_id, team_b_id, event_id)`
- `idx_compatibility_scores_score` на `compatibility_score` (для сортировки)

**Пример `factors`:**
```json
{
  "autonomous_synergy": 0.25,
  "endgame_synergy": 0.30,
  "defensive_complement": 0.20,
  "offensive_complement": 0.25,
  "notes": "Team A has strong autonomous, Team B has strong endgame"
}
```

---

### 9. `team_favorites` (опционально)
Избранные команды пользователей.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID (PK) | Уникальный идентификатор |
| `user_id` | UUID (FK → users.id) | ID пользователя |
| `team_id` | UUID (FK → teams.id) | ID команды |
| `created_at` | TIMESTAMP | Дата добавления |

**Индексы:**
- `idx_team_favorites_user_team` на `(user_id, team_id)` (UNIQUE)

---

## Связи (Foreign Keys)

```
teams (1) ──< team_event_participations (N)
events (1) ──< team_event_participations (N)
teams (1) ──< quick_stats (N)
events (1) ──< matches (N)
teams (1) ──< users (N, optional)
events (1) ──< pre_match_agreements (N)
teams (1) ──< pre_match_agreements (N, as sender)
teams (1) ──< pre_match_agreements (N, as receiver)
teams (1) ──< compatibility_scores (N, as team_a)
teams (1) ──< compatibility_scores (N, as team_b)
users (1) ──< team_favorites (N)
teams (1) ──< team_favorites (N)
```

---

## Row Level Security (RLS) Policies

Для Supabase необходимо настроить RLS:

1. **teams**: Публичное чтение, редактирование только своей команды (если `user.team_id = team.id`)
2. **events**: Публичное чтение, редактирование только админами
3. **team_event_participations**: Чтение публичное, редактирование только своей команды
4. **pre_match_agreements**: Чтение только для отправителя/получателя, создание только для своей команды
5. **users**: Чтение только своего профиля, редактирование только своего профиля

---

## Миграции

Миграции будут созданы в формате Supabase SQL и размещены в папке `supabase/migrations/`.




