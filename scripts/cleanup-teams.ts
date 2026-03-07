#!/usr/bin/env tsx
/**
 * Скрипт для очистки данных команд
 * 
 * Использование:
 *   tsx scripts/cleanup-teams.ts [options]
 * 
 * Опции:
 *   --type=old_stats     Тип очистки: old_stats, stats, all
 *   --season=2023         Сезон для удаления
 *   --older-than=90      Удалить данные старше N дней
 *   --dry-run             Тестовый режим
 *   --url=http://...      URL приложения
 */

async function main() {
  const args = process.argv.slice(2);
  const type = args.find(a => a.startsWith("--type="))?.split("=")[1] || "old_stats";
  const season = args.find(a => a.startsWith("--season="))?.split("=")[1];
  const olderThan = args.find(a => a.startsWith("--older-than="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");
  const baseUrl = args.find(a => a.startsWith("--url="))?.split("=")[1] || "http://localhost:3000";

  console.log("🧹 Очистка данных команд...");
  console.log(`   Type: ${type}`);
  if (season) console.log(`   Season: ${season}`);
  if (olderThan) console.log(`   Older than: ${olderThan} days`);
  console.log(`   Dry run: ${dryRun ? "ДА" : "НЕТ"}`);
  console.log(`   URL: ${baseUrl}\n`);

  const params = new URLSearchParams({ type });
  if (season) params.set("season", season);
  if (olderThan) params.set("olderThan", olderThan);
  if (dryRun) params.set("dryRun", "1");

  const url = `${baseUrl}/api/admin/teams/cleanup?${params}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        // "Cookie": "your-session-cookie-here"
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ ${data.message}`);
    console.log(`   Deleted: ${data.deleted === -1 ? "all" : data.deleted}`);
  } catch (error: any) {
    console.error(`❌ Ошибка:`, error.message);
  }
}

main().catch(console.error);
