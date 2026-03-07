#!/usr/bin/env tsx
/**
 * Скрипт для очистки избранных команд
 * 
 * Использование:
 *   tsx scripts/cleanup-favorites.ts [options]
 * 
 * Опции:
 *   --all                 Удалить все избранные всех пользователей
 *   --user-id=xxx         Удалить избранные конкретного пользователя
 *   --dry-run             Тестовый режим
 *   --url=http://...       URL приложения
 */

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const userId = args.find(a => a.startsWith("--user-id="))?.split("=")[1];
  const dryRun = args.includes("--dry-run");
  const baseUrl = args.find(a => a.startsWith("--url="))?.split("=")[1] || "http://localhost:3000";

  if (!all && !userId) {
    console.error("❌ Укажите --all или --user-id=xxx");
    process.exit(1);
  }

  console.log("🗑️  Очистка избранных команд...");
  if (all) console.log("   Удалить: все избранные всех пользователей");
  if (userId) console.log(`   Удалить: избранные пользователя ${userId}`);
  console.log(`   Dry run: ${dryRun ? "ДА" : "НЕТ"}`);
  console.log(`   URL: ${baseUrl}\n`);

  const params = new URLSearchParams();
  if (all) params.set("all", "1");
  if (userId) params.set("userId", userId);
  if (dryRun) params.set("dryRun", "1");

  const url = `${baseUrl}/api/admin/teams/favorites/cleanup?${params}`;

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
    console.log(`   Deleted: ${data.deleted}`);
  } catch (error: any) {
    console.error(`❌ Ошибка:`, error.message);
  }
}

main().catch(console.error);
