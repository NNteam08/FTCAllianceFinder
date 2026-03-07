# Скрипты для управления командами

## Быстрый старт

### 1. Массовое обновление всех команд

**Через браузер (после авторизации):**
```
http://localhost:3000/api/admin/teams/sync-all?limit=10&dryRun=1
```

**Через curl:**
```bash
# Тестовый запуск (dry run)
curl "http://localhost:3000/api/admin/teams/sync-all?limit=10&dryRun=1" \
  -H "Cookie: sb-xxx-auth-token=your-token"

# Реальное обновление первых 100 команд
curl "http://localhost:3000/api/admin/teams/sync-all?limit=100" \
  -H "Cookie: sb-xxx-auth-token=your-token"
```

**Через скрипт:**
```bash
tsx scripts/sync-teams.ts --limit=100 --dry-run
```

### 2. Очистка старых данных

**Удалить статистику за сезон 2023:**
```bash
curl -X DELETE "http://localhost:3000/api/admin/teams/cleanup?type=stats&season=2023&dryRun=1" \
  -H "Cookie: sb-xxx-auth-token=your-token"
```

**Удалить статистику старше 90 дней:**
```bash
curl -X DELETE "http://localhost:3000/api/admin/teams/cleanup?type=stats&olderThan=90" \
  -H "Cookie: sb-xxx-auth-token=your-token"
```

### 3. Очистка избранных команд

**Удалить все избранные:**
```bash
curl -X DELETE "http://localhost:3000/api/admin/teams/favorites/cleanup?all=1&dryRun=1" \
  -H "Cookie: sb-xxx-auth-token=your-token"
```

---

## Полная документация

См. [admin-tools.md](./admin-tools.md) для подробной документации.
