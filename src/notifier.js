// ============================================
// NOTIFIER — Telegram Bot Alerts
// ============================================

import { Telegraf } from 'telegraf';
import { logger } from './logger.js';

let bot = null;

function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
      logger.info('✅ Telegram bot initialized');
    } catch (err) {
      logger.error('Failed to initialize Telegram bot:', err.message);
      return null;
    }
  }
  return bot;
}

// ── Test Telegram connection ──────────────────────────────────────────────────
export async function testTelegram() {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const b = getBot();

  logger.info(`🧪 Testing Telegram...`);
  logger.info(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✓ Set' : '✗ Missing'}`);
  logger.info(`   Chat ID: ${chatId ? '✓ Set (' + chatId + ')' : '✗ Missing'}`);

  if (!b || !chatId) {
    logger.error('❌ Telegram not configured. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
    return false;
  }

  try {
    const testMsg = '✅ Bursa Agent test message — if you see this, Telegram is working!';
    await b.telegram.sendMessage(chatId, testMsg);
    logger.info('✅ Telegram test message sent successfully');
    return true;
  } catch (err) {
    logger.error('❌ Telegram test failed:', err.message);
    logger.warn('Common issues:');
    logger.warn('   • Invalid bot token');
    logger.warn('   • Wrong chat ID');
    logger.warn('   • Bot not member of chat/group');
    logger.warn('   • Network connectivity issue');
    return false;
  }
}

// ── Send alert ────────────────────────────────────────────────────────────────
export async function sendTelegramAlert(ann, result) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const b = getBot();

  if (!b || !chatId) {
    logger.warn('⚠️  Telegram not configured — printing to console instead');
    logger.warn(`   TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✓' : '✗'}`);
    logger.warn(`   TELEGRAM_CHAT_ID: ${chatId ? '✓' : '✗'}`);
    printToConsole(ann, result);
    return;
  }

  const emoji = verdictEmoji(result.verdict);
  const scoreBar = buildScoreBar(result.score);

  const message = `
${emoji} *BURSA DIVIDEND ALERT*
━━━━━━━━━━━━━━━━━━━━
📌 *${ann.ticker}* — ${ann.company}
📋 ${ann.subject}
━━━━━━━━━━━━━━━━━━━━
🎯 Verdict: *${result.verdict}*
📊 Score: ${scoreBar} ${result.score}/10
💰 Est. Yield: ${result.dividendYield}
⏱️ Hold: ${result.suggestedHold}
━━━━━━━━━━━━━━━━━━━━
✅ *Why:* ${result.reason}
⚠️ *Risk:* ${result.risk}
━━━━━━━━━━━━━━━━━━━━
🔗 [View Announcement](${ann.url})
📅 ${ann.date}
  `.trim();

  try {
    logger.info(`📤 Sending Telegram alert for ${ann.ticker} to chat ${chatId}...`);
    await b.telegram.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    logger.info(`✅ Telegram alert sent successfully for ${ann.ticker}`);
  } catch (err) {
    logger.error(`❌ Telegram send failed for ${ann.ticker}:`, err.message);
    logger.warn('Falling back to console output...');
    printToConsole(ann, result);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function verdictEmoji(verdict) {
  const map = { BUY: '🟢', WATCH: '🟡', SKIP: '🔴', ERROR: '⚫' };
  return map[verdict] ?? '⚪';
}

function buildScoreBar(score) {
  const filled = '█'.repeat(score);
  const empty  = '░'.repeat(10 - score);
  return filled + empty;
}

function printToConsole(ann, result) {
  console.log('\n' + '='.repeat(50));
  console.log(`🚨 ALERT: ${ann.ticker} — ${result.verdict} (${result.score}/10)`);
  console.log(`📋 ${ann.subject}`);
  console.log(`💰 Yield: ${result.dividendYield} | Hold: ${result.suggestedHold}`);
  console.log(`✅ ${result.reason}`);
  console.log(`⚠️  ${result.risk}`);
  console.log(`🔗 ${ann.url}`);
  console.log('='.repeat(50) + '\n');
}
