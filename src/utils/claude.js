// ============================================
// UTILS — Shared Claude client
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../logger.js';

export const MODEL = 'claude-sonnet-4-20250514';

export function isDemoMode() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.DEMO_MODE !== undefined && process.env.DEMO_MODE !== '') {
    return process.env.DEMO_MODE === 'true';
  }
  return !apiKey?.trim() || apiKey.includes('xxxxxxxx');
}

export function getClient() {
  if (isDemoMode()) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    return new Anthropic({ apiKey });
  } catch (err) {
    logger.error('[Claude] Failed to initialize client:', err.message);
    return null;
  }
}