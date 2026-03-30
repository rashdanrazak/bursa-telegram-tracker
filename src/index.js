// ============================================
// BURSA DIVIDEND AGENT — Main Entry Point
// ============================================
// npm install axios cheerio node-cron dotenv telegraf @anthropic-ai/sdk rss-parser

import { config } from 'dotenv';
config(); // Load .env BEFORE other imports

import cron from 'node-cron';
import { scrapeAnnouncements } from './scraper.js';
import { scoreAnnouncement } from './scorer.js';
import { sendTelegramAlert, testTelegram } from './notifier.js';
import { loadSeen, saveSeen } from './store.js';
import { logger } from './logger.js';
import { startFomoCrawler } from './fomoCrawler.js';
import { isDemoMode } from './utils/claude.js';

// ── Main dividend job ─────────────────────────────────────────────────────────

async function runAgent() {
  logger.info('[Agent] Checking Bursa announcements...');

  try {
    const announcements = await scrapeAnnouncements();
    const seen          = await loadSeen();
    const newOnes       = announcements.filter(a => !seen.has(a.id));

    logger.info(`[Agent] Found ${announcements.length} total, ${newOnes.length} new`);

    for (const ann of newOnes) {
      seen.add(ann.id);

      const result = await scoreAnnouncement(ann);
      logger.info(`[Agent] ${ann.ticker} → Score: ${result.score}/10 — ${result.verdict}`);

      await sendTelegramAlert(ann, result);
    }

    await saveSeen(seen);
  } catch (err) {
    logger.error('[Agent] Error:', err.message);
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '*/5 9-17 * * 1-5';

logger.info('🤖 Bursa Dividend Agent started');
logger.info(`📅 Dividend check schedule: ${CRON_SCHEDULE}`);
logger.info(`📡 FOMO crawler: 8am, 11am, 2pm, 5pm (Mon–Fri KL)`);
logger.info(`📢 Mode: Notify ALL — AI explains, you decide`);

if (isDemoMode()) {
  logger.info('🎭 DEMO MODE active — set valid ANTHROPIC_API_KEY for real AI scoring');
}

// Test Telegram connection on startup
try {
  await testTelegram();
} catch (err) {
  logger.warn('[Agent] Telegram test failed (agent will still run):', err.message);
}

// Start FOMO news crawler (runs on its own cron inside)
startFomoCrawler();

// Start dividend announcement checker
cron.schedule(CRON_SCHEDULE, runAgent, { timezone: 'Asia/Kuala_Lumpur' });

// Run dividend check immediately on start
runAgent();