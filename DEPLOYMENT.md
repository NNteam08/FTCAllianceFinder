# Публикация сайта FTC Alliance Finder

Краткий гайд по выкладке проекта в интернет. Проект — Next.js + Supabase, проще всего деплоить на **Vercel**.

---

## 1. Подготовка

### 1.1 Репозиторий на GitHub

1. Создайте репозиторий на [github.com](https://github.com/new).
2. В папке проекта выполните:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/НАЗВАНИЕ_РЕПО.git
git push -u origin main
```

### 1.2 Supabase

- Проект Supabase уже должен быть создан.
- Все нужные миграции применены (в т.ч. `006_fix_agreements_nullable_event.sql`).

---

## 2. Деплой на Vercel (рекомендуется)

### 2.1 Регистрация и импорт

1. Зайдите на [vercel.com](https://vercel.com) и войдите через GitHub.
2. **Add New** → **Project**.
3. Выберите репозиторий FTC Alliance Finder и нажмите **Import**.

### 2.2 Переменные окружения

В настройках проекта (или при импорте) добавьте **Environment Variables**:

| Переменная | Значение | Где взять |
|------------|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Supabase → Project Settings → API → service_role (секретный) |
| `NEXT_PUBLIC_APP_URL` | URL сайта | После деплоя: `https://ваш-проект.vercel.app` |

Для Production, Preview и Development можно задать одни и те же значения или разные (например, для превью — тестовый Supabase).

### 2.3 Деплой

- Нажмите **Deploy**.
- Дождитесь сборки. После успешного деплоя Vercel покажет ссылку вида `https://ftc-alliance-finder-xxx.vercel.app`.

### 2.4 Настройка Supabase после деплоя

Чтобы авторизация работала на вашем домене:

1. Supabase Dashboard → **Authentication** → **URL Configuration**.
2. В **Site URL** укажите: `https://ваш-проект.vercel.app` (или свой домен).
3. В **Redirect URLs** добавьте:
   - `https://ваш-проект.vercel.app/**`
   - `https://ваш-проект.vercel.app/auth/callback` (если используете callback)

Сохраните изменения.

---

## 3. Свой домен (опционально)

1. Vercel → ваш проект → **Settings** → **Domains**.
2. Добавьте домен (например `ftc-alliance-finder.ru`).
3. Выполните инструкции Vercel (DNS-записи у регистратора).
4. В Supabase в **Site URL** и **Redirect URLs** укажите новый домен.

---

## 4. Проверка после публикации

- Откройте сайт по ссылке Vercel.
- Проверьте: главная, вход/регистрация, команды, события, соглашения, чат.
- Убедитесь, что после входа нет редиректов на localhost.

---

## 5. Альтернативы Vercel

### Netlify

1. [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project** → GitHub.
2. Build command: `npm run build`, Publish directory: `.next` (для Next.js лучше использовать плагин Netlify или указать в настройках Next.js на Netlify).
3. Переменные окружения задайте в **Site settings** → **Environment variables**.

Для Next.js на Netlify обычно используется [@netlify/plugin-nextjs](https://www.npmjs.com/package/@netlify/plugin-nextjs) — см. документацию Netlify по Next.js.

### Другой хостинг (VPS, shared)

- Соберите проект: `npm run build`.
- Запуск: `npm run start` (порт по умолчанию 3000).
- Проксируйте домен через Nginx/Apache на этот порт.
- Переменные окружения задайте в среде сервера (`.env` или панель хостинга).

---

## 6. Переменные окружения — сводка

Минимум для работы:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=https://ваш-сайт.vercel.app
```

Файл `.env.local` не коммитить в Git — на Vercel всё задаётся в настройках проекта.

---

## 7. Частые проблемы

| Проблема | Решение |
|----------|---------|
| 401 при логине / редирект на localhost | Проверить **Site URL** и **Redirect URLs** в Supabase и что `NEXT_PUBLIC_APP_URL` совпадает с реальным URL сайта. |
| Ошибки при сборке на Vercel | Смотреть логи сборки (Build Logs). Часто не хватает переменных окружения. |
| API FTCScout не отвечает | На проде используется тот же `api.ftcscout.org`; при необходимости задать `FTCSCOUT_API_URL` в env. |

Готово. После этих шагов сайт будет доступен по ссылке Vercel (и по своему домену, если его настроили).
