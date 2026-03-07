# Деплой на Netlify через GitHub

Репозиторий: **[github.com/NNteam08/FTCAllianceFinder](https://github.com/NNteam08/FTCAllianceFinder)**

## 1. Репозиторий на GitHub

Если деплоишь уже существующий репозиторий — просто открой его в Netlify (шаг 2).

Если клонировал проект и хочешь пушить в свой форк/копию:

```bash
git remote add origin https://github.com/NNteam08/FTCAllianceFinder.git
# или свой форк:
# git remote add origin https://github.com/YOUR_USERNAME/FTCAllianceFinder.git
git branch -M main
git push -u origin main
```

## 2. Подключение к Netlify

1. Зайди на **[app.netlify.com](https://app.netlify.com)** и войди (или зарегистрируйся).
2. **Add new site** → **Import an existing project**.
3. Выбери **GitHub** и разреши доступ к аккаунту/организации.
4. Выбери репозиторий **NNteam08/FTCAllianceFinder** (или свой форк).
5. Настройки билда (обычно подставляются автоматически):
   - **Branch to deploy:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** Netlify сам настроит для Next.js (OpenNext).
6. Нажми **Deploy site**.

## 3. Переменные окружения

В Netlify: **Site settings** → **Environment variables** → **Add variable** / **Import from .env**.

Добавь при необходимости:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (если нужен серверный доступ)
- `FIRST_FTC_API_USERNAME`, `FIRST_FTC_API_TOKEN` (если используешь FIRST API)

После добавления переменных сделай **Trigger deploy** → **Deploy site**.

## 4. Дальше

- Каждый `git push` в `main` будет запускать новый деплой.
- Логи билда: **Deploys** → выбери деплой → **Build log**.
- Домен: Netlify выдаст вид типа `random-name-123.netlify.app`; в настройках можно подключить свой домен.
