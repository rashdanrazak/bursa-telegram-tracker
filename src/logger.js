// ============================================
// LOGGER — Simple console logger with timestamp
// ============================================

function timestamp() {
  return new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
}

export const logger = {
  info:  (...args) => console.log(`[${timestamp()}] ℹ️ `, ...args),
  warn:  (...args) => console.warn(`[${timestamp()}] ⚠️ `, ...args),
  error: (...args) => console.error(`[${timestamp()}] ❌`, ...args),
};
