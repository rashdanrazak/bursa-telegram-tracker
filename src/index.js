// ============================================
// BURSA DIVIDEND AGENT - Main Entry Point
// ============================================
// npm install axios cheerio node-cron dotenv telegraf @anthropic-ai/sdk

import { config } from 'dotenv';

// Load environment variables BEFORE other imports
config();

import cron from 'node-cron';
import { scrapeAnnouncements } from './scraper.js';
import { scoreAnnouncement } from './scorer.js';
import { sendTelegramAlert, testTelegram } from './notifier.js';
import { loadSeen, saveSeen } from './store.js';
import { logger } from './logger.js';

// Check if running in demo mode
let DEMO_MODE;
if (process.env.DEMO_MODE !== undefined && process.env.DEMO_MODE !== '') {
  DEMO_MODE = process.env.DEMO_MODE === 'true';
} else {
  DEMO_MODE = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('xxxxxxxx');
}

// ── Main job ──────────────────────────────────────────────────────────────────
async function runAgent() {
  logger.info('🔍 Checking Bursa announcements...');

  try {
    const announcements = await scrapeAnnouncements();
    const seen = await loadSeen();
    const newOnes = announcements.filter(a => !seen.has(a.id));

    logger.info(`Found ${announcements.length} total, ${newOnes.length} new`);

    for (const ann of newOnes) {
      seen.add(ann.id);

      // AI scoring — full FOMO analysis
      const result = await scoreAnnouncement(ann);

      logger.info(`[${ann.ticker}] Score: ${result.score}/10 — ${result.verdict}`);

      // Notify ALL announcements — AI explains, you decide GO or NO GO
      await sendTelegramAlert(ann, result);
    }

    await saveSeen(seen);

  } catch (err) {
    logger.error('Agent error:', err.message);
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '*/5 9-17 * * 1-5';

logger.info(`🤖 Bursa Dividend Agent started`);
logger.info(`📅 Schedule: ${CRON_SCHEDULE}`);
logger.info(`📢 Mode: Notify ALL — AI explains, you decide`);
if (DEMO_MODE) {
  logger.info(`🎭 DEMO MODE: Using simulated scores (set valid ANTHROPIC_API_KEY to use real AI scoring)`);
}

// Test Telegram on startup
try {
  await testTelegram();
} catch (err) {
  logger.warn('Telegram test error (agent will still work):', err.message);
}

cron.schedule(CRON_SCHEDULE, runAgent, {
  timezone: 'Asia/Kuala_Lumpur'
});

// Run immediately on start
runAgent();