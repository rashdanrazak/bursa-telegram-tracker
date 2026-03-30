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
// Respect explicit DEMO_MODE setting
let DEMO_MODE;
if (process.env.DEMO_MODE !== undefined && process.env.DEMO_MODE !== '') {
  DEMO_MODE = process.env.DEMO_MODE === 'true';
} else {
  // Auto-detect: demo mode if no valid API key
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

      // AI scoring — returns { score, verdict, reason }
      const result = await scoreAnnouncement(ann);

      logger.info(`[${ann.ticker}] Score: ${result.score}/10 — ${result.verdict}`);

      // Only notify if score >= threshold (configurable)
      const threshold = parseInt(process.env.SCORE_THRESHOLD ?? '6');
      if (result.score >= threshold) {
        await sendTelegramAlert(ann, result);
        logger.info(`✅ Alert sent for ${ann.ticker}`);
      }
    }

    await saveSeen(seen);

  } catch (err) {
    logger.error('Agent error:', err.message);
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────
// Run every 5 mins, Mon-Fri, 9am-5:30pm KL time
// Adjust cron expression as needed
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? '*/5 9-17 * * 1-5';

logger.info(`🤖 Bursa Dividend Agent started`);
logger.info(`📅 Schedule: ${CRON_SCHEDULE}`);
logger.info(`🎯 Score threshold: ${process.env.SCORE_THRESHOLD ?? '6'}/10`);
if (DEMO_MODE) {
  logger.info(`🎭 DEMO MODE: Using simulated scores (set valid ANTHROPIC_API_KEY to use real AI scoring)`);
}

// Test Telegram connection on startup (non-blocking)
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
