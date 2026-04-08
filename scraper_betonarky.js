/**
 * Scraper betonáren z betonserver.cz
 * Stáhne seznam betonáren, pro každou získá adresu, a geocoduje přes Nominatim.
 * Výstup: betonarky.json
 *
 * Usage: node scraper_betonarky.js
 */
const https = require('https');
const fs = require('fs');

const BASE = 'https://www.betonserver.cz';
const CATEGORY_URL = '/beton-a-cerpani/beton-betonarny-v-cr';
const OUTPUT = 'betonarky.json';

// Rate limiting
const DELAY = 1200; // ms between requests (be nice to servers)
const GEOCODE_DELAY = 1100; // Nominatim requires 1 req/sec

function httpsGet(fullUrl) {
  return new Promise((resolve, reject) => {
    https.get(fullUrl, { headers: { 'User-Agent': 'PlotypDobrApp/1.0 (fence-calculator)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Extract betonárna links from listing page
function extractLinks(html) {
  const links = [];
  // Match links to individual betonárna pages
  const re = /href="(\/[a-z0-9\-]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1];
    // Skip known non-betonárna links
    if (path.startsWith('/beton-') || path.startsWith('/kamenivo') || path.startsWith('/skladky') ||
        path.startsWith('/betonove-') || path.startsWith('/obalovny') || path.startsWith('/stavebni-') ||
        path.startsWith('/jeraby') || path.startsWith('/ocelove-') || path.startsWith('/stroje-') ||
        path.startsWith('/materialy-') || path.startsWith('/laboratore') || path.startsWith('/kontaktujte') ||
        path.startsWith('/registrace') || path.startsWith('/jak-') || path.startsWith('/napoveda') ||
        path.startsWith('/muj-') || path.startsWith('/aktuality') || path.startsWith('/inzeraty') ||
        path.startsWith('/do/') || path.startsWith('/pic/') || path.startsWith('/files/')) {
      continue;
    }
    if (!links.includes(path)) links.push(path);
  }
  return links;
}

// Extract name + address from detail page
function extractDetail(html) {
  const result = {};
  
  // Name from <h1> or title
  const h1m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1m) result.name = h1m[1].trim();

  // Address block - the format on betonserver.cz is always:
  // CompanyNameStreetAddressPSC, CityIČO: XXXXXXXX
  // PSC format: XXX XX (3 digits, space, 2 digits)
  
  // First extract the raw text from the Adresa section
  const addrMatch = html.match(/Adresa[\s\S]*?<\/h\d>[\s\S]*?<[^>]*>([\s\S]*?)(?:<\/(?:div|td|section))/i);
  if (addrMatch) {
    const raw = addrMatch[1]
      .replace(/<br\s*\/?>/gi, '|')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    
    // Find PSC pattern: 3digits space 2digits, City
    const pscCityMatch = raw.match(/(\d{3})\s*(\d{2})\s*,\s*([^|IČ]+)/);
    if (pscCityMatch) {
      result.psc = pscCityMatch[1] + ' ' + pscCityMatch[2];
      result.mesto = pscCityMatch[3].trim().replace(/IČO.*$/, '').trim();
    }
    
    // Street: text before PSC that contains a number (house number)
    if (pscCityMatch) {
      const beforePsc = raw.substring(0, raw.indexOf(pscCityMatch[0]));
      // Remove company name (everything before last |)
      const parts = beforePsc.split('|').filter(s => s.trim());
      // Last part before PSC is usually the street
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i].trim();
        if (/\d/.test(part) && part.length > 3 && !part.startsWith('IČO')) {
          result.ulice = part;
          break;
        }
      }
    }
  }

  return result;
}

// Geocode address via Nominatim
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cz&limit=1`;
  try {
    const data = await httpsGet(url);
    const results = JSON.parse(data);
    if (results.length > 0) {
      return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function main() {
  console.log('🏗️  Scraping betonáren z betonserver.cz...');
  
  // 1. Get all listing pages
  const allLinks = new Set();
  let page = 1;
  
  while (true) {
    const url = `${BASE}${CATEGORY_URL}?page=${page}`;
    console.log(`📄 Strana ${page}...`);
    const html = await httpsGet(url);
    const links = extractLinks(html);
    
    const before = allLinks.size;
    links.forEach(l => allLinks.add(l));
    
    if (allLinks.size === before || page > 50) break; // No new links = last page
    page++;
    await sleep(DELAY);
  }

  console.log(`📋 Nalezeno ${allLinks.size} odkazů na betonárny`);
  
  // 2. Get details for each
  const betonarky = [];
  let i = 0;
  
  for (const link of allLinks) {
    i++;
    const url = `${BASE}${link}`;
    console.log(`  [${i}/${allLinks.size}] ${link}...`);
    
    try {
      const html = await httpsGet(url);
      const detail = extractDetail(html);
      
      if (detail.name) {
        const entry = {
          name: detail.name,
          slug: link,
          ulice: detail.ulice || '',
          mesto: detail.mesto || '',
          psc: detail.psc || '',
          lat: null,
          lon: null,
        };
        
        // Geocode
        const geoQuery = [detail.ulice, detail.mesto, detail.psc, 'Česko'].filter(Boolean).join(', ');
        if (detail.mesto) {
          await sleep(GEOCODE_DELAY);
          const geo = await geocode(geoQuery);
          if (geo) {
            entry.lat = geo.lat;
            entry.lon = geo.lon;
            console.log(`    ✅ ${detail.name} → ${detail.mesto} (${geo.lat}, ${geo.lon})`);
          } else {
            // Fallback: try just city + country
            await sleep(GEOCODE_DELAY);
            const geo2 = await geocode(detail.mesto + ', Česko');
            if (geo2) {
              entry.lat = geo2.lat;
              entry.lon = geo2.lon;
              console.log(`    ✅ ${detail.name} → ${detail.mesto} (${geo2.lat}, ${geo2.lon}) [město]`);
            } else {
              console.log(`    ⚠️ ${detail.name} → geocoding selhal pro "${geoQuery}"`);
            }
          }
        } else {
          // No city parsed - try geocoding the betonárna name itself (often contains city)
          const nameClean = detail.name.replace(/s\.r\.o\.|a\.s\.|spol\.\s*s\s*r\.\s*o\./gi, '').replace(/[,\-–]/g, ' ').trim();
          await sleep(GEOCODE_DELAY);
          const geo3 = await geocode(nameClean + ', Česko');
          if (geo3) {
            entry.lat = geo3.lat;
            entry.lon = geo3.lon;
            console.log(`    ✅ ${detail.name} → (${geo3.lat}, ${geo3.lon}) [z názvu]`);
          } else {
            console.log(`    ⚠️ ${detail.name} → město nenalezeno, geocoding selhal`);
          }
        }
        
        betonarky.push(entry);
      }
    } catch (e) {
      console.log(`    ❌ Chyba: ${e.message}`);
    }
    
    await sleep(DELAY);
  }

  // 3. Save
  const withGeo = betonarky.filter(b => b.lat !== null);
  console.log(`\n✅ Hotovo! ${betonarky.length} betonáren, ${withGeo.length} s GPS souřadnicemi`);
  
  fs.writeFileSync(OUTPUT, JSON.stringify(betonarky, null, 2), 'utf-8');
  console.log(`💾 Uloženo do ${OUTPUT}`);
}

main().catch(e => console.error('Fatal error:', e));
