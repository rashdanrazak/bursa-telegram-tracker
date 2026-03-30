import axios from 'axios';
import * as cheerio from 'cheerio';

const I3_URL = 'https://klse.i3investor.com/web/entitlement/dividend/latest';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function testScraper() {
  try {
    console.log('Fetching from:', I3_URL);
    const res = await axios.get(I3_URL, { headers: HEADERS, timeout: 10000 });
    
    console.log('✅ Got response, status:', res.status);
    console.log('Content length:', res.data.length, 'bytes');
    
    const $ = cheerio.load(res.data);
    
    console.log('\n📊 Table Analysis:');
    console.log('  - Total <table> elements:', $('table').length);
    console.log('  - <table tbody tr> rows:', $('table tbody tr').length);
    console.log('  - <table tr> rows (any):', $('table tr').length);
    console.log('  - <table > tr (direct):', $('table > tr').length);
    
    console.log('\n📝 First 5 <table tr> rows:');
    let rowCount = 0;
    $('table tr').each((i, row) => {
      if (rowCount >= 5) return;
      const cols = $(row).find('td');
      const ths = $(row).find('th');
      const isHeader = ths.length > 0;
      
      if (cols.length > 0) {
        console.log(`  Row ${i}:`, {
          type: isHeader ? 'HEADER' : 'DATA',
          cols: cols.length,
          text: cols.eq(0).text().substring(0, 40),
        });
        rowCount++;
      }
    });
    
    // Try the actual selector from scraper
    console.log('\n🔍 Trying current selector (table tbody tr):');
    const tbodyRows = $('table tbody tr');
    console.log('  Found rows:', tbodyRows.length);
    
    if (tbodyRows.length === 0) {
      console.log('❌ No rows found! The table might not use <tbody>');
      console.log('\n💡 Try these alternative selectors:');
      console.log('  - $("table > tr"):', $('table > tr').length, 'rows');
      console.log('  - $("tr[role]"):', $('tr[role]').length, 'rows');
      console.log('  - $("tr"):', $('tr').length, 'rows total');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testScraper();
