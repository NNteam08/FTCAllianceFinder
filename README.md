# FTC Alliance Finder

Веб-приложение для команд робототехники FTC (First Tech Challenge), помогающее находить партнеров для альянсов, анализировать совместимость команд и договариваться о стратегии заранее.

## 🎯 Основные возможности

- **Интеграция с FTCScout API** — автоматическое подтягивание статистики команд (OPR, NP, история матчей)
- **Календарь событий** — список предстоящих соревнований с возможностью отметить участие
- **Pre-match Agreements** — система предварительных соглашений между командами
- **Dashboard сравнения** — визуальное сравнение команд с графиками и прогнозом совместимости
- **Виртуальный пит-скаутинг** — загрузка фото роботов и описание их особенностей

## 🛠 Технологический стек

- **Frontend/Backend:** Next.js 14+ (App Router)
- **UI:** Tailwind CSS + Shadcn UI
- **База данных:** Supabase (PostgreSQL)
- **Аутентификация:** Supabase Auth
- **API:** FTCScout REST/GraphQL API
- **Деплой:** [Vercel](https://vercel.com) / [Netlify](https://www.netlify.com) (см. [DEPLOY_NETLIFY.md](DEPLOY_NETLIFY.md))

## 📋 Структура проекта

```
ftc-alliance-finder/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Страницы аутентификации
│   ├── (dashboard)/            # Основные страницы приложения
│   └── api/               # API routes
├── components/            # React компоненты
├── lib/                   # Утилиты и клиенты
│   ├── ftcscout/         # FTCScout API клиент
│   └── supabase/         # Supabase клиент
├── supabase/             # Миграции БД
└── types/                # TypeScript типы
```

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- npm или yarn
- Аккаунт Supabase
- Доступ к FTCScout API

### Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/NNteam08/FTCAllianceFinder.git
cd FTCAllianceFinder
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения:
```bash
cp .env.example .env.local
```

Заполните `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FTCSCOUT_API_URL=https://ftcscout.org/api
```

4. Настройте базу данных:
```bash
# Примените миграции в Supabase Dashboard
# или используйте Supabase CLI
supabase db push
```

5. Запустите dev сервер:
```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 📚 Документация

- [Структура базы данных](./DATABASE_SCHEMA.md)
- [Схема API-запросов к FTCScout](./API_SCHEMA.md)
- [План разработки MVP](./DEVELOPMENT_PLAN.md)

## 🎨 Дизайн

Приложение использует темную тему по умолчанию с акцентными цветами FIRST:
- **Синий:** #0066CC
- **Оранжевый:** #FF6600

## 📝 Лицензия

MIT

## 🤝 Вклад

Приветствуются pull requests и issues!




