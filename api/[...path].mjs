import dns from 'node:dns';
import net from 'node:net';
import nodeHtmlParser from 'node-html-parser';

const { parse } = nodeHtmlParser;
const portImageMb = Math.max(1, Math.min(3, Number(process.env.MAX_IMAGE_MB) || 3));
const requestLimit = Number(process.env.RATE_LIMIT) || 60;
const allowedHosts = new Set(['vision.googleapis.com', 'serpapi.com', 'www.googleapis.com', 'world.openfoodfacts.org', 'world.openproductsfacts.org', 'world.openbeautyfacts.org', 'api.upcitemdb.com', 'www.wikidata.org', 'api.ebay.com', 'api.bestbuy.com', 'www.dhs.gov', 'www.fbi.gov', 'www.europol.europa.eu']);
const tokens = [];

function json(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(data);
}

function body(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body || {};
}

function authorized(req) {
  if (!tokens.length) return true;
  return tokens.includes(req.headers['x-access-token'] || '');
}

function text(value, name, min = 1, max = 300) {
  if (typeof value !== 'string') throw httpError(400, `Le champ « ${name} » est obligatoire.`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw httpError(400, `Le champ « ${name} » est invalide.`);
  return result;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clean(value, max = 1000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function publicUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

async function externalFetch(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) throw httpError(400, 'Destination externe refusée.');
  const response = await fetch(parsed, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'Loupe/0.1 (+https://github.com/slim57000/loupe)', ...(options.headers || {}) }
  });
  if (!response.ok) throw httpError(response.status >= 500 ? 502 : 400, response.status === 403 ? 'Le service externe a refusé la requête.' : 'Le service externe est indisponible.');
  return response;
}

async function externalJson(url, options) {
  const response = await externalFetch(url, options);
  return response.json();
}

async function readHtml(response) {
  const html = await response.text();
  if (html.length > 4_000_000) throw httpError(502, 'Page trop volumineuse.');
  return html;
}

function isPrivateAddress(address) {
  const value = String(address || '').replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!net.isIP(value)) return true;
  if (value.includes(':')) return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80') || value.startsWith('::ffff:127.') || value.startsWith('::ffff:10.') || value.startsWith('::ffff:192.168.') || value.startsWith('::ffff:172.16.');
  const parts = value.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168;
}

async function publicHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || isPrivateAddress(host)) throw httpError(400, 'Les adresses réseau privées ne sont pas autorisées.');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.promises.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw httpError(400, 'Les adresses réseau privées ne sont pas autorisées.');
}

function parseDhs(html, base) {
  const root = parse(html);
  const items = [];
  const seen = new Set();
  for (const container of root.querySelectorAll('div.field__item')) {
    const tip = container.querySelectorAll('a.usa-button').find((link) => (link.getAttribute('href') || '').startsWith('mailto:'));
    if (!tip) continue;
    const tipText = clean(tip.innerText || tip.textContent);
    const reference = tipText.match(/Object Number\s+(\d{2}-\d{4})/i)?.[1] || decodeURIComponent(tip.getAttribute('href') || '').match(/Object(?::|%3A)\s*(\d{2}-\d{4})/i)?.[1] || '';
    if (!reference || seen.has(reference)) continue;
    seen.add(reference);
    const heading = clean(container.querySelector('h3')?.innerText || container.querySelector('h3')?.textContent);
    const image = publicUrl(container.querySelector('a[target="_blank"]')?.getAttribute('href') || container.querySelector('img')?.getAttribute('src') || '', base);
    const description = container.querySelectorAll('p').map((node) => clean(node.innerText || node.textContent)).filter((value) => value && !/^Submit Tip/i.test(value)).join(' ');
    items.push({ reference, title: clean(heading.replace(/\(Object Number\s+\d{2}-\d{4}\)/i, '').replace(/Object Number\s+\d{2}-\d{4}/i, '')) || `Objet ${reference}`, description: clean(description, 1500), imageUrl: image, sourceUrl: base });
  }
  return items.slice(0, 100);
}

function parseEuropol(html, base) {
  const match = html.match(/window\.SERVER_DATA=(\{[\s\S]*?\});<\/script>/);
  if (!match) return [];
  try {
    const data = JSON.parse(match[1]);
    const entries = (data.NodeLoader?.node?.lists || []).flatMap((list) => list.items || []);
    return entries.slice(0, 100).map((entry) => {
      const reference = clean(String(entry.title || '').replace(/^TRACE AN OBJECT\s*-\s*/i, ''), 160);
      const thumbs = [...(entry.mainImage?.thumbs || [])].sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
      return { reference, title: reference ? `Trace an Object — ${reference}` : 'Trace an Object', description: clean(entry.summary, 1500), imageUrl: publicUrl(thumbs[0]?.url || '', base), sourceUrl: publicUrl(entry.alias || '', base) };
    }).filter((item) => item.reference || item.imageUrl);
  } catch {
    return [];
  }
}

async function importProgram(program) {
  if (program === 'ecap') return { program, name: 'Endangered Child Alert Program', sourceUrl: 'https://www.fbi.gov/wanted/ecap/view', items: [], manual: true, note: 'Le site du FBI bloque les requêtes automatisées. Utilisez l’import par liste d’adresses.' };
  if (program === 'traceObject') {
    const url = 'https://www.europol.europa.eu/stopchildabuse';
    const response = await externalFetch(url, { headers: { Accept: 'text/html' } });
    return { program, name: 'Stop Child Abuse — Trace an Object', sourceUrl: url, items: parseEuropol(await readHtml(response), url), manual: false };
  }
  if (program === 'identify2protect') {
    const url = 'https://www.dhs.gov/know2protect/identify2protect';
    const response = await externalFetch(url, { headers: { Accept: 'text/html' } });
    return { program, name: 'Identify2Protect', sourceUrl: url, items: parseDhs(await readHtml(response), url), manual: false };
  }
  throw httpError(400, 'Programme officiel non pris en charge.');
}

function countryCode(value) {
  const result = String(value || '').toUpperCase();
  if (result && !['US', 'CA', 'GB', 'FR', 'DE', 'ES', 'IT', 'AU'].includes(result)) throw httpError(400, 'Pays non pris en charge.');
  return result;
}

function finding(title, url, source, extra = {}) {
  return { title: clean(title, 300), url: publicUrl(url, url), source, ...extra };
}

async function searchProducts(query, country) {
  const sources = [
    ['Open Food Facts', 'https://world.openfoodfacts.org/cgi/search.pl'],
    ['Open Products Facts', 'https://world.openproductsfacts.org/cgi/search.pl'],
    ['Open Beauty Facts', 'https://world.openbeautyfacts.org/cgi/search.pl']
  ];
  const responses = await Promise.allSettled(sources.map(async ([source, endpoint]) => {
    const url = new URL(endpoint);
    url.searchParams.set('search_terms', query);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '15');
    if (country) url.searchParams.set('countries', country.toLowerCase());
    const data = await externalJson(url);
    return (data.products || []).map((product) => finding(product.product_name || product.generic_name || product.brand || 'Produit sans nom', product.code ? `https://world.openfoodfacts.org/product/${encodeURIComponent(product.code)}` : '', source, { brand: clean(product.brand || product.manufacturer, 160), image: publicUrl(product.image_front_small_url || product.image_url || '', 'https://world.openfoodfacts.org/') }));
  }));
  return responses.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : []).slice(0, 30);
}

async function searchWeb(query) {
  if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', process.env.GOOGLE_CSE_KEY);
    url.searchParams.set('cx', process.env.GOOGLE_CSE_CX);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');
    const data = await externalJson(url);
    return (data.items || []).map((item) => ({ title: item.title || 'Sans titre', url: item.link || '', snippet: item.snippet || '', source: 'Recherche web', sourceUrl: 'https://www.google.com/' }));
  }
  if (process.env.SERPAPI_KEY) {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('api_key', process.env.SERPAPI_KEY);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');
    const data = await externalJson(url);
    return (data.organic_results || []).map((item) => ({ title: item.title || 'Sans titre', url: item.link || '', snippet: item.snippet || '', source: 'Recherche web', sourceUrl: 'https://serpapi.com/' }));
  }
  throw httpError(503, 'La recherche web n’est pas configurée.');
}

async function searchSerpapi(input) {
  if (!process.env.SERPAPI_KEY) throw httpError(503, 'La recherche SerpApi n’est pas configurée.');
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('api_key', process.env.SERPAPI_KEY);
  url.searchParams.set('engine', input.engine || 'google_lens');
  if (input.query) url.searchParams.set('q', text(input.query, 'query', 1, 250));
  if (input.imageUrl) url.searchParams.set('url', publicUrl(input.imageUrl, input.imageUrl));
  return externalJson(url);
}

async function lookupUpc(upc) {
  const url = new URL('https://api.upcitemdb.com/prod/trial/lookup');
  url.searchParams.set('upc', upc);
  const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(upc)}.json`;
  const [upcData, offData] = await Promise.all([externalJson(url), externalJson(offUrl)]);
  const results = (upcData.items || []).map((item) => finding(item.title || 'Produit sans nom', item.offers?.[0]?.link || '', 'UPCitemdb', { brand: clean(item.brand, 160), image: publicUrl(item.image || '', 'https://upcitemdb.com/') }));
  if (offData.status === 1 && offData.product) results.unshift(finding(offData.product.product_name || offData.product.brand || 'Produit sans nom', `https://world.openfoodfacts.org/product/${encodeURIComponent(offData.product.code)}`, 'Open Food Facts'));
  return results;
}

async function wikidataBrand(brandName) {
  const search = new URL('https://www.wikidata.org/w/api.php');
  search.searchParams.set('action', 'wbsearchentities');
  search.searchParams.set('search', brandName);
  search.searchParams.set('language', 'en');
  search.searchParams.set('format', 'json');
  search.searchParams.set('type', 'item');
  search.searchParams.set('limit', '3');
  const result = await externalJson(search);
  const id = result.search?.[0]?.id;
  if (!id) return { brand: null, country: null, description: null };
  const detail = new URL('https://www.wikidata.org/w/api.php');
  detail.searchParams.set('action', 'wbgetentities');
  detail.searchParams.set('ids', id);
  detail.searchParams.set('format', 'json');
  detail.searchParams.set('props', 'labels|descriptions|claims');
  detail.searchParams.set('languages', 'en|fr|de|es|it');
  const data = await externalJson(detail);
  const entity = data.entities?.[id];
  const countryId = entity?.claims?.P495?.[0]?.mainsnak?.datavalue?.value?.id;
  return { brand: entity?.labels?.fr?.value || entity?.labels?.en?.value || brandName, wikidataId: id, country: { Q30: 'États-Unis', Q142: 'France', Q183: 'Allemagne', Q145: 'Royaume-Uni' }[countryId] || null, countryCode: countryId || null, description: entity?.descriptions?.fr?.value || entity?.descriptions?.en?.value || null };
}

async function visionAnalyze(input) {
  if (!process.env.GOOGLE_VISION_KEY) throw httpError(503, 'La recherche visuelle n’est pas configurée.');
  const image = input.imageBase64 ? { content: String(input.imageBase64).replace(/^.*,/, '') } : { source: { imageUri: publicUrl(input.imageUrl, input.imageUrl) } };
  const request = { requests: [{ image, features: [{ type: 'LOGO_DETECTION', maxResults: 10 }, { type: 'TEXT_DETECTION', maxResults: 20 }, { type: 'OBJECT_LOCALIZATION', maxResults: 20 }, { type: 'WEB_DETECTION', maxResults: 20 }, { type: 'IMAGE_PROPERTIES', maxResults: 5 }] }] };
  const data = await externalJson(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(process.env.GOOGLE_VISION_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (data.error || data.responses?.[0]?.error) throw httpError(400, 'Analyse refusée par Google Vision.');
  return data.responses?.[0] || {};
}

async function inspectPage(sourceUrl) {
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw httpError(400, 'Seule une adresse HTTPS publique sans identifiant est acceptée.');
  await publicHost(url.hostname);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12_000), headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Loupe/0.1 (+https://github.com/slim57000/loupe)' } });
  if (!response.ok) throw httpError(response.status === 403 ? 400 : 502, response.status === 403 ? 'Cette page refuse la lecture automatique.' : 'La page demandée est inaccessible.');
  if (!/^text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) throw httpError(400, 'Le lien ne pointe pas vers une page HTML publique.');
  const root = parse(await readHtml(response));
  for (const node of root.querySelectorAll('script, style, noscript, svg, iframe')) node.remove();
  const title = clean(root.querySelector('title')?.textContent || root.querySelector('h1')?.textContent, 300);
  const description = clean(root.querySelector('meta[name="description"]')?.getAttribute('content') || root.querySelector('meta[property="og:description"]')?.getAttribute('content'), 1000);
  const canonical = publicUrl(root.querySelector('link[rel="canonical"]')?.getAttribute('href') || sourceUrl, sourceUrl);
  const textContent = root.querySelectorAll('h1, h2, h3, p, li, blockquote').map((node) => clean(node.textContent, 1000)).filter(Boolean).join('\n').slice(0, 20_000);
  const links = root.querySelectorAll('a[href]').map((node) => publicUrl(node.getAttribute('href'), sourceUrl)).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 80);
  return { sourceUrl, title, description, canonical, text: textContent, links, readAt: new Date().toISOString() };
}

export default async function handler(req, res) {
  const parts = Array.isArray(req.query.path) ? req.query.path : req.query.path ? [req.query.path] : [];
  const route = parts.join('/');
  try {
    if (req.method === 'GET' && route === 'public-config') return json(res, 200, { authRequired: tokens.length > 0, maxImageMb: portImageMb });
    if (!authorized(req)) return json(res, 401, { error: 'Code d’accès manquant ou invalide.' });
    if (req.method === 'GET' && route === 'health') return json(res, 200, { status: 'ok' });
    if (req.method === 'GET' && route === 'config') return json(res, 200, { maxImageMb: portImageMb, services: { vision: Boolean(process.env.GOOGLE_VISION_KEY), serpapi: Boolean(process.env.SERPAPI_KEY), web: Boolean(process.env.SERPAPI_KEY || (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX)), products: true, upc: true, wikidata: true, manual: true, ebay: Boolean(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID), bestbuy: Boolean(process.env.BESTBUY_KEY) } });
    const input = req.method === 'POST' ? body(req) : {};
    if (req.method === 'POST' && route === 'vision/analyze') return json(res, 200, await visionAnalyze(input));
    if (req.method === 'POST' && route === 'search/products') return json(res, 200, { results: await searchProducts(text(input.query, 'query', 2, 180), countryCode(input.country)) });
    if (req.method === 'POST' && route === 'search/web') return json(res, 200, { results: await searchWeb(text(input.query, 'query', 2, 250)) });
    if (req.method === 'POST' && route === 'search/serpapi') return json(res, 200, await searchSerpapi(input));
    if (req.method === 'POST' && route === 'search/tattoos') return json(res, 200, { results: (await searchWeb(text(input.query, 'query', 2, 250))).map((item) => ({ ...item, source: 'Recherche de tatouages' })) });
    if (req.method === 'POST' && route === 'upc/lookup') return json(res, 200, { results: await lookupUpc(text(String(input.upc || '').trim(), 'code-barres', 8, 14)) });
    if (req.method === 'POST' && route === 'wikidata/brand') return json(res, 200, await wikidataBrand(text(input.brandName, 'nom de marque', 2, 120)));
    if (req.method === 'POST' && route === 'program/import') return json(res, 200, await importProgram(text(input.program, 'programme officiel', 1, 40)));
    if (req.method === 'POST' && route === 'manual/inspect') return json(res, 200, await inspectPage(text(input.url, 'adresse de la page', 1, 2048)));
    return json(res, 404, { error: 'Route API inconnue.' });
  } catch (error) {
    const status = Number(error.status) || 500;
    return json(res, status, { error: status >= 500 ? 'Le service demandé est momentanément indisponible.' : error.message });
  }
}
