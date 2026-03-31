/**
 * Bursa Malaysia Stock Lookup
 * Dynamically fetch security codes for any ticker from Bursa Malaysia
 * Ticker → Security Code → Yahoo Symbol (123.KL)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Cache: ticker → securityCode
const codeCache = new Map();

// Common Bursa stocks mapping (fallback if lookup fails)
const COMMON_STOCKS = {
  'MAYBANK': '1155',
  'TOPGLOV': '7113',
  'AIRASIA': '5099',
  'CIMB': '1023',
  'RHB': '1066',
  'TENAGA': '0038',
  'TM': '4863',
  'IJM': '3336',
  'ARMADA': '5106',
  'VANTAGE': '5104',
  'PCHEM': '3182',
  'AAX': '5012',
  'GASMSIA': '5208',
};

/**
 * Fetch security code for a ticker from Bursa Malaysia's stock page
 * @param {string} ticker - Stock ticker (e.g., "TOPGLOV")
 * @returns {string|null} Security code (e.g., "7113") or null if not found
 */
async function fetchSecurityCode(ticker) {
  if (codeCache.has(ticker)) {
    return codeCache.get(ticker);
  }

  try {
    // Try i3investor which already works in the scraper
    const url = `https://klse.i3investor.com/web/stock/${ticker}`;
    
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 8000,
    });

    const $ = cheerio.load(res.data);
    
    // Look for security code in URL or page elements
    let code = null;

    // Try extracting from URL in page meta
    const pageUrl = $('meta[property="og:url"]').attr('content') || $('link[rel="canonical"]').attr('href') || '';
    if (pageUrl.includes('/stock/')) {
      const match = pageUrl.match(/\/stock\/(\d+)/);
      if (match) {
        code = match[1];
        codeCache.set(ticker, code);
        logger.info(`[BursaLookup] Found code for ${ticker}: ${code}`);
        return code;
      }
    }

    // Try finding in any link on page that has /stock/numeric
    const links = $('a[href*="/stock/"]');
    if (links.length > 0) {
      const link = links.first().attr('href') || '';
      const match = link.match(/\/stock\/(\d{4,5})/);
      if (match) {
        code = match[1];
        codeCache.set(ticker, code);
        logger.info(`[BursaLookup] Found code for ${ticker}: ${code}`);
        return code;
      }
    }

    return null;
  } catch (err) {
    logger.warn(`[BursaLookup] Failed to fetch code for ${ticker}:`, err.message);
    return null;
  }
}

/**
 * Convert ticker to Yahoo Finance symbol
 * First fetches from i3investor, then falls back to hardcoded mapping
 * @param {string} ticker - Stock ticker (e.g., "TOPGLOV")
 * @returns {string|null} Yahoo symbol (e.g., "7113.KL") or null if not found
 */
export async function getYahooSymbol(ticker) {
  // Step 1: Try to get security code from i3investor
  let code = await fetchSecurityCode(ticker);
  
  // Step 2: Fall back to hardcoded mapping
  if (!code && COMMON_STOCKS[ticker]) {
    code = COMMON_STOCKS[ticker];
    logger.info(`[BursaLookup] Using fallback mapping for ${ticker}: ${code}`);
  }

  if (code) {
    const symbol = `${code}.KL`;
    logger.info(`[BursaLookup] ${ticker} → ${symbol}`);
    return symbol;
  }

  // Step 3: If lookup fails, return null (will skip)
  return null;
}

/**
 * Force-refresh the cache for a ticker (useful after manual lookups)
 */
export function clearTickerCache(ticker) {
  if (ticker) {
    codeCache.delete(ticker);
  } else {
    codeCache.clear();
  }
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    size: codeCache.size,
    tickers: Array.from(codeCache.keys()),
  };
}
