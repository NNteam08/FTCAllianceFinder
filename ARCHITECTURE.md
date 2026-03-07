# Архитектура приложения

## Обзор

FTC Alliance Finder построен на Next.js 14 с использованием App Router, что обеспечивает современную архитектуру с серверными и клиентскими компонентами.

## Структура проекта

```
ftc-alliance-finder/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Группа маршрутов для аутентификации
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/               # Основные страницы приложения
│   │   ├── dashboard/            # Главная страница
│   │   ├── teams/                # Страницы команд
│   │   │   ├── [number]/         # Профиль команды
│   │   │   └── compare/         # Сравнение команд
│   │   ├── events/               # Страницы событий
│   │   │   ├── [code]/          # Детали события
│   │   │   └── calendar/        # Календарь событий
│   │   └── agreements/           # Управление соглашениями
│   ├── api/                      # API Routes
│   │   ├── ftcscout/            # Прокси для FTCScout API
│   │   ├── teams/               # API для работы с командами
│   │   ├── events/              # API для работы с событиями
│   │   └── agreements/          # API для соглашений
│   ├── layout.tsx               # Корневой layout
│   ├── page.tsx                 # Главная страница
│   └── globals.css              # Глобальные стили
├── components/                   # React компоненты
│   ├── ui/                      # Shadcn UI компоненты
│   ├── teams/                   # Компоненты для команд
│   │   ├── TeamCard.tsx
│   │   ├── TeamStats.tsx
│   │   └── TeamComparison.tsx
│   ├── events/                  # Компоненты для событий
│   │   ├── EventCard.tsx
│   │   ├── EventCalendar.tsx
│   │   └── EventParticipants.tsx
│   └── agreements/              # Компоненты для соглашений
│       ├── AgreementCard.tsx
│       └── AgreementForm.tsx
├── lib/                          # Утилиты и клиенты
│   ├── ftcscout/                # FTCScout API клиент
│   │   └── client.ts
│   ├── supabase/                # Supabase клиент
│   │   ├── client.ts
│   │   └── server.ts
│   ├── compatibility/           # Алгоритм совместимости
│   │   └── calculator.ts
│   └── utils.ts                 # Общие утилиты
├── supabase/                     # Supabase конфигурация
│   └── migrations/              # SQL миграции
├── types/                        # TypeScript типы
│   └── database.ts
└── public/                       # Статические файлы
```

## Потоки данных

### 1. Загрузка данных команды

```
User → /teams/[number] 
  → Server Component 
  → FTCScout API (через lib/ftcscout/client.ts)
  → Кеширование в Supabase (teams, quick_stats)
  → Отображение данных
```

### 2. Отметка участия в событии

```
User → /events/[code] → "Я участвую"
  → Client Component (form)
  → API Route (/api/events/[code]/participate)
  → Supabase (team_event_participations)
  → Обновление UI
```

### 3. Отправка соглашения

```
User → /agreements/new
  → Выбор команды-получателя
  → Расчет совместимости (lib/compatibility/calculator.ts)
  → API Route (/api/agreements)
  → Supabase (pre_match_agreements)
  → Уведомление получателю
```

### 4. Сравнение команд

```
User → /teams/compare?teams=12345,67890
  → Server Component
  → Параллельные запросы к FTCScout API
  → Расчет совместимости
  → Визуализация (recharts)
```

## Безопасность

### Row Level Security (RLS)

Все таблицы защищены RLS policies:

- **teams**: Публичное чтение, редактирование только своей команды
- **events**: Публичное чтение, редактирование только админами
- **team_event_participations**: Чтение публичное, редактирование только своей команды
- **pre_match_agreements**: Чтение только для отправителя/получателя

### API Routes

- Все API routes проверяют аутентификацию через Supabase
- Валидация входных данных через Zod
- Rate limiting для внешних API запросов

## Кеширование

### Стратегия кеширования

1. **FTCScout данные**: Кешируются в Supabase, обновляются раз в день
2. **Quick Stats**: Обновляются раз в день или при запросе пользователя
3. **События**: Обновляются раз в неделю
4. **Матчи**: Обновляются в реальном времени только для активных событий

### Next.js кеширование

- Server Components используют кеш по умолчанию
- Revalidation через `revalidate` или `revalidatePath`
- ISR для статических страниц команд

## Производительность

### Оптимизации

1. **Code Splitting**: Автоматически через Next.js
2. **Image Optimization**: Next.js Image компонент
3. **Lazy Loading**: Компоненты загружаются по требованию
4. **Database Indexing**: Все частые запросы индексированы

### Мониторинг

- Vercel Analytics для метрик производительности
- Supabase Dashboard для мониторинга БД
- Error tracking (опционально: Sentry)

## Масштабирование

### Горизонтальное масштабирование

- Next.js на Vercel автоматически масштабируется
- Supabase поддерживает горизонтальное масштабирование
- Stateless архитектура позволяет легко масштабировать

### Вертикальное масштабирование

- Оптимизация запросов к БД
- Кеширование на уровне приложения
- CDN для статических ресурсов

## Интеграции

### FTCScout API

- REST API для простых запросов
- GraphQL API для сложных запросов
- Обработка rate limiting
- Fallback на кешированные данные

### Supabase

- PostgreSQL для основных данных
- Supabase Auth для аутентификации
- Supabase Storage для фото роботов
- Realtime для уведомлений (опционально)

## Развертывание

### Development

```bash
npm run dev
```

### Production

1. Push в GitHub
2. Vercel автоматически деплоит
3. Переменные окружения настраиваются в Vercel Dashboard
4. Supabase миграции применяются через CLI или Dashboard

### CI/CD

- Автоматические тесты перед деплоем
- Type checking через TypeScript
- Linting через ESLint
- Build проверка




