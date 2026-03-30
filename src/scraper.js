// ============================================
// SCRAPER — Bursa Malaysia Dividend Announcements
// ============================================
// Primary:  malaysiastock.biz/Dividend.aspx
// Fallback: klse.i3investor.com/web/entitlement/dividend/latest

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger.js';

const MSB_URL = 'https://www.malaysiastock.biz/Dividend.aspx';
const I3_URL  = 'https://klse.i3investor.com/web/entitlement/dividend/latest';

export const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── Main scraper ──────────────────────────────────────────────────────────────

export async function scrapeAnnouncements() {
  const results = [];

  // Primary: malaysiastock.biz
  try {
    const msb = await scrapeMalaysiaStock();
    results.push(...msb);
    logger.info(`[Scraper] malaysiastock.biz: ${msb.length} announcements`);
  } catch (err) {
    logger.warn('[Scraper] malaysiastock.biz failed:', err.message);
  }

  // Fallback: i3investor
  if (results.length === 0) {
    try {
      const i3 = await scrapeI3investor();
      results.push(...i3);
      logger.info(`[Scraper] i3investor fallback: ${i3.length} announcements`);
    } catch (err) {
      logger.warn('[Scraper] i3investor failed:', err.message);
    }
  }

  return results;
}

// ── malaysiastock.biz ─────────────────────────────────────────────────────────
// Columns: Date | Stock | Ex-Date | Entitlement Date | Payment Date | Type | Dividend(Cent) | Dividend(%)

async function scrapeMalaysiaStock() {
  const res = await axios.get(MSB_URL, { headers: HEADERS, timeout: 10000 });
  const $ = cheerio.load(res.data);
  const results = [];

  $('table tr').each((_, row) => {
    const cols = $(row).find('td');
    if (cols.length < 7) return;

    const annDate = $(cols[0]).text().trim();
    const ticker  = $(cols[1]).text().trim();
    const exDate  = $(cols[2]).text().trim();
    const entDate = $(cols[3]).text().trim();
    const payDate = $(cols[4]).text().trim();
    const type    = $(cols[5]).text().trim();
    const divCent = $(cols[6]).text().trim();

    // Extract security code from onclick: securityCode=0259
    const onclick = $(cols[1]).attr('onclick') || '';
    const codeMatch = onclick.match(/securityCode=(\d+)/);
    const securityCode = codeMatch ? codeMatch[1] : null;

    if (!ticker || !annDate || !/\d/.test(annDate)) return;
    if (ticker.toLowerCase() === 'stock') return;
    if (!/^[A-Z0-9]{1,6}$/.test(ticker)) return;
    if (/^\d+$/.test(ticker)) return;

    const url = securityCode
      ? `https://klse.i3investor.com/web/stock/entitlement/${securityCode}`
      : `https://klse.i3investor.com/web/stock/${ticker}`;

    results.push({
      id: `msb_${ticker}_${exDate}_${divCent}`.replace(/[\s/]/g, '_'),
      source: 'malaysiastock',
      ticker,
      company: ticker,
      subject: `${type} — ${divCent} sen`.trim(),
      date: annDate,
      exDate,
      entitlementDate: entDate,
      paymentDate: payDate,
      dividendCent: divCent,
      type,
      url,
    });
  });

  return results;
}

// ── i3investor fallback ───────────────────────────────────────────────────────
// Columns: Ann Date | Ex Date | Stock | Company | DPS (sen) | Type | Payment Date

async function scrapeI3investor() {
  const res = await axios.get(I3_URL, { headers: HEADERS, timeout: 10000 });
  const $ = cheerio.load(res.data);
  const results = [];

  $('table tbody tr').each((_, row) => {
    const cols = $(row).find('td');
    if (cols.length < 5) return;

    const annDate = $(cols[0]).text().trim();
    const exDate  = $(cols[1]).text().trim();
    const ticker  = $(cols[2]).text().trim().split(/\s/)[0];
    const company = $(cols[3]).text().trim();
    const dps     = $(cols[4]).text().trim();
    const type    = $(cols[5])?.text().trim() ?? '';
    const href    = $(cols[2]).find('a').attr('href') ?? '';

    if (!ticker || !annDate) return;

    const url = href
      ? (href.startsWith('http') ? href : `https://klse.i3investor.com${href}`)
      : `https://klse.i3investor.com/web/stock/${ticker}`;

    results.push({
      id: `i3_${ticker}_${exDate}_${dps}`.replace(/[\s/]/g, '_'),
      source: 'i3investor',
      ticker,
      company,
      subject: `${type || 'Dividend'} ${dps ? dps + ' sen' : ''}`.trim(),
      date: annDate,
      exDate,
      dividendCent: dps,
      type,
      url,
    });
  });

  return results;
}