#!/bin/bash
# ============================================
# BURSA AGENT — macOS startup script
# Prevents sleep + runs bot with auto-restart
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/agent.log"

echo "🤖 Starting Bursa Agent..."
echo "📁 Directory: $SCRIPT_DIR"
echo "📝 Logs: $LOG_FILE"
echo ""

# Prevent macOS from sleeping while script runs
# -i = prevent idle sleep, -s = prevent system sleep
caffeinate -is &
CAFFEINATE_PID=$!
echo "☕ caffeinate started (PID: $CAFFEINATE_PID)"

# Cleanup on exit — kill caffeinate when script stops
cleanup() {
  echo ""
  echo "🛑 Stopping agent..."
  kill $CAFFEINATE_PID 2>/dev/null
  echo "✅ Done."
  exit 0
}
trap cleanup SIGINT SIGTERM

STOP_HOUR=18  # Stop at 6pm

# Auto-restart loop — if bot crashes, restart after 10s
while true; do
  # Check if past stop time
  CURRENT_HOUR=$(date +%H)
  if [ "$CURRENT_HOUR" -ge "$STOP_HOUR" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⏰ Past 6pm — shutting down."
    break
  fi

  echo ""
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting npm run start..."

  npm --prefix "$SCRIPT_DIR" run start 2>&1 | tee -a "$LOG_FILE" &
  BOT_PID=$!

  # Watch for 6pm while bot is running
  while kill -0 $BOT_PID 2>/dev/null; do
    CURRENT_HOUR=$(date +%H)
    if [ "$CURRENT_HOUR" -ge "$STOP_HOUR" ]; then
      echo ""
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⏰ 6pm — stopping bot..."
      kill $BOT_PID 2>/dev/null
      wait $BOT_PID 2>/dev/null
      break
    fi
    sleep 60  # Check every minute
  done

  wait $BOT_PID 2>/dev/null
  EXIT_CODE=$?

  # If past 6pm, exit loop
  CURRENT_HOUR=$(date +%H)
  if [ "$CURRENT_HOUR" -ge "$STOP_HOUR" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⏰ Past 6pm — shutting down."
    break
  fi

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Clean exit — not restarting."
    break
  fi

  echo "⚠️  Crashed — restarting in 10 seconds... (Ctrl+C to stop)"
  sleep 10
done

cleanup