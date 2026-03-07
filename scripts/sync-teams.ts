#!/usr/bin/env tsx
/**
 * Скрипт для массового обновления всех команд из FTCScout
 * 
 * Использование:
 *   tsx scripts/sync-teams.ts [options]
 * 
 * Опции:
 *   --season=2025        Синхронизировать только указанный сезон
 *   --limit=100          Количество команд за раз
 *   --dry-run            Тестовый режим (не сохраняет изменения)
 *   --url=http://...     URL приложения (по умолчанию: http://localhost:3000)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function main() {
  const args = process.argv.slice(2);
  const season = args.find(a => a.startsWith("--season="))?.split("=")[1];
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "100");
  const dryRun = args.includes("--dry-run");
  const baseUrl = args.find(a => a.startsWith("--url="))?.split("=")[1] || "http://localhost:3000";

  console.log("🔄 Начинаем синхронизацию команд...");
  console.log(`   Season: ${season || "текущий + предыдущий"}`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Dry run: ${dryRun ? "ДА" : "НЕТ"}`);
  console.log(`   URL: ${baseUrl}\n`);

  // Создаём Supabase клиент для авторизации
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Получаем сессию (нужно будет ввести email/password или использовать service role key)
  console.log("⚠️  Для работы скрипта нужна авторизация.");
  console.log("   Используйте service role key или авторизуйтесь через браузер и скопируйте cookie.\n");

  let offset = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  while (true) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (season) params.set("season", season);
    if (dryRun) params.set("dryRun", "1");

    const url = `${baseUrl}/api/admin/teams/sync-all?${params}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          // Здесь нужно добавить Cookie с сессией или использовать service role
          // "Cookie": "your-session-cookie-here"
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      totalProcessed += data.stats.processed;
      totalUpdated += data.stats.updated;
      totalErrors += data.stats.errors;

      console.log(`[${offset}-${offset + data.stats.processed - 1}] Обработано: ${data.stats.processed}, Обновлено: ${data.stats.updated}, Ошибок: ${data.stats.errors}`);

      if (data.errors && data.errors.length > 0) {
        console.log("   Ошибки:", data.errors.slice(0, 3).map((e: any) => `Team ${e.teamNumber}: ${e.error}`).join(", "));
      }

      if (data.stats.processed < limit) {
        break;
      }

      offset += limit;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Пауза 2 сек
    } catch (error: any) {
      console.error(`❌ Ошибка при обработке offset ${offset}:`, error.message);
      break;
    }
  }

  console.log(`\n✅ Синхронизация завершена!`);
  console.log(`   Всего обработано: ${totalProcessed}`);
  console.log(`   Всего обновлено: ${totalUpdated}`);
  console.log(`   Всего ошибок: ${totalErrors}`);
}

main().catch(console.error);
