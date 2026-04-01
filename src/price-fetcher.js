// ============================================
// PRICE FETCHER — Get current stock prices
// ============================================

import axios from 'axios';
import { getYahooSymbol } from './bursa-lookup.js';
import { logger } from './logger.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Cache to avoid repeated API calls within 5 minutes
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch current stock price from Yahoo Finance API
 * @param {string} ticker - Stock ticker (e.g., "TOPGLOV")
 * @returns {Promise<{price: number, currency: string} | null>}
 */
export async function getCurrentPrice(ticker) {
  try {
    // Check cache first
    const cached = priceCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug(`[PriceFetcher] Using cached price for ${ticker}: RM${cached.price}`);
      return { price: cached.price, currency: 'RM' };
    }

    // Get Yahoo symbol
    const yahooSymbol = await getYahooSymbol(ticker);
    if (!yahooSymbol) {
      logger.warn(`[PriceFetcher] Could not get Yahoo symbol for ${ticker}`);
      return null;
    }

    // Fetch from Yahoo Finance API
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=price`;
    
    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: 8000,
    });

    const priceData = response.data?.quoteSummary?.result?.[0]?.price;
    if (!priceData || priceData.regularMarketPrice === undefined) {
      logger.warn(`[PriceFetcher] Invalid price data for ${ticker}`);
      return null;
    }

    const price = priceData.regularMarketPrice;
    const currency = priceData.currency || 'RM';

    // Cache the result
    priceCache.set(ticker, {
      price,
      timestamp: Date.now(),
    });

    logger.debug(`[PriceFetcher] Fetched price for ${ticker}: ${currency}${price.toFixed(2)}`);
    return { price, currency };
  } catch (err) {
    logger.warn(`[PriceFetcher] Failed to fetch price for ${ticker}:`, err.message);
    return null;
  }
}

/**
 * Calculate dividend yield based on current price
 * @param {number} dividendCent - Dividend in cents
 * @param {number} currentPrice - Current price in RM
 * @returns {number} Yield percentage
 */
export function calculateDividendYield(dividendCent, currentPrice) {
  if (!currentPrice || currentPrice <= 0) return 0;
  const dividendRM = dividendCent / 100;
  return (dividendRM / currentPrice) * 100;
}
