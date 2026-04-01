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
    await b.telegram.sendMessage(chatId, '✅ Bursa Agent test message — if you see this, Telegram is working!');
    logger.info('✅ Telegram test message sent successfully');
    return true;
  } catch (err) {
    logger.error('❌ Telegram test failed:', err.message);
    logger.warn('Common issues:');
    logger.warn('   • Invalid bot token');
    logger.warn('   • Wrong chat ID');
    logger.warn('   • Bot not member of chat/group');
    return false;
  }
}

// ── Send alert — notify ALL announcements, AI explains, you decide ────────────
export async function sendTelegramAlert(ann, result, priceInfo = null) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const b = getBot();

  if (!b || !chatId) {
    logger.warn('⚠️  Telegram not configured — printing to console instead');
    printToConsole(ann, result, priceInfo);
    return;
  }

  const scoreBar   = buildScoreBar(result.score);
  const verdictLine = buildVerdictLine(result.score);
  const priceSection = priceInfo ? `💰 Current Price: *RM${priceInfo.price.toFixed(2)}* (${priceInfo.yield.toFixed(2)}% yield)\n` : '';

  const message = `
📢 *BURSA DIVIDEND — NEW ANNOUNCEMENT*
━━━━━━━━━━━━━━━━━━━━
📌 *${escMd(ann.ticker)}* — ${escMd(ann.company)}
📋 ${escMd(ann.subject)}
📅 Ann: ${escMd(ann.date)} \\| Ex\\-Date: ${escMd(ann.exDate ?? 'TBC')}
${priceSection}💵 Dividend: *${escMd(ann.dividendCent ?? 'N/A')} sen*
━━━━━━━━━━━━━━━━━━━━
*🤖 AI FOMO ANALYSIS*
${verdictLine}
📊 Score: ${scoreBar} *${escMd(result.score)}/10*

🔥 *FOMO Magnitude*
${escMd(result.fomoMagnitude ?? 'N/A')}

🏢 *Company Profile*
${escMd(result.companyProfile ?? 'N/A')}

⏰ *Timing Urgency*
${escMd(result.timingUrgency ?? 'N/A')}

😲 *Surprise Factor*
${escMd(result.surpriseFactor ?? 'N/A')}
━━━━━━━━━━━━━━━━━━━━
✅ *Why play:* ${escMd(result.reason)}
⚠️ *Risk:* ${escMd(result.risk)}
🚪 *Exit:* ${escMd(result.suggestedExit ?? 'Before ex-date')}
━━━━━━━━━━━━━━━━━━━━
🔗 [View on i3investor](${ann.url})
  `.trim();

  try {
    logger.info(`📤 Sending Telegram alert for ${ann.ticker}...`);
    await b.telegram.sendMessage(chatId, message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });
    logger.info(`✅ Alert sent for ${ann.ticker}`);
  } catch (err) {
    logger.error(`❌ Telegram send failed for ${ann.ticker}:`, err.message);
    printToConsole(ann, result);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escMd(text) {
  return String(text ?? '').replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

function buildVerdictLine(score) {
  if (score >= 7) return '🟢 *GO* — High FOMO probability';
  if (score >= 4) return '🟡 *WATCH* — Moderate, your call';
  return '🔴 *NO GO* — Low FOMO expected';
}

function buildScoreBar(score) {
  const filled = '█'.repeat(score);
  const empty  = '░'.repeat(10 - score);
  return `${filled}${empty}`;
}

function printToConsole(ann, result, priceInfo = null) {
  console.log('\n' + '='.repeat(50));
  console.log(`📢 ${ann.ticker} — ${ann.dividendCent ?? 'N/A'} sen | Ex: ${ann.exDate ?? 'TBC'}`);
  if (priceInfo) {
    console.log(`💰 Current Price: RM${priceInfo.price.toFixed(2)} (${priceInfo.yield.toFixed(2)}% yield)`);
  }
  console.log(`📋 ${ann.subject}`);
  console.log(`🤖 Score: ${result.score}/10 — ${buildVerdictLine(result.score)}`);
  console.log(`🔥 FOMO: ${result.fomoMagnitude}`);
  console.log(`🏢 Profile: ${result.companyProfile}`);
  console.log(`⏰ Urgency: ${result.timingUrgency}`);
  console.log(`✅ ${result.reason}`);
  console.log(`⚠️  ${result.risk}`);
  console.log(`🔗 ${ann.url}`);
  console.log('='.repeat(50) + '\n');
}


export { getBot };