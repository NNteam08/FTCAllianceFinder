# Схема API-запросов к FTCScout

## Обзор

FTCScout предоставляет два типа API:
- **REST API** — простые HTTP запросы
- **GraphQL API** — более гибкий, позволяет запрашивать связанные данные

---

## REST API Endpoints

### Базовый URL
```
https://ftcscout.org/api/rest
```

### 1. Информация о команде

**GET** `/teams/:number`

**Параметры:**
- `number` (path) — номер команды FTC (например, 12345)

**Ответ:**
```json
{
  "number": 12345,
  "name": "Team Name",
  "region": "Region Name",
  "rookieYear": 2020,
  "website": "https://...",
  "city": "City",
  "state": "State"
}
```

**Использование:** Получение базовой информации о команде при регистрации или просмотре профиля.

---

### 2. Быстрая статистика команды

**GET** `/teams/:number/quick-stats`

**Query параметры:**
- `season` (integer, optional) — год сезона (например, 2025)
- `region` (string, optional) — регион для фильтрации

**Ответ:**
```json
{
  "teamNumber": 12345,
  "season": 2025,
  "region": "Region Name",
  "OPR": 85.5,
  "DPR": 45.2,
  "CCWM": 40.3,
  "avgAutonomous": 25.0,
  "avgTeleop": 60.5,
  "avgEndgame": 15.0,
  "matchesPlayed": 20,
  "winRate": 0.75
}
```

**Использование:** Заполнение таблицы `quick_stats`, отображение на карточках команд, расчет совместимости.

---

### 3. События команды

**GET** `/teams/:number/events`

**Query параметры:**
- `season` (integer, optional) — год сезона

**Ответ:**
```json
[
  {
    "code": "EVENT_CODE",
    "name": "Event Name",
    "startDate": "2025-01-15",
    "endDate": "2025-01-17",
    "location": "Location",
    "type": "qualifier",
    "stats": {
      "OPR": 80.0,
      "rank": 5,
      "matchesPlayed": 8
    }
  }
]
```

**Использование:** Отображение истории участия команды, синхронизация событий.

---

### 4. Матчи команды

**GET** `/teams/:number/matches`

**Query параметры:**
- `season` (integer, optional) — год сезона
- `event` (string, optional) — код события для фильтрации

**Ответ:**
```json
[
  {
    "matchNumber": "Q1",
    "eventCode": "EVENT_CODE",
    "alliance": "red",
    "allianceTeams": [12345, 67890, 11111],
    "opponentTeams": [22222, 33333, 44444],
    "score": 120,
    "opponentScore": 95,
    "won": true,
    "periodDetails": {
      "autonomous": 25,
      "teleop": 60,
      "endgame": 35
    }
  }
]
```

**Использование:** Анализ истории матчей, построение графиков, расчет трендов.

---

### 5. Команды на событии

**GET** `/events/:season/:code/teams`

**Параметры:**
- `season` (path) — год сезона
- `code` (path) — код события

**Ответ:**
```json
{
  "event": {
    "code": "EVENT_CODE",
    "name": "Event Name",
    "startDate": "2025-01-15",
    "endDate": "2025-01-17"
  },
  "teams": [
    {
      "number": 12345,
      "name": "Team Name",
      "stats": {
        "OPR": 85.5,
        "rank": 3
      }
    }
  ]
}
```

**Использование:** Построение списка команд на событии, синхронизация участников.

---

### 6. Матчи на событии

**GET** `/events/:season/:code/matches`

**Параметры:**
- `season` (path) — год сезона
- `code` (path) — код события

**Ответ:**
```json
[
  {
    "matchNumber": "Q1",
    "redAlliance": [12345, 67890, 11111],
    "blueAlliance": [22222, 33333, 44444],
    "redScore": 120,
    "blueScore": 95,
    "periodDetails": {
      "red": {
        "autonomous": 25,
        "teleop": 60,
        "endgame": 35
      },
      "blue": {
        "autonomous": 20,
        "teleop": 55,
        "endgame": 20
      }
    }
  }
]
```

**Использование:** Синхронизация матчей события, анализ результатов.

---

### 7. Поиск событий

**GET** `/events/search`

**Query параметры:**
- `season` (integer, optional) — год сезона
- `type` (string, optional) — тип события (qualifier, regional, etc.)
- `region` (string, optional) — регион
- `startDate` (date, optional) — начальная дата
- `endDate` (date, optional) — конечная дата

**Ответ:**
```json
[
  {
    "code": "EVENT_CODE",
    "name": "Event Name",
    "startDate": "2025-01-15",
    "endDate": "2025-01-17",
    "location": "Location",
    "type": "qualifier",
    "hasMatches": true
  }
]
```

**Использование:** Построение календаря событий, поиск предстоящих соревнований.

---

## GraphQL API

### Базовый URL
```
https://ftcscout.org/api/graphql
```

### Примеры запросов

#### 1. Полная информация о команде с статистикой

```graphql
query GetTeamWithStats($number: Int!, $season: Int!) {
  team(number: $number) {
    number
    name
    region
    rookieYear
    quickStats(season: $season) {
      OPR
      DPR
      CCWM
      avgAutonomous
      avgTeleop
      avgEndgame
      matchesPlayed
      winRate
    }
    eventParticipations(season: $season) {
      event {
        code
        name
        startDate
        type
      }
      stats {
        OPR
        rank
        matchesPlayed
      }
      awards {
        name
        type
      }
    }
    matches(season: $season, limit: 10) {
      matchNumber
      event {
        code
        name
      }
      alliance
      score
      opponentScore
      won
      periodDetails {
        autonomous
        teleop
        endgame
      }
    }
  }
}
```

**Переменные:**
```json
{
  "number": 12345,
  "season": 2025
}
```

**Использование:** Загрузка полного профиля команды, сравнение команд, расчет совместимости.

---

#### 2. Событие с командами и матчами

```graphql
query GetEventDetails($season: Int!, $code: String!) {
  event(season: $season, code: $code) {
    code
    name
    startDate
    endDate
    location
    type
    teams {
      number
      name
      stats {
        OPR
        rank
      }
    }
    matches(limit: 50) {
      matchNumber
      redAlliance
      blueAlliance
      redScore
      blueScore
    }
  }
}
```

**Переменные:**
```json
{
  "season": 2025,
  "code": "EVENT_CODE"
}
```

**Использование:** Страница события с полной информацией, синхронизация данных.

---

#### 3. Сравнение нескольких команд

```graphql
query CompareTeams($numbers: [Int!]!, $season: Int!) {
  teams(numbers: $numbers) {
    number
    name
    quickStats(season: $season) {
      OPR
      DPR
      CCWM
      avgAutonomous
      avgTeleop
      avgEndgame
    }
    matches(season: $season, limit: 20) {
      matchNumber
      score
      periodDetails {
        autonomous
        teleop
        endgame
      }
    }
  }
}
```

**Переменные:**
```json
{
  "numbers": [12345, 67890, 11111],
  "season": 2025
}
```

**Использование:** Dashboard сравнения команд, анализ альянсов.

---

## Реализация в Next.js

### Структура API Routes

```
app/
  api/
    ftcscout/
      teams/
        [number]/
          route.ts          # GET /api/ftcscout/teams/:number
          quick-stats/
            route.ts        # GET /api/ftcscout/teams/:number/quick-stats
          events/
            route.ts        # GET /api/ftcscout/teams/:number/events
          matches/
            route.ts        # GET /api/ftcscout/teams/:number/matches
      events/
        [season]/
          [code]/
            route.ts        # GET /api/ftcscout/events/:season/:code
            teams/
              route.ts      # GET /api/ftcscout/events/:season/:code/teams
            matches/
              route.ts      # GET /api/ftcscout/events/:season/:code/matches
        search/
          route.ts          # GET /api/ftcscout/events/search
      graphql/
        route.ts            # POST /api/ftcscout/graphql
```

### Пример сервиса для работы с FTCScout

```typescript
// lib/ftcscout/client.ts
export class FTCScoutClient {
  private baseUrl = 'https://ftcscout.org/api/rest';
  private graphqlUrl = 'https://ftcscout.org/api/graphql';

  async getTeam(number: number) {
    const response = await fetch(`${this.baseUrl}/teams/${number}`);
    return response.json();
  }

  async getTeamQuickStats(number: number, season?: number, region?: string) {
    const params = new URLSearchParams();
    if (season) params.append('season', season.toString());
    if (region) params.append('region', region);
    
    const response = await fetch(
      `${this.baseUrl}/teams/${number}/quick-stats?${params}`
    );
    return response.json();
  }

  async searchEvents(filters: EventSearchFilters) {
    const params = new URLSearchParams();
    if (filters.season) params.append('season', filters.season.toString());
    if (filters.type) params.append('type', filters.type);
    if (filters.region) params.append('region', filters.region);
    
    const response = await fetch(
      `${this.baseUrl}/events/search?${params}`
    );
    return response.json();
  }

  async graphqlQuery(query: string, variables?: Record<string, any>) {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  }
}
```

---

## Rate Limiting и кеширование

### Рекомендации

1. **Кеширование:** Кешировать данные в Supabase, обновлять не чаще раза в час
2. **Rate Limiting:** FTCScout может иметь ограничения — использовать задержки между запросами
3. **Фоновые задачи:** Использовать cron jobs или очереди для синхронизации данных

### Стратегия кеширования

- **Quick Stats:** Обновлять раз в день
- **События:** Обновлять раз в неделю
- **Матчи:** Обновлять в реальном времени только для активных событий

---

## Обработка ошибок

```typescript
// lib/ftcscout/errors.ts
export class FTCScoutError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
  }
}

// В клиенте
async getTeam(number: number) {
  try {
    const response = await fetch(`${this.baseUrl}/teams/${number}`);
    if (!response.ok) {
      throw new FTCScoutError(
        `Failed to fetch team ${number}`,
        response.status,
        await response.json()
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof FTCScoutError) {
      // Обработка специфичных ошибок FTCScout
    }
    throw error;
  }
}
```




