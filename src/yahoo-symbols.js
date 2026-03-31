/**
 * Hardcoded Bursa Malaysia → Yahoo Finance Symbol Mapping
 * Some stocks don't resolve well via Yahoo Search API, so we map them directly
 * Format: TICKER → yahooSymbol (e.g., "7113.KL")
 * 
 * To find Yahoo symbols:
 * 1. Visit https://finance.yahoo.com
 * 2. Search "TICKER Bursa" or "TICKER Malaysia"
 * 3. Check the URL or symbol field — it's usually CODE.KL
 * 4. Or search: https://query1.finance.yahoo.com/v1/finance/search?q=TICKER%20Bursa%20Malaysia
 */

export const BURSA_YAHOO_SYMBOLS = {
  // Banking & Finance
  'MAYBANK':     '1155.KL',
  'CIMB':        '1023.KL',
  'RHB':         '1066.KL',
  'BIMB':        '5258.KL',
  'AFFIN':       '5185.KL',
  'AMBANK':      '8846.KL',
  'ABMB':        '5096.KL',

  // Utilities & Energy
  'TENAGA':      '0038.KL',
  'PETRONM':     '3182.KL',
  'DIALOG':      '7497.KL',

  // Telecoms
  'TM':          '4863.KL',
  'AXIATA':      '0675.KL',
  'MAXIS':       '6012.KL',
  'DIGI':        '6947.KL',

  // Construction & Infrastructure
  'IJM':         '3336.KL',
  'WCT':         '6204.KL',
  'GAMUDA':      '5398.KL',
  'UEM':         '8163.KL',

  // Technology
  'SCIENTX':     '3697.KL',
  'EUPE':        '0206.KL',
  'INSGROUP':    '1140.KL',

  // Transport & Logistics
  'AIRASIA':     '5099.KL',
  'AirAsia X':   '5212.KL',

  // Oil & Gas
  'VANTAGE':     '5104.KL',
  'ARMADA':      '5106.KL',
  'SERBADK':     '0138.KL',

  // Chemicals & Materials
  'PCHEM':       '5185.KL',
  'INECOS':      '5218.KL',

  // Rubber & Gloves
  'TOPGLOV':     '7113.KL',
  'KOSSAN':      '7153.KL',
  'KOON':        '7121.KL',
  'HARTALEGA':   '5168.KL',

  // Manufacturing
  'EBINTGR':     '0137.KL',
  'ATA':         '5230.KL',
  'INDOMRLIN':   '5139.KL',

  // Automotive
  'AAX':         '6012.KL',
  'AUTOGRADE':   '5238.KL',

  // Semiconductors
  'VS':          '0038.KL',
  'VSTHC':       '5127.KL',

  // Plantation
  'FGV':         '5222.KL',
  'KLK':         '0082.KL',
  'SIME':        '0157.KL',

  // Finance (REITs, Insurance)
  'AEON':        '5285.KL',
  'SUNREIT':     '5162.KL',
  'KLCC':        '1204.KL',
};

export function resolveYahooSymbolFromMap(ticker) {
  return BURSA_YAHOO_SYMBOLS[ticker] || null;
}
