# 🤖 Bursa Dividend Agent

AI-powered Bursa Malaysia dividend announcement monitor.
Scrapes announcements → AI scores them → Notifies via Telegram.

## Architecture

```
Bursa/i3investor → Scraper → AI Scorer (Claude) → Telegram Bot
                                    ↓
                              seen.json (dedup)
```

## Setup

### 1. Install dependencies
```bash
npm install axios cheerio node-cron dotenv telegraf @anthropic-ai/sdk
```

### 2. Configure env
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Get your keys

**Anthropic API key:**
- Go to https://console.anthropic.com
- Create API key

**Telegram Bot:**
- Message @BotFather on Telegram
- /newbot → follow instructions → copy token
- Message @userinfobot to get your Chat ID

### 4. Run
```bash
# Dev mode (auto-restart on file change)
npm run dev

# Production
npm start
```

## File Structure

```
src/
├── index.js      ← Main entry, cron scheduler
├── scraper.js    ← Bursa + i3investor scraper
├── scorer.js     ← Claude AI scoring
├── notifier.js   ← Telegram alerts
├── store.js      ← Seen announcements tracker
└── logger.js     ← Console logger
logs/
└── seen.json     ← Auto-generated, tracks seen IDs
```

## Telegram Alert Format

```
🟢 BURSA DIVIDEND ALERT
━━━━━━━━━━━━━━━━━━━━
📌 MAYBANK — Malayan Banking Bhd
📋 Declaration of Final Dividend 32 sen
━━━━━━━━━━━━━━━━━━━━
🎯 Verdict: BUY
📊 Score: ████████░░ 8/10
💰 Est. Yield: 5.8%
⏱️ Hold: 1-2 days
━━━━━━━━━━━━━━━━━━━━
✅ Why: Blue chip, high yield, strong buying pressure expected
⚠️ Risk: Already priced in if announced after market hours
━━━━━━━━━━━━━━━━━━━━
🔗 View Announcement
```

## Scoring Criteria (0-10)

| Factor | Weight |
|--------|--------|
| Dividend yield attractiveness | 0-3 |
| Company fundamentals (large cap, liquid) | 0-2 |
| Surprise factor (special/unexpected dividend) | 0-2 |
| Historical pattern (blue chip tendency) | 0-2 |
| Timing (proximity to ex-date) | 0-1 |

**Threshold guide:**
- 7-10 → BUY 🟢
- 4-6  → WATCH 🟡
- 0-3  → SKIP 🔴

## Roadmap

- [x] Step 1: Node.js prototype
- [ ] Step 2: Add SQLite for trade logging + win rate tracking
- [ ] Step 3: Backtest module (historical data replay)
- [ ] Step 4: Refactor to Go (faster, lower memory)
