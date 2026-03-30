// ============================================
// SCORER — AI scoring via Claude API
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

const SYSTEM_PROMPT = `You are a Malaysian stock market analyst specializing in Bursa Malaysia dividend announcement plays.

STRATEGY CONTEXT:
The goal is NOT to collect dividend. The goal is to ride the FOMO wave AFTER announcement and EXIT before ex-date.
Example: FPI announced 80 sen special dividend → retail investors FOMO-ed in → price spiked → smart money exited before ex-date → ex-date price dropped 80 sen.

Your job: Score the likelihood that retail FOMO will push price up 5%+ within 1-3 trading days after announcement.

SCORING CRITERIA (0-10):

1. FOMO Magnitude [0-4] — most important factor
   - Dividend size relative to share price (DPS/price ratio): >10% = 4pts, 5-10% = 3pts, 2-5% = 2pts, <2% = 0pts
   - Absolute dividend amount: >10 sen = high excitement, 1-5 sen = moderate, <1 sen = low excitement
   - Dividend type: Special/Final = higher surprise factor, Interim = lower

2. Company Profile [0-3]
   - Large cap, well-known brand (Maybank, CIMB, Tenaga, IGB REIT, Sunway REIT etc) = more retail eyeballs = more FOMO
   - Mid cap with loyal following = moderate
   - Unknown small cap = low FOMO even with high yield

3. Timing Urgency [0-2]
   - Ex-date within 2 weeks = urgency buying pressure
   - Ex-date 2-4 weeks = moderate
   - Ex-date >4 weeks = low urgency

4. Announcement Surprise [0-1]
   - Unexpected, higher than usual, or first-time dividend = bonus point

HARD RULES — these override scoring:
- Dividend below 1 sen per share → MAX score 3, verdict SKIP (too small to generate excitement)
- Unknown micro-cap, no retail following → MAX score 4
- Dividend yield below 2% of share price → penalize heavily
- Score 7-10 = BUY (high FOMO probability)
- Score 4-6 = WATCH (possible play, assess manually)  
- Score 0-3 = SKIP (not worth the risk)

Respond ONLY in this exact JSON format, no markdown, no preamble:
{
  "score": 7,
  "verdict": "BUY",
  "dividend_yield_est": "6.2%",
  "dps_to_price_ratio": "8.5%",
  "fomo_magnitude": "High — 8 sen dividend on RM0.95 stock",
  "company_profile": "Mid-cap, moderate retail following",
  "timing_urgency": "Ex-date in 12 days — urgency buying expected",
  "surprise_factor": "Final dividend, higher than last year",
  "reason": "One line summary why this is a good play",
  "risk": "One line main risk",
  "suggested_hold": "1-2 days",
  "suggested_exit": "Before ex-date on DD MMM YY"
}`;

// ── Demo mode helpers ─────────────────────────────────────────────────────────
function isDemoMode() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.DEMO_MODE !== undefined && process.env.DEMO_MODE !== '') {
    return process.env.DEMO_MODE === 'true';
  }
  return !apiKey?.trim() || apiKey.includes('xxxxxxxx');
}

function getClient() {
  if (isDemoMode()) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    return new Anthropic({ apiKey });
  } catch (err) {
    logger.error('Failed to initialize Anthropic client:', err.message);
    return null;
  }
}

// ── Demo scores ───────────────────────────────────────────────────────────────
const DEMO_SCORES = {
  'MAYBANK': {
    score: 9, verdict: 'BUY',
    dividendYield: '5.8%', dpsToPriceRatio: '5.8%',
    fomoMagnitude: 'Very High — 32 sen dividend, most followed bank stock',
    companyProfile: 'Large cap, massive retail following',
    timingUrgency: 'Ex-date in 10 days — urgency buying expected',
    surpriseFactor: 'Final dividend, consistent payer',
    reason: 'Maybank announcements always trigger heavy retail buying within hours',
    risk: 'Already partially priced in if announced after market hours',
    suggestedHold: '1-2 days', suggestedExit: 'Before ex-date',
  },
  'DRBHCOM': {
    score: 7, verdict: 'BUY',
    dividendYield: '6.5%', dpsToPriceRatio: '6.2%',
    fomoMagnitude: 'High — 2.5 sen, recognizable brand',
    companyProfile: 'Mid-large cap, decent retail following',
    timingUrgency: 'Ex-date in 12 days',
    surpriseFactor: 'Final dividend',
    reason: 'Recognizable conglomerate, decent FOMO expected',
    risk: 'Lower retail interest vs banking stocks',
    suggestedHold: '1-2 days', suggestedExit: 'Before ex-date',
  },
  'SNS': {
    score: 2, verdict: 'SKIP',
    dividendYield: '1.6%', dpsToPriceRatio: '0.6%',
    fomoMagnitude: 'Very Low — only 0.25 sen on RM0.425 stock',
    companyProfile: 'Small-mid cap, limited retail following',
    timingUrgency: 'Ex-date in 5 weeks — low urgency',
    surpriseFactor: 'Routine interim dividend, 4th of the year',
    reason: '0.25 sen dividend too small to generate meaningful FOMO',
    risk: 'Price may not move at all',
    suggestedHold: 'N/A', suggestedExit: 'N/A',
  },
};

const DEFAULT_DEMO = {
  score: 5, verdict: 'WATCH',
  dividendYield: '4.0%', dpsToPriceRatio: '3.5%',
  fomoMagnitude: 'Moderate',
  companyProfile: 'Mid-cap, some retail following',
  timingUrgency: 'Ex-date in 2-3 weeks',
  surpriseFactor: 'Routine dividend',
  reason: 'Moderate FOMO play — assess manually',
  risk: 'Insufficient data for confident scoring',
  suggestedHold: '1-2 days', suggestedExit: 'Before ex-date',
};

// ── Main scorer ───────────────────────────────────────────────────────────────
export async function scoreAnnouncement(ann) {
  if (isDemoMode()) {
    logger.info(`📊 DEMO MODE: Scoring ${ann.ticker}...`);
    return DEMO_SCORES[ann.ticker] ?? DEFAULT_DEMO;
  }

  const client = getClient();
  if (!client) {
    logger.error(`No valid API key — skipping ${ann.ticker}`);
    return { score: 0, verdict: 'ERROR', reason: 'API not configured', risk: 'Unknown', suggestedHold: 'N/A' };
  }

  try {
    const prompt = `
Announcement details:
- Ticker: ${ann.ticker}
- Company: ${ann.company}
- Subject: ${ann.subject}
- Dividend: ${ann.dividendCent ?? 'N/A'} sen per share
- Announcement Date: ${ann.date}
- Ex-Date: ${ann.exDate ?? 'N/A'}
- Payment Date: ${ann.paymentDate ?? 'N/A'}
- Type: ${ann.type ?? 'N/A'}
- URL: ${ann.url}

Score this for retail FOMO probability and 5% price pop within 1-3 days.
`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const parsed = JSON.parse(text);

    return {
      score:          parsed.score ?? 0,
      verdict:        parsed.verdict ?? 'SKIP',
      dividendYield:  parsed.dividend_yield_est ?? 'N/A',
      dpsToPriceRatio: parsed.dps_to_price_ratio ?? 'N/A',
      fomoMagnitude:  parsed.fomo_magnitude ?? 'N/A',
      companyProfile: parsed.company_profile ?? 'N/A',
      timingUrgency:  parsed.timing_urgency ?? 'N/A',
      surpriseFactor: parsed.surprise_factor ?? 'N/A',
      reason:         parsed.reason ?? '',
      risk:           parsed.risk ?? '',
      suggestedHold:  parsed.suggested_hold ?? '1-3 days',
      suggestedExit:  parsed.suggested_exit ?? 'Before ex-date',
    };

  } catch (err) {
    logger.error(`Scoring failed for ${ann.ticker}:`, err.message);
    return { score: 0, verdict: 'ERROR', reason: 'Scoring failed', risk: 'Unknown', suggestedHold: 'N/A' };
  }
}