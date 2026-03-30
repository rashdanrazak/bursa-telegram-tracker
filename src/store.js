// ============================================
// STORE — Track seen announcements (file-based)
// Refactor to Redis/SQLite later if needed
// ============================================

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from './logger.js';

const STORE_PATH = './logs/seen.json';

export async function loadSeen() {
  try {
    if (!existsSync(STORE_PATH)) return new Set();
    const raw = await readFile(STORE_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function saveSeen(seenSet) {
  try {
    // Keep only last 500 entries to prevent file bloat
    const arr = [...seenSet].slice(-500);
    await writeFile(STORE_PATH, JSON.stringify(arr, null, 2));
  } catch (err) {
    logger.error('Failed to save seen store:', err.message);
  }
}
