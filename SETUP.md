# Инструкция по настройке и запуску

## Предварительные требования

- Node.js 18+ установлен
- Аккаунт Supabase (бесплатный план подойдет)
- Git (опционально)

## Шаг 1: Установка зависимостей

```bash
npm install
```

## Шаг 2: Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в SQL Editor
3. Выполните миграцию из файла `supabase/migrations/001_initial_schema.sql`
4. Скопируйте URL проекта и anon key из Settings → API

## Шаг 3: Настройка переменных окружения

Создайте файл `.env.local` в корне проекта:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FTCSCOUT_API_URL=https://ftcscout.org/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Шаг 4: Настройка Row Level Security (RLS)

В Supabase SQL Editor выполните следующие политики:

```sql
-- Разрешить публичное чтение команд
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams are viewable by everyone" ON teams
  FOR SELECT USING (true);

-- Разрешить пользователям редактировать только свою команду
CREATE POLICY "Users can update their own team" ON teams
  FOR UPDATE USING (
    id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  );

-- Аналогично для других таблиц
-- (см. DATABASE_SCHEMA.md для полного списка политик)
```

## Шаг 5: Запуск проекта

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Шаг 6: Первый вход

1. Зарегистрируйтесь на `/register`
2. При регистрации можно указать номер команды FTC
3. После входа вы попадете на dashboard

## Использование

### Добавление команды

1. Перейдите на `/teams`
2. Введите номер команды FTC
3. Нажмите "Найти"
4. Команда будет загружена из FTCScout и сохранена в БД

### Синхронизация событий

1. Перейдите на `/events`
2. Нажмите "Синхронизировать события"
3. События будут загружены из FTCScout

### Создание соглашения

1. Перейдите на `/agreements/new`
2. Введите номер команды-получателя
3. Выберите событие
4. Напишите сообщение
5. Отправьте соглашение

### Сравнение команд

1. Перейдите на `/teams/compare`
2. Добавьте 2-3 команды для сравнения
3. Просмотрите статистику и совместимость

## Troubleshooting

### Ошибка подключения к Supabase

- Проверьте правильность URL и ключей в `.env.local`
- Убедитесь, что проект Supabase активен

### Ошибки при загрузке данных из FTCScout

- Проверьте доступность API: https://ftcscout.org/api
- Убедитесь, что номер команды корректен
- Некоторые команды могут не иметь статистики

### Ошибки миграции

- Убедитесь, что используете PostgreSQL в Supabase
- Проверьте, что все расширения установлены (uuid-ossp)

## Деплой на Vercel

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения в Vercel Dashboard
3. Деплой произойдет автоматически

## Дополнительная информация

- [Документация по БД](./DATABASE_SCHEMA.md)
- [Схема API](./API_SCHEMA.md)
- [План разработки](./DEVELOPMENT_PLAN.md)
- [Архитектура](./ARCHITECTURE.md)

