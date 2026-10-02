// Lead-Quelle: OpenStreetMap (Overpass API). Offene Daten (ODbL), keine AGB-Verletzung
// wie beim Scrapen von Google Maps. Liefert Firmen inkl. Info, ob eine Website hinterlegt ist.

export const CATEGORIES = {
  handwerk:   { label: 'Handwerk',             filters: ['["craft"]'] },
  gastro:     { label: 'Restaurants & Cafés',  filters: ['["amenity"~"^(restaurant|cafe|bar|fast_food|ice_cream)$"]'] },
  gesundheit: { label: 'Ärzte & Praxen',       filters: ['["amenity"~"^(doctors|dentist|veterinary)$"]', '["healthcare"~"^(physiotherapist|alternative|psychotherapist)$"]'] },
  beauty:     { label: 'Friseur & Kosmetik',   filters: ['["shop"~"^(hairdresser|beauty|cosmetics|massage|tattoo)$"]'] },
  kfz:        { label: 'Kfz & Werkstätten',    filters: ['["shop"~"^(car|car_repair|tyres|motorcycle)$"]'] },
  handel:     { label: 'Einzelhandel',         filters: ['["shop"~"^(clothes|shoes|florist|bakery|butcher|furniture|jewelry|optician|bicycle|gift|books|hardware)$"]'] },
  fitness:    { label: 'Fitness & Sport',      filters: ['["leisure"~"^(fitness_centre|sports_centre|dance)$"]'] },
  dienstleister: { label: 'Büros & Dienstleister', filters: ['["office"~"^(lawyer|accountant|tax_advisor|insurance|estate_agent|architect|consulting)$"]'] },
  hotel:      { label: 'Hotels & Pensionen',   filters: ['["tourism"~"^(hotel|guest_house|hostel|apartment)$"]'] }
};

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

function escapeOql(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildQuery({ city, categories, withoutWebsiteOnly = false }) {
  const keys = (categories?.length ? categories : Object.keys(CATEGORIES)).filter((k) => CATEGORIES[k]);
  if (!city || !keys.length) throw new Error('Stadt und mindestens eine Branche angeben');
  const noSite = withoutWebsiteOnly ? '[!"website"][!"contact:website"]' : '';
  const parts = keys.flatMap((k) => CATEGORIES[k].filters.map((f) => `  nwr(area.a)${f}["name"]${noSite};`));
  return `[out:json][timeout:90];
area["name"="${escapeOql(city)}"]["boundary"="administrative"]->.a;
(
${parts.join('\n')}
);
out center tags;`;
}

function categoryOf(tags) {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    for (const f of cat.filters) {
      const m = /^\["(\w+)"(?:~"\^\(([^)]+)\)\$")?\]$/.exec(f);
      if (!m) continue;
      const [, tag, values] = m;
      if (tags[tag] && (!values || values.split('|').includes(tags[tag]))) return key;
    }
  }
  return null;
}

export function normalizeWebsite(url) {
  if (!url) return null;
  let u = String(url).trim().split(/[;\s]/)[0];
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  try { return new URL(u).toString(); } catch { return null; }
}

export function parseOverpass(json, fallbackCity) {
  const out = [];
  for (const el of json?.elements || []) {
    const t = el.tags || {};
    if (!t.name) continue;
    const email = t.email || t['contact:email'] || null;
    out.push({
      source: 'osm',
      source_id: `${el.type}/${el.id}`,
      name: t.name,
      category: categoryOf(t),
      street: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || null,
      postcode: t['addr:postcode'] || null,
      city: t['addr:city'] || fallbackCity || null,
      phone: t.phone || t['contact:phone'] || null,
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.split(';')[0].trim()) ? email.split(';')[0].trim() : null,
      website: normalizeWebsite(t.website || t['contact:website'] || t.url)
    });
  }
  return out;
}

export async function findLeads({ city, categories, withoutWebsiteOnly }, fetchImpl = fetch) {
  const query = buildQuery({ city, categories, withoutWebsiteOnly });
  const res = await fetchImpl(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'hk-growth-outreach/1.0' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(120_000)
  });
  if (!res.ok) throw new Error(`Overpass-Fehler ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return parseOverpass(await res.json(), city);
}
