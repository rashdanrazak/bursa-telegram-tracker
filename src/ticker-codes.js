/**
 * Ticker to Security Code Mapping
 * Get security codes from: https://www.bursamalaysia.com/
 * Example: SNS = 0259 means https://klse.i3investor.com/web/stock/entitlement/0259
 */

export const TICKER_TO_CODE = {
  'SNS': '0259',
  'CETECH': '0189',
  'MAYBANK': '1155',
  'CIMB': '1023',
  'RHB': '1066',
  'TM': '4863',
  'TENAGA': '0038',
  'AXIATA': '0675',
  // Add more mappings as you discover them
  // Format: 'TICKER': 'securityCode'
};

export function getSecurityCode(ticker) {
  return TICKER_TO_CODE[ticker] || null;
}
