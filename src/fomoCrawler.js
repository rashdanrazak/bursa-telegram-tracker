// ============================================
// FOMO CRAWLER — KLSE Screener news + stock data enrichment + AI digest
// ============================================

import axios from 'axios';
import * as cheerio from 'cheerio';
import cron from 'node-cron';
import { getClient, isDemoMode, MODEL } from './utils/claude.js';
import { HEADERS } from './scraper.js';
import { getBot } from './notifier.js';
import { logger } from './logger.js';

// Dedup — track news IDs already processed
const seenItems = new Set();

// ── Step 1: Crawl KLSE Screener news ─────────────────────────────────────────

async function crawlKlseNews() {
  const items = [];

  try {
    const res = await axios.get('https://www.klsescreener.com/v2/news', {
      headers: HEADERS,
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);

    // Main news feed
    $('h2').each((_, el) => {
      const anchor = $(el).find('a').first();
      const title  = anchor.text().trim();
      const href   = anchor.attr('href') || '';

      if (!title || !href) return;

      const match = href.match(/\/news\/view\/(\d+)\//);
      const id    = match ? match[1] : href;

      if (seenItems.has(id)) return;

      const fullUrl = href.startsWith('http') ? href : `https://www.klsescreener.com${href}`;
      items.push({ id, title, url: fullUrl, isHot: false });
    });

    // Hot News sidebar
    $('ul li a').each((_, el) => {
      const title = $(el).text().trim();
      const href  = $(el).attr('href') || '';

      if (!title || title.length < 10 || !href.includes('/news/view/')) return;

      const match = href.match(/\/news\/view\/(\d+)\//);
      const id    = match ? `hot-${match[1]}` : null;
      if (!id || seenItems.has(id)) return;

      const fullUrl = href.startsWith('http') ? href : `https://www.klsescreener.com${href}`;
      items.push({ id, title, url: fullUrl, isHot: true });
    });

    logger.info(`[FOMO] Crawled ${items.length} new items from KLSE Screener`);
  } catch (err) {
    logger.error('[FOMO] Failed to crawl KLSE Screener:', err.message);
  }

  return items;
}

// ── Step 2: Normalise headlines — translate Chinese, keep EN + BM ─────────────

function isChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

async function normaliseHeadlines(newsItems) {
  const client = getClient();

  // Split into chinese and non-chinese
  const chineseItems  = newsItems.filter(n => isChinese(n.title));
  const nonChinese    = newsItems.filter(n => !isChinese(n.title));

  if (chineseItems.length === 0) return newsItems;
  if (!client) {
    // No client — just drop Chinese items
    logger.warn('[FOMO] No API key — dropping Chinese headlines');
    return nonChinese;
  }

  // Batch translate Chinese headlines in one Claude call
  const toTranslate = chineseItems
    .map((n, i) => `${i + 1}. ${n.title}`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Translate these Bursa Malaysia news headlines from Chinese to English. Keep stock names, company names and financial terms accurate. Be concise — one line per headline.

${toTranslate}

Respond ONLY in this JSON format (no markdown):
{
  "translations": [
    { "index": 1, "title": "<translated headline>" }
  ]
}`,
      }],
    });

    const parsed = JSON.parse(response.content[0].text.trim());
    const map    = {};
    for (const t of parsed.translations ?? []) map[t.index] = t.title;

    // Apply translations back to Chinese items
    const translated = chineseItems.map((n, i) => ({
      ...n,
      title:       map[i + 1] ?? n.title,
      originalTitle: n.title,
    }));

    logger.info(`[FOMO] Translated ${translated.length} Chinese headlines`);
    return [...nonChinese, ...translated];

  } catch (err) {
    logger.warn('[FOMO] Translation failed — dropping Chinese headlines:', err.message);
    return nonChinese;
  }
}

// ── Step 3: Extract stock codes from headlines (Claude pass 2) ────────────────

async function extractStockCodes(newsItems) {
  if (isDemoMode()) return {};

  const client = getClient();
  if (!client) return {};

  const headlines = newsItems
    .map((n, i) => `${i + 1}. ${n.title}`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extract Bursa Malaysia stock codes from these headlines. Only include stocks you're confident about.

Headlines:
${headlines}

Respond ONLY in this JSON format (no markdown):
{
  "stocks": [
    { "index": 1, "code": "MAYBANK" },
    { "index": 3, "code": "ARMADA" }
  ]
}

If no stock is identifiable for a headline, skip it entirely.`,
      }],
    });

    const parsed = JSON.parse(response.content[0].text.trim());
    // Map: index -> stock code
    const map = {};
    for (const s of parsed.stocks ?? []) {
      map[s.index] = s.code;
    }
    return map;
  } catch (err) {
    logger.warn('[FOMO] Stock code extraction failed:', err.message);
    return {};
  }
}

// ── Step 4: Fetch stock data from KLSE Screener ───────────────────────────────

async function fetchStockData(stockCode) {
  try {
    const res = await axios.get(`https://www.klsescreener.com/v2/stocks/${stockCode.toLowerCase()}`, {
      headers: HEADERS,
      timeout: 8000,
    });

    const $ = cheerio.load(res.data);

    // Helpers to find value by label
    const findVal = (label) => {
      let val = '';
      $('td, th, .label, .value, span').each((_, el) => {
        const text = $(el).text().trim();
        if (text.toLowerCase().includes(label.toLowerCase())) {
          const next = $(el).next();
          if (next.length) val = next.text().trim();
        }
      });
      return val || 'N/A';
    };

    return {
      price:    findVal('price') || findVal('last'),
      change:   findVal('change') || findVal('chg'),
      pe:       findVal('p/e') || findVal('pe ratio'),
      weekHigh: findVal('52') || findVal('week high'),
      weekLow:  findVal('52 week low') || findVal('low'),
      volume:   findVal('volume') || findVal('vol'),
      avgVol:   findVal('avg vol') || findVal('average volume'),
    };
  } catch (err) {
    logger.warn(`[FOMO] Stock data fetch failed for ${stockCode}:`, err.message);
    return null;
  }
}

// ── Step 5: Claude FOMO analysis with enriched data (Claude pass 3) ───────────

async function analyseBatch(newsItems, stockCodeMap, stockDataMap) {
  const client = getClient();
  if (!client) {
    logger.warn('[FOMO] No API key — skipping analysis');
    return { fomoItems: [], marketMood: '' };
  }

  if (newsItems.length === 0) return { fomoItems: [], marketMood: '' };

  // Build enriched news list
  const newsList = newsItems.map((n, i) => {
    const idx        = i + 1;
    const stockCode  = stockCodeMap[idx];
    const stockData  = stockCode ? stockDataMap[stockCode] : null;

    let line = `${idx}. ${n.title}${n.isHot ? ' [HOT]' : ''}`;

    if (stockCode && stockData) {
      line += `\n   Stock: ${stockCode}`;
      if (stockData.price  !== 'N/A') line += ` | Price: RM${stockData.price}`;
      if (stockData.change !== 'N/A') line += ` (${stockData.change})`;
      if (stockData.pe     !== 'N/A') line += ` | PE: ${stockData.pe}`;
      if (stockData.weekHigh !== 'N/A' && stockData.weekLow !== 'N/A') {
        line += ` | 52wk: RM${stockData.weekLow}–RM${stockData.weekHigh}`;
      }
      if (stockData.volume !== 'N/A') line += ` | Vol: ${stockData.volume}`;
      if (stockData.avgVol !== 'N/A') line += ` | AvgVol: ${stockData.avgVol}`;
    } else if (stockCode) {
      line += `\n   Stock: ${stockCode} (price data unavailable)`;
    }

    return line;
  }).join('\n\n');

  const prompt = `You are a sharp Bursa Malaysia market analyst. Current market: HIGH VOLATILITY.

Latest news headlines from KLSE Screener with stock data where available:

${newsList}

Identify which headlines have FOMO potential for Bursa retail investors RIGHT NOW.

FOMO catalysts to flag:
- Contract wins, MOU signings
- Earnings surprise (beat or miss)
- Dividend above expectations or special dividend
- M&A, privatisation, takeover rumours
- Sector rally (e.g. gloves, O&G, construction)
- Director / substantial shareholder buying
- New business, expansion, JV, dual listing

When stock data is available, factor it into scoring:
- High volume vs avg volume = confirmation of interest
- Price near 52wk high = momentum play
- Low PE relative to sector = undervalued catalyst
- Already up big today = FOMO may be late, lower score

Respond ONLY in this exact JSON (no markdown):
{
  "fomoItems": [
    {
      "index": <number>,
      "stock": "<stock code or name>",
      "score": <1-10>,
      "verdict": "🔥 HIGH FOMO" or "⚠️ WATCH" or "😴 SKIP",
      "reason": "<one punchy sentence — why retail investors should care>",
      "catalyst": "<Contract Win | Sector Rally | M&A | Earnings | Dividend | Other>",
      "priceNote": "<one line on price action if data available, else omit>"
    }
  ],
  "marketMood": "<one line overall Bursa sentiment from this batch>"
}

Rules:
- Only include score >= 6
- Empty array if nothing interesting
- Be stingy — false alarms kill trust
- Prioritise stock-specific news over macro/general news`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    return JSON.parse(response.content[0].text.trim());
  } catch (err) {
    logger.error('[FOMO] Analysis failed:', err.message);
    return { fomoItems: [], marketMood: '' };
  }
}

// ── Step 5: Format digest ─────────────────────────────────────────────────────

function formatDigest(analysis, newsItems) {
  const { fomoItems = [], marketMood = '' } = analysis;
  if (fomoItems.length === 0) return null;

  const lines = fomoItems.map(item => {
    const news      = newsItems[item.index - 1];
    const title     = news?.title || '';
    const link      = news?.url ? `\n🔗 ${news.url}` : '';
    const priceNote = item.priceNote ? `\n📈 ${item.priceNote}` : '';

    return `${item.verdict} *${item.stock}*\n📌 ${title}\n💡 ${item.reason}\n🏷 ${item.catalyst}${priceNote}${link}`;
  });

  const now = new Date().toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return `📡 *FOMO DIGEST* — ${now}
━━━━━━━━━━━━━━━━━━
${lines.join('\n\n')}
━━━━━━━━━━━━━━━━━━
🧠 *Market mood:* ${marketMood}
_${fomoItems.length} pick(s) from ${newsItems.length} headlines scanned • Not financial advice_`;
}

// ── Step 6: Send to Telegram ──────────────────────────────────────────────────

async function sendDigest(message) {
  const b      = getBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!b || !chatId) {
    logger.warn('[FOMO] Telegram not configured — skipping');
    return;
  }

  await b.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  logger.info('[FOMO] Digest sent to Telegram');
}

// ── Main crawl cycle ──────────────────────────────────────────────────────────

export async function runFomoCrawl() {
  logger.info('[FOMO] Crawl cycle started...');

  try {
    // 1. Get fresh headlines
    const newsItems = await crawlKlseNews();
    if (newsItems.length === 0) {
      logger.info('[FOMO] No new items this cycle.');
      return;
    }

    // 2. Translate Chinese headlines, keep EN + BM
    const normalisedItems = await normaliseHeadlines(newsItems);
    logger.info(`[FOMO] After normalisation: ${normalisedItems.length} items`);

    // 3. Extract stock codes (Claude pass 2 — cheap)
    const stockCodeMap = await extractStockCodes(normalisedItems);
    const uniqueCodes  = [...new Set(Object.values(stockCodeMap))];
    logger.info(`[FOMO] Identified ${uniqueCodes.length} stocks: ${uniqueCodes.join(', ')}`);

    // 4. Fetch stock data (parallel)
    const stockDataMap = {};
    await Promise.allSettled(
      uniqueCodes.map(async (code) => {
        const data = await fetchStockData(code);
        if (data) stockDataMap[code] = data;
      })
    );
    logger.info(`[FOMO] Stock data fetched for ${Object.keys(stockDataMap).length} stocks`);

    // 5. Full FOMO analysis with enriched data (Claude pass 3)
    const analysis = await analyseBatch(normalisedItems, stockCodeMap, stockDataMap);

    // 6. Format and send
    const message = formatDigest(analysis, normalisedItems);
    if (!message) {
      logger.info('[FOMO] No FOMO picks this cycle — nothing sent.');
    } else {
      await sendDigest(message);
    }

    // 7. Mark all original items as seen
    newsItems.forEach(n => seenItems.add(n.id));

    // Trim cache to avoid memory bloat
    if (seenItems.size > 500) {
      const oldest = [...seenItems].slice(0, seenItems.size - 500);
      oldest.forEach(k => seenItems.delete(k));
    }
  } catch (err) {
    logger.error('[FOMO] Crawl cycle failed:', err.message);
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function startFomoCrawler() {
  logger.info('[FOMO] Crawler started — runs every 3 hours, Mon–Fri, KL time');

  // 8am, 11am, 2pm, 5pm KL time — Mon to Fri
  cron.schedule(
    '0 8,11,14,17 * * 1-5',
    () => runFomoCrawl(),
    { timezone: 'Asia/Kuala_Lumpur' }
  );

  runFomoCrawl();
}