# Инструменты администратора для управления командами

## 1. Массовое обновление данных всех команд

**Endpoint:** `GET /api/admin/teams/sync-all`

Обновляет данные всех команд из FTCScout API: основную информацию (имя, регион, год основания) и статистику за указанные сезоны.

### Параметры:
- `season` (опционально) - сезон для синхронизации (по умолчанию: текущий и предыдущий)
- `limit` (опционально) - сколько команд обработать за раз (по умолчанию: 100)
- `offset` (опционально) - с какой команды начать (по умолчанию: 0)
- `dryRun=1` - режим тестирования (показывает что будет обновлено, но не сохраняет)

### Примеры использования:

```bash
# Тестовый запуск (dry run) - первые 10 команд
curl "http://localhost:3000/api/admin/teams/sync-all?limit=10&dryRun=1" \
  -H "Cookie: your-auth-cookie"

# Обновить первые 100 команд за текущий сезон
curl "http://localhost:3000/api/admin/teams/sync-all?limit=100" \
  -H "Cookie: your-auth-cookie"

# Обновить команды с 100 по 200 за сезон 2025
curl "http://localhost:3000/api/admin/teams/sync-all?season=2025&limit=100&offset=100" \
  -H "Cookie: your-auth-cookie"

# Обновить все команды (нужно вызывать несколько раз с разными offset)
# offset=0, offset=100, offset=200 и т.д.
```

### Ответ:
```json
{
  "success": true,
  "dryRun": false,
  "stats": {
    "processed": 100,
    "updated": 95,
    "errors": 2,
    "skipped": 3
  },
  "errors": [
    { "teamNumber": 12345, "error": "Stats 2025: Team not found" }
  ],
  "message": "Updated 95 teams successfully"
}
```

---

## 2. Очистка данных команд

**Endpoint:** `DELETE /api/admin/teams/cleanup`

Удаляет старые или ненужные данные из базы.

### Параметры:
- `type` - тип очистки:
  - `old_stats` (по умолчанию) - удалить статистику за старые сезоны
  - `stats` - удалить статистику по критериям
  - `all` - **ОПАСНО!** Удалить все данные (статистика, участия, соглашения, чаты, избранные)
- `season` - номер сезона для удаления (например, 2023)
- `olderThan` - удалить статистику старше N дней
- `dryRun=1` - режим тестирования

### Примеры использования:

```bash
# Показать что будет удалено (dry run) - статистика за сезон 2023
curl -X DELETE "http://localhost:3000/api/admin/teams/cleanup?type=stats&season=2023&dryRun=1" \
  -H "Cookie: your-auth-cookie"

# Удалить статистику за сезон 2023
curl -X DELETE "http://localhost:3000/api/admin/teams/cleanup?type=stats&season=2023" \
  -H "Cookie: your-auth-cookie"

# Удалить статистику старше 90 дней
curl -X DELETE "http://localhost:3000/api/admin/teams/cleanup?type=stats&olderThan=90" \
  -H "Cookie: your-auth-cookie"

# Удалить статистику за все сезоны старше предыдущего (по умолчанию)
curl -X DELETE "http://localhost:3000/api/admin/teams/cleanup?type=old_stats" \
  -H "Cookie: your-auth-cookie"

# ОПАСНО! Удалить все данные (dry run)
curl -X DELETE "http://localhost:3000/api/admin/teams/cleanup?type=all&dryRun=1" \
  -H "Cookie: your-auth-cookie"
```

### Ответ:
```json
{
  "success": true,
  "dryRun": false,
  "deleted": 150,
  "message": "Deleted 150 quick_stats records"
}
```

---

## 3. Очистка избранных команд

**Endpoint:** `DELETE /api/admin/teams/favorites/cleanup`

Удаляет записи из таблицы `team_favorites` (избранные команды пользователей).

### Параметры:
- `userId` - очистить избранные конкретного пользователя (UUID)
- `all=1` - очистить все избранные всех пользователей
- `dryRun=1` - режим тестирования

### Примеры использования:

```bash
# Показать что будет удалено (dry run) - все избранные
curl -X DELETE "http://localhost:3000/api/admin/teams/favorites/cleanup?all=1&dryRun=1" \
  -H "Cookie: your-auth-cookie"

# Удалить все избранные всех пользователей
curl -X DELETE "http://localhost:3000/api/admin/teams/favorites/cleanup?all=1" \
  -H "Cookie: your-auth-cookie"

# Удалить избранные конкретного пользователя
curl -X DELETE "http://localhost:3000/api/admin/teams/favorites/cleanup?userId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: your-auth-cookie"
```

### Ответ:
```json
{
  "success": true,
  "dryRun": false,
  "deleted": 42,
  "message": "Deleted 42 favorite entries"
}
```

---

## Скрипт для полного обновления всех команд

Создайте файл `scripts/sync-all-teams.sh`:

```bash
#!/bin/bash

# Конфигурация
BASE_URL="http://localhost:3000"
COOKIE="your-auth-cookie-here"
LIMIT=100
OFFSET=0

echo "Начинаем синхронизацию всех команд..."

while true; do
  echo "Обрабатываем команды с $OFFSET по $((OFFSET + LIMIT - 1))..."
  
  RESPONSE=$(curl -s "$BASE_URL/api/admin/teams/sync-all?limit=$LIMIT&offset=$OFFSET" \
    -H "Cookie: $COOKIE")
  
  PROCESSED=$(echo $RESPONSE | jq -r '.stats.processed')
  UPDATED=$(echo $RESPONSE | jq -r '.stats.updated')
  ERRORS=$(echo $RESPONSE | jq -r '.stats.errors')
  
  echo "Обработано: $PROCESSED, Обновлено: $UPDATED, Ошибок: $ERRORS"
  
  if [ "$PROCESSED" -lt "$LIMIT" ]; then
    echo "Все команды обработаны!"
    break
  fi
  
  OFFSET=$((OFFSET + LIMIT))
  sleep 2  # Пауза между запросами чтобы не перегрузить API
done

echo "Синхронизация завершена!"
```

Или PowerShell скрипт `scripts/sync-all-teams.ps1`:

```powershell
# Конфигурация
$baseUrl = "http://localhost:3000"
$cookie = "your-auth-cookie-here"
$limit = 100
$offset = 0

Write-Host "Начинаем синхронизацию всех команд..."

while ($true) {
    Write-Host "Обрабатываем команды с $offset по $($offset + $limit - 1)..."
    
    $url = "$baseUrl/api/admin/teams/sync-all?limit=$limit&offset=$offset"
    $response = Invoke-RestMethod -Uri $url -Headers @{ "Cookie" = $cookie } -Method Get
    
    $processed = $response.stats.processed
    $updated = $response.stats.updated
    $errors = $response.stats.errors
    
    Write-Host "Обработано: $processed, Обновлено: $updated, Ошибок: $errors"
    
    if ($processed -lt $limit) {
        Write-Host "Все команды обработаны!"
        break
    }
    
    $offset += $limit
    Start-Sleep -Seconds 2  # Пауза между запросами
}

Write-Host "Синхронизация завершена!"
```

---

## Важные замечания

1. **Авторизация**: Все endpoints требуют авторизованного пользователя. Передавайте cookie сессии в заголовках.

2. **Rate Limiting**: FTCScout API может иметь ограничения на количество запросов. Используйте паузы между запросами.

3. **Dry Run**: Всегда сначала запускайте с `dryRun=1` чтобы увидеть что будет изменено.

4. **Очистка данных**: Будьте осторожны с `type=all` - это удалит все данные!

5. **Массовое обновление**: Для большого количества команд используйте пагинацию (limit/offset) чтобы не перегрузить сервер.

6. **Логирование**: Проверяйте поле `errors` в ответе для выявления проблемных команд.
