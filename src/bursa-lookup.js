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
    // Try direct URL pattern: Bursa uses /stock/tickername
    const url = `https://www.bursamalaysia.com/market_information/announcements?stock_code=${ticker}`;
    
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 8000,
    });

    const $ = cheerio.load(res.data);
    
    // Look for security code in page data, meta tags, or script tags
    let code = null;

    // Try data attribute in body or main container
    code = $('body').attr('data-security-id');
    if (code) {
      codeCache.set(ticker, code);
      logger.info(`[BursaLookup] Found code for ${ticker}: ${code}`);
      return code;
    }

    // Try searching in JavaScript variables or data
    const scripts = $('script').text();
    const match = scripts.match(/securityCode['":\s]*["']?(\d{4,5})["']?/i);
    if (match) {
      code = match[1];
      codeCache.set(ticker, code);
      logger.debug(`[BursaLookup] Found code for ${ticker}: ${code}`);
      return code;
    }

    // Try the announcement link structure
    const announcementLink = $('a[href*="securityCode"]').attr('href');
    if (announcementLink) {
      const codeMatch = announcementLink.match(/securityCode=(\d+)/);
      if (codeMatch) {
        code = codeMatch[1];
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
 * First tries hardcoded map, then fetches from Bursa, then guesses
 * @param {string} ticker - Stock ticker (e.g., "TOPGLOV")
 * @returns {string|null} Yahoo symbol (e.g., "7113.KL") or null if not found
 */
export async function getYahooSymbol(ticker) {
  // Step 1: Try to get security code from Bursa
  const code = await fetchSecurityCode(ticker);
  
  if (code) {
    const symbol = `${code}.KL`;
    logger.info(`[BursaLookup] ${ticker} → ${symbol}`);
    return symbol;
  }

  // Step 2: If lookup fails, return null (will skip)
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
