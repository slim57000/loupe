const { parse } = require('node-html-parser');
const dns = require('node:dns').promises;
const net = require('node:net');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('node:path');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const maxImageBytes = Math.max(2, Math.min(10, Number(process.env.MAX_IMAGE_MB) || 10)) * 1024 * 1024;
const maxJsonBytes = Math.ceil(maxImageBytes * 4 / 3) + 1024 * 1024;
const externalJsonLimit = 4 * 1024 * 1024;
const requestLimit = Number(process.env.RATE_LIMIT) || 60;
const publicDirectory = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(express.json({ limit: `${maxJsonBytes}b` }));

app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store').json({ status: 'ok' });
});

app.get('/api/public-config', (req, res) => {
  res.set('Cache-Control', 'no-store').json({
    authRequired: false,
    maxImageMb: Math.round(maxImageBytes / 1024 / 1024)
  });
});

app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: requestLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Une analyse utilise plusieurs appels : attendez une minute ou augmentez RATE_LIMIT sur le serveur.' }
}));

app.get('/api/config', (req, res) => {
  res.set('Cache-Control', 'no-store').json({
    authRequired: false,
    maxImageMb: Math.round(maxImageBytes / 1024 / 1024),
    services: {
      vision: Boolean(process.env.GOOGLE_VISION_KEY),
      serpapi: Boolean(process.env.SERPAPI_KEY),
      web: Boolean(process.env.SERPAPI_KEY || (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX)),
      products: true,
      upc: true,
      wikidata: true,
      manual: true,
      ebay: Boolean(process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID),
      bestbuy: Boolean(process.env.BESTBUY_KEY)
    }
  });
});

const allowedHosts = new Set([
  'vision.googleapis.com',
  'serpapi.com',
  'www.googleapis.com',
  'world.openfoodfacts.org',
  'world.openproductsfacts.org',
  'world.openbeautyfacts.org',
  'api.upcitemdb.com',
  'www.wikidata.org',
  'api.ebay.com',
  'api.bestbuy.com',
  'www.dhs.gov',
  'www.fbi.gov',
  'www.europol.europa.eu'
]);

async function safeFetch(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {
    throw new Error('Destination externe refusée.');
  }
  const response = await fetch(parsed, {
    ...options,
    headers: {
      'User-Agent': 'Loupe/0.1 (+https://github.com/slim57000/loupe)',
      ...(options.headers || {})
    },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const error = new Error(response.status >= 500
      ? 'Service externe indisponible.'
      : 'Le service externe a refusé la requête : vérifiez la clé API configurée côté serveur.');
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return response;
}

async function readLimited(response, limit = externalJsonLimit) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > limit) {
    const error = new Error('Réponse externe trop volumineuse.');
    error.status = 502;
    throw error;
  }
  if (!response.body) {
    const error = new Error('Réponse externe vide.');
    error.status = 502;
    throw error;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      const error = new Error('Réponse externe trop volumineuse.');
      error.status = 502;
      throw error;
    }
    chunks.push(Buffer.from(value));
  }
  const buffer = Buffer.concat(chunks);
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    const error = new Error('Réponse externe invalide.');
    error.status = 502;
    throw error;
  }
}

async function readHtml(response, limit = 4 * 1024 * 1024) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > limit) {
    const error = new Error('Page officielle trop volumineuse.');
    error.status = 502;
    throw error;
  }
  const html = await response.text();
  if (html.length > limit) {
    const error = new Error('Page officielle trop volumineuse.');
    error.status = 502;
    throw error;
  }
  return html;
}

function isPrivateAddress(address) {
  const value = String(address || '').replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!net.isIP(value)) return true;
  if (value.includes(':')) {
    return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80') || value.startsWith('::ffff:127.') || value.startsWith('::ffff:10.') || value.startsWith('::ffff:192.168.') || value.startsWith('::ffff:172.16.');
  }
  const parts = value.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168;
}

async function assertPublicHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || isPrivateAddress(host)) {
    const error = new Error('Les adresses réseau privées ne sont pas autorisées.');
    error.status = 400;
    throw error;
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    const error = new Error('Les adresses réseau privées ne sont pas autorisées.');
    error.status = 400;
    throw error;
  }
}

async function fetchPublicPage(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    const error = new Error('Seule une adresse HTTPS publique sans identifiant est acceptée.');
    error.status = 400;
    throw error;
  }
  await assertPublicHost(parsed.hostname);
  const response = await fetch(parsed, {
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Loupe/0.1 (+https://github.com/slim57000/loupe)'
    }
  });
  if (!response.ok) {
    const error = new Error(response.status === 403 ? 'Cette page refuse la lecture automatique. Ouvrez-la dans votre navigateur et copiez les informations utiles.' : 'La page demandée est inaccessible.');
    error.status = response.status === 403 ? 400 : 502;
    throw error;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!/^text\/html|application\/xhtml/i.test(contentType)) {
    const error = new Error('Le lien ne pointe pas vers une page HTML publique.');
    error.status = 400;
    throw error;
  }
  return readHtml(response, 2 * 1024 * 1024);
}

function parsePublicPage(html, sourceUrl) {
  const root = parse(html);
  for (const node of root.querySelectorAll('script, style, noscript, svg, iframe')) node.remove();
  const title = cleanText(root.querySelector('title')?.textContent || root.querySelector('h1')?.textContent, 300);
  const description = cleanText(root.querySelector('meta[name="description"]')?.getAttribute('content') || root.querySelector('meta[property="og:description"]')?.getAttribute('content'), 1000);
  const canonical = officialUrl(root.querySelector('link[rel="canonical"]')?.getAttribute('href') || sourceUrl, sourceUrl);
  const blocks = root.querySelectorAll('h1, h2, h3, p, li, blockquote').map((node) => cleanText(node.innerText || node.textContent, 1000)).filter(Boolean);
  const links = root.querySelectorAll('a[href]').map((node) => officialUrl(node.getAttribute('href'), sourceUrl)).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 80);
  return { title, description, canonical, text: blocks.join('\n').slice(0, 20_000), links };
}

const fieldLabels = {
  query: 'recherche',
  brandName: 'nom de marque',
  imageUrl: 'adresse de l’image',
  imageBase64: 'image importée',
  country: 'pays',
  engine: 'moteur de recherche',
  program: 'programme officiel',
  url: 'adresse de la page'
};

function text(value, name, min = 1, max = 300) {
  if (typeof value !== 'string') {
    const error = new Error(`Le champ « ${fieldLabels[name] || name} » est invalide.`);
    error.status = 400;
    throw error;
  }
  const result = value.trim();
  if (result.length < min || result.length > max) {
    const error = new Error(`Le champ « ${fieldLabels[name] || name} » doit contenir entre ${min} et ${max} caractères.`);
    error.status = 400;
    throw error;
  }
  return result;
}

function optionalText(value, name, max = 1000) {
  if (value === undefined || value === null || value === '') return '';
  return text(value, name, 0, max);
}

function imageUrl(value) {
  const url = new URL(text(value, 'imageUrl', 1, 2048));
  if (url.protocol !== 'https:' || url.username || url.password) {
    const error = new Error('L’adresse de l’image doit commencer par https:// et ne doit pas contenir d’identifiant.');
    error.status = 400;
    throw error;
  }
  return url.toString();
}

function imageContent(value) {
  const content = text(value, 'image importée', 1, Math.ceil(maxImageBytes * 4 / 3) + 1024);
  return content.includes(',') ? content.slice(content.indexOf(',') + 1) : content;
}

function countryCode(value) {
  const result = optionalText(value, 'country', 2).toUpperCase();
  const allowed = new Set(['US', 'CA', 'GB', 'FR', 'DE', 'ES', 'IT', 'AU']);
  if (result && !allowed.has(result)) {
    const error = new Error('Pays non pris en charge.');
    error.status = 400;
    throw error;
  }
  return result;
}

function sendError(res, error, route) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(route, error.message || error.name || 'Erreur');
  res.status(status).json({ error: status >= 500 ? 'Le service demandé est momentanément indisponible.' : error.message });
}

const officialPrograms = {
  identify2protect: {
    id: 'identify2protect',
    name: 'Identify2Protect',
    url: 'https://www.dhs.gov/know2protect/identify2protect',
    parse: parseIdentify2Protect
  },
  ecap: {
    id: 'ecap',
    name: 'Endangered Child Alert Program',
    url: 'https://www.fbi.gov/wanted/ecap/view',
    manual: true,
    manualReason: 'Le site du FBI bloque les requêtes automatisées. Ouvrez la page officielle, copiez les liens des fiches dans l’import par liste d’adresses, puis ajoutez vos observations.'
  },
  traceObject: {
    id: 'traceObject',
    name: 'Stop Child Abuse — Trace an Object',
    url: 'https://www.europol.europa.eu/stopchildabuse',
    parse: parseTraceObject
  }
};

const officialImportCache = new Map();
const officialCacheDuration = 30 * 60 * 1000;

function cleanText(value, max = 1000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function officialUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function parseIdentify2Protect(html, baseUrl) {
  const root = parse(html);
  const items = [];
  const seen = new Set();
  for (const container of root.querySelectorAll('div.field__item')) {
    const tip = container.querySelectorAll('a.usa-button').find((link) => (link.getAttribute('href') || '').startsWith('mailto:'));
    if (!tip) continue;
    const tipText = cleanText(tip.innerText || tip.textContent);
    let reference = tipText.match(/Object Number\s+(\d{2}-\d{4})/i)?.[1] || '';
    if (!reference) {
      const href = tip.getAttribute('href') || '';
      reference = decodeURIComponent(href).match(/Object(?::|%3A)\s*(\d{2}-\d{4})/i)?.[1] || '';
    }
    if (!reference || seen.has(reference)) continue;
    seen.add(reference);
    const heading = container.querySelector('h3');
    const headingText = cleanText(heading?.innerText || heading?.textContent);
    const title = cleanText(headingText.replace(/\(Object Number\s+\d{2}-\d{4}\)/i, '').replace(/Object Number\s+\d{2}-\d{4}/i, '')) || `Objet ${reference}`;
    const imageAnchor = container.querySelector('a[target="_blank"]');
    const image = officialUrl(imageAnchor?.getAttribute('href') || container.querySelector('img')?.getAttribute('src') || '', baseUrl);
    const description = container.querySelectorAll('p')
      .map((node) => cleanText(node.innerText || node.textContent))
      .filter((value) => value && !/^Submit Tip/i.test(value) && !/^Submit a tip/i.test(value))
      .join(' ');
    items.push({
      reference,
      title,
      description: cleanText(description, 1500),
      imageUrl: image,
      sourceUrl: baseUrl
    });
  }
  return items.slice(0, 100);
}

function parseEcap(html, baseUrl) {
  const root = parse(html);
  const items = [];
  const seen = new Set();
  for (const entry of root.querySelectorAll('li')) {
    const link = entry.querySelectorAll('a').find((anchor) => (anchor.getAttribute('href') || '').includes('/wanted/ecap/'));
    const image = entry.querySelector('img');
    if (!link || !image) continue;
    const sourceUrl = officialUrl(link.getAttribute('href'), baseUrl);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const reference = cleanText(image.getAttribute('alt') || image.getAttribute('title') || entry.querySelector('h3')?.innerText, 160);
    if (!reference) continue;
    const focus = entry.querySelector('.focuspoint');
    let imageUrl = officialUrl(image.getAttribute('src') || '', baseUrl);
    try {
      const base = focus?.getAttribute('data-base-url');
      if (base) imageUrl = officialUrl(`${base}high`, baseUrl);
    } catch {
      imageUrl = imageUrl.replace(/\/preview(?:\?.*)?$/, '/high');
    }
    items.push({
      reference,
      title: reference,
      description: '',
      imageUrl,
      sourceUrl
    });
  }
  return items.slice(0, 100);
}

function parseTraceObject(html, baseUrl) {
  const match = html.match(/window\.SERVER_DATA=(\{[\s\S]*?\});<\/script>/);
  if (!match) return [];
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const node = data.NodeLoader?.node;
  const lists = Array.isArray(node?.lists) ? node.lists : [];
  const entries = lists.flatMap((list) => Array.isArray(list.items) ? list.items : []);
  return entries.slice(0, 100).map((entry) => {
    const reference = cleanText(String(entry.title || '').replace(/^TRACE AN OBJECT\s*-\s*/i, ''), 160);
    const thumbs = Array.isArray(entry.mainImage?.thumbs) ? entry.mainImage.thumbs : [];
    const largest = [...thumbs].sort((left, right) => (Number(right.width) || 0) - (Number(left.width) || 0))[0];
    return {
      reference,
      title: reference ? `Trace an Object — ${reference}` : 'Trace an Object',
      description: cleanText(entry.summary || '', 1500),
      imageUrl: officialUrl(largest?.url || entry.mainImage?.url || '', baseUrl),
      sourceUrl: officialUrl(entry.alias || '', baseUrl)
    };
  }).filter((item) => item.reference || item.imageUrl);
}

async function importOfficialProgram(programId) {
  const program = officialPrograms[programId];
  if (!program) {
    const error = new Error('Programme officiel non pris en charge.');
    error.status = 400;
    throw error;
  }
  if (program.manual) {
    return {
      program: program.id,
      name: program.name,
      sourceUrl: program.url,
      items: [],
      manual: true,
      note: program.manualReason
    };
  }
  const cached = officialImportCache.get(program.id);
  if (cached && Date.now() - cached.createdAt < officialCacheDuration) {
    return cached.payload;
  }
  const response = await safeFetch(program.url, { headers: { Accept: 'text/html' } });
  const html = await readHtml(response);
  const items = program.parse(html, program.url).map((item) => ({
    ...item,
    reference: cleanText(item.reference, 160),
    title: cleanText(item.title, 300),
    description: cleanText(item.description, 1500),
    imageUrl: officialUrl(item.imageUrl, program.url),
    sourceUrl: officialUrl(item.sourceUrl, program.url)
  })).filter((item) => item.reference || item.title);
  const payload = {
    program: program.id,
    name: program.name,
    sourceUrl: program.url,
    items,
    manual: false,
    note: items.length ? 'Liste récupérée depuis la page officielle.' : 'Aucun objet n’a été détecté sur la page officielle.'
  };
  officialImportCache.set(program.id, { createdAt: Date.now(), payload });
  return payload;
}

app.post('/api/program/import', async (req, res) => {
  try {
    const programId = text(req.body.program, 'program', 1, 40);
    const payload = await importOfficialProgram(programId);
    res.set('Cache-Control', 'no-store').json(payload);
  } catch (error) {
    sendError(res, error, 'program-import');
  }
});

app.post('/api/manual/inspect', async (req, res) => {
  try {
    const sourceUrl = text(req.body.url, 'url', 1, 2048);
    const html = await fetchPublicPage(sourceUrl);
    const page = parsePublicPage(html, sourceUrl);
    res.set('Cache-Control', 'no-store').json({ sourceUrl, ...page, readAt: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'manual-inspect');
  }
});

app.post('/api/vision/analyze', async (req, res) => {
  try {
    if (!process.env.GOOGLE_VISION_KEY) {
      return res.status(503).json({ error: 'L’analyse visuelle Google n’est pas configurée.' });
    }
    const hasUrl = typeof req.body.imageUrl === 'string' && req.body.imageUrl;
    const hasContent = typeof req.body.imageBase64 === 'string' && req.body.imageBase64;
    if (!hasUrl && !hasContent) {
      return res.status(400).json({ error: 'Ajoutez une URL HTTPS ou une image importée.' });
    }
    const image = hasContent
      ? { content: imageContent(req.body.imageBase64) }
      : { source: { imageUri: imageUrl(req.body.imageUrl) } };
    const body = {
      requests: [{
        image,
        features: [
          { type: 'LOGO_DETECTION', maxResults: 10 },
          { type: 'TEXT_DETECTION', maxResults: 20 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 20 },
          { type: 'WEB_DETECTION', maxResults: 20 },
          { type: 'IMAGE_PROPERTIES', maxResults: 5 }
        ]
      }]
    };
    const response = await safeFetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(process.env.GOOGLE_VISION_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await readLimited(response);
    if (data.error || data.responses?.[0]?.error) {
      const error = new Error('Analyse refusée par Google Vision.');
      error.status = 400;
      throw error;
    }
    res.set('Cache-Control', 'no-store').json(data.responses?.[0] || {});
  } catch (error) {
    sendError(res, error, 'vision');
  }
});

function productScore(product, query) {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [product.product_name, product.brand, product.manufacturer, product.categories]
    .filter(Boolean).join(' ').toLowerCase();
  let score = terms.filter((term) => haystack.includes(term)).length * 10;
  if (product.brand && terms.some((term) => product.brand.toLowerCase().includes(term))) score += 15;
  return score;
}

app.post('/api/search/products', async (req, res) => {
  try {
    const query = text(req.body.query, 'query', 2, 180);
    const country = countryCode(req.body.country);
    const sources = [
      ['Open Food Facts', 'https://world.openfoodfacts.org/cgi/search.pl'],
      ['Open Products Facts', 'https://world.openproductsfacts.org/cgi/search.pl'],
      ['Open Beauty Facts', 'https://world.openbeautyfacts.org/cgi/search.pl']
    ];
    const settled = await Promise.allSettled(sources.map(async ([name, endpoint]) => {
      const url = new URL(endpoint);
      url.searchParams.set('search_terms', query);
      url.searchParams.set('search_simple', '1');
      url.searchParams.set('action', 'process');
      url.searchParams.set('json', '1');
      url.searchParams.set('page_size', '15');
      if (country) url.searchParams.set('countries', country.toLowerCase());
      const response = await safeFetch(url);
      const data = await readLimited(response);
      return (data.products || []).map((product) => ({
        title: product.product_name || product.generic_name || product.brand || 'Produit sans nom',
        brand: product.brand || product.manufacturer || '',
        image: product.image_front_small_url || product.image_url || '',
        url: product.code ? `https://world.openfoodfacts.org/product/${encodeURIComponent(product.code)}` : '',
        source: name,
        sourceUrl: 'https://world.openfoodfacts.org/',
        score: productScore(product, query)
      }));
    }));
    const results = settled.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : [])
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    res.set('Cache-Control', 'no-store').json({ results });
  } catch (error) {
    sendError(res, error, 'products');
  }
});

app.post('/api/search/serpapi', async (req, res) => {
  try {
    if (!process.env.SERPAPI_KEY) {
      return res.status(503).json({ error: 'La recherche visuelle SerpApi n’est pas configurée.' });
    }
    const engine = optionalText(req.body.engine, 'engine', 40) || 'google_lens';
    if (!['google_lens', 'google', 'google_images', 'google_shopping'].includes(engine)) {
      return res.status(400).json({ error: 'Moteur de recherche non pris en charge.' });
    }
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('api_key', process.env.SERPAPI_KEY);
    url.searchParams.set('engine', engine);
    if (req.body.query) url.searchParams.set('q', text(req.body.query, 'query', 1, 250));
    if (req.body.imageUrl) url.searchParams.set('url', imageUrl(req.body.imageUrl));
    if (engine === 'google_lens' && !req.body.imageUrl) {
      return res.status(400).json({ error: 'L’analyse visuelle nécessite une URL d’image publique.' });
    }
    const response = await safeFetch(url);
    const data = await readLimited(response);
    res.set('Cache-Control', 'no-store').json(data);
  } catch (error) {
    sendError(res, error, 'serpapi');
  }
});

app.post('/api/search/web', async (req, res) => {
  try {
    const query = text(req.body.query, 'query', 2, 250);
    let url;
    if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) {
      url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', process.env.GOOGLE_CSE_KEY);
      url.searchParams.set('cx', process.env.GOOGLE_CSE_CX);
      url.searchParams.set('q', query);
      url.searchParams.set('num', '10');
    } else if (process.env.SERPAPI_KEY) {
      url = new URL('https://serpapi.com/search');
      url.searchParams.set('api_key', process.env.SERPAPI_KEY);
      url.searchParams.set('engine', 'google');
      url.searchParams.set('q', query);
      url.searchParams.set('num', '10');
    } else {
      return res.status(503).json({ error: 'La recherche web n’est pas configurée.' });
    }
    const response = await safeFetch(url);
    const data = await readLimited(response);
    const results = (data.items || data.organic_results || []).map((result) => ({
      title: result.title || 'Sans titre',
      url: result.link || result.url || '',
      snippet: result.snippet || result.description || '',
      source: 'Recherche web',
      sourceUrl: url.origin
    }));
    res.set('Cache-Control', 'no-store').json({ results });
  } catch (error) {
    sendError(res, error, 'web');
  }
});

app.post('/api/search/tattoos', async (req, res) => {
  try {
    if (!process.env.SERPAPI_KEY) {
      return res.status(503).json({ error: 'La recherche de tatouages n’est pas configurée.' });
    }
    const query = text(req.body.query, 'query', 2, 250);
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('api_key', process.env.SERPAPI_KEY);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');
    const response = await safeFetch(url);
    const data = await readLimited(response);
    res.set('Cache-Control', 'no-store').json({
      results: (data.organic_results || []).map((result) => ({
        title: result.title || 'Sans titre',
        url: result.link || '',
        snippet: result.snippet || '',
        source: 'Recherche de tatouages',
        sourceUrl: 'https://serpapi.com/'
      }))
    });
  } catch (error) {
    sendError(res, error, 'tattoos');
  }
});

app.post('/api/upc/lookup', async (req, res) => {
  try {
    const upc = String(req.body.upc || '').trim();
    if (!/^\d{8,14}$/.test(upc)) {
      return res.status(400).json({ error: 'Le code-barres doit contenir entre 8 et 14 chiffres.' });
    }
    const upcUrl = new URL('https://api.upcitemdb.com/prod/trial/lookup');
    upcUrl.searchParams.set('upc', upc);
    if (process.env.UPCITEMS_KEY) upcUrl.searchParams.set('apikey', process.env.UPCITEMS_KEY);
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(upc)}.json`;
    const [upcResponse, offResponse] = await Promise.all([
      safeFetch(upcUrl),
      safeFetch(offUrl)
    ]);
    const [upcData, offData] = await Promise.all([readLimited(upcResponse), readLimited(offResponse)]);
    const results = (upcData.items || []).map((item) => ({
      title: item.title || 'Produit sans titre',
      brand: item.brand || '',
      image: item.image || '',
      url: item.offers?.[0]?.link || '',
      source: 'UPCitemdb',
      sourceUrl: 'https://upcitemdb.com/'
    }));
    if (offData.status === 1 && offData.product) {
      const product = offData.product;
      results.unshift({
        title: product.product_name || product.generic_name || product.brand || 'Produit sans nom',
        brand: product.brand || '',
        image: product.image_front_small_url || product.image_url || '',
        url: `https://world.openfoodfacts.org/product/${encodeURIComponent(product.code)}`,
        source: 'Open Food Facts',
        sourceUrl: 'https://world.openfoodfacts.org/'
      });
    }
    res.set('Cache-Control', 'no-store').json({ results });
  } catch (error) {
    sendError(res, error, 'upc');
  }
});

const countryNames = {
  Q30: 'États-Unis', Q142: 'France', Q183: 'Allemagne', Q145: 'Royaume-Uni', Q38: 'Italie',
  Q29: 'Espagne', Q17: 'Japon', Q159: 'Chine', Q668: 'Inde', Q155: 'Brésil', Q408: 'Australie',
  Q16: 'Canada', Q189: 'Russie'
};

app.post('/api/wikidata/brand', async (req, res) => {
  try {
    const brandName = text(req.body.brandName, 'brandName', 2, 120);
    const searchUrl = new URL('https://www.wikidata.org/w/api.php');
    searchUrl.searchParams.set('action', 'wbsearchentities');
    searchUrl.searchParams.set('search', brandName);
    searchUrl.searchParams.set('language', 'en');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('type', 'item');
    searchUrl.searchParams.set('limit', '3');
    const searchResponse = await safeFetch(searchUrl);
    const searchData = await readLimited(searchResponse);
    const entityId = searchData.search?.[0]?.id;
    if (!entityId) return res.json({ brand: null, country: null, description: null });
    const detailUrl = new URL('https://www.wikidata.org/w/api.php');
    detailUrl.searchParams.set('action', 'wbgetentities');
    detailUrl.searchParams.set('ids', entityId);
    detailUrl.searchParams.set('format', 'json');
    detailUrl.searchParams.set('props', 'labels|descriptions|claims');
    detailUrl.searchParams.set('languages', 'en|fr|de|es|it');
    const detailResponse = await safeFetch(detailUrl);
    const detailData = await readLimited(detailResponse);
    const entity = detailData.entities?.[entityId];
    const countryId = entity?.claims?.P495?.[0]?.mainsnak?.datavalue?.value?.id;
    res.set('Cache-Control', 'no-store').json({
      brand: entity?.labels?.fr?.value || entity?.labels?.en?.value || brandName,
      wikidataId: entityId,
      country: countryNames[countryId] || null,
      countryCode: countryId || null,
      description: entity?.descriptions?.fr?.value || entity?.descriptions?.en?.value || null
    });
  } catch (error) {
    sendError(res, error, 'wikidata');
  }
});

app.post('/api/search/ebay', async (req, res) => {
  try {
    if (!process.env.EBAY_APP_ID || !process.env.EBAY_CERT_ID) {
      return res.status(503).json({ error: 'La recherche eBay n’est pas configurée.' });
    }
    const query = text(req.body.query, 'query', 2, 180);
    const auth = Buffer.from(`${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`).toString('base64');
    const tokenUrl = new URL('https://api.ebay.com/identity/v1/oauth2/token');
    const tokenResponse = await safeFetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' })
    });
    const tokenData = await readLimited(tokenResponse);
    if (!tokenData.access_token) throw new Error('Jeton eBay manquant');
    const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '20');
    const marketplaces = { US: 'EBAY_US', CA: 'EBAY_CA', GB: 'EBAY_GB', FR: 'EBAY_FR', DE: 'EBAY_DE', ES: 'EBAY_ES', IT: 'EBAY_IT', AU: 'EBAY_AU' };
    const response = await safeFetch(url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaces[countryCode(req.body.country)] || 'EBAY_US'
      }
    });
    const data = await readLimited(response);
    res.set('Cache-Control', 'no-store').json({
      results: (data.itemSummaries || []).map((item) => ({
        title: item.title || 'Sans titre',
        brand: item.brand || '',
        image: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '',
        url: item.itemWebUrl || '',
        price: item.price?.value ? `${item.price.currency} ${item.price.value}` : '',
        source: 'eBay',
        sourceUrl: 'https://www.ebay.com/'
      }))
    });
  } catch (error) {
    sendError(res, error, 'ebay');
  }
});

app.post('/api/search/bestbuy', async (req, res) => {
  try {
    if (!process.env.BESTBUY_KEY) {
      return res.status(503).json({ error: 'La recherche Best Buy n’est pas configurée.' });
    }
    const query = text(req.body.query, 'query', 2, 180);
    const url = new URL('https://api.bestbuy.com/v1/products');
    url.searchParams.set('search', query);
    url.searchParams.set('apiKey', process.env.BESTBUY_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('pageSize', '20');
    const response = await safeFetch(url);
    const data = await readLimited(response);
    res.set('Cache-Control', 'no-store').json({
      results: (data.products || []).map((product) => ({
        title: product.name || 'Sans titre',
        brand: product.manufacturer || '',
        image: product.image || '',
        url: product.url || product.productLink || '',
        source: 'Best Buy',
        sourceUrl: 'https://www.bestbuy.com/'
      }))
    });
  } catch (error) {
    sendError(res, error, 'bestbuy');
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Route API inconnue.' }));
app.use(express.static(publicDirectory, {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, path) {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html') && !pathHasExtension(req.path)) {
    return res.sendFile('index.html', { root: publicDirectory });
  }
  return next();
});
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Requête JSON invalide.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: `Image trop volumineuse. Maximum : ${Math.round(maxImageBytes / 1024 / 1024)} Mo.` });
  }
  return next(error);
});

function pathHasExtension(path) {
  return Boolean(pathnameExtension(path));
}

function pathnameExtension(path) {
  const last = path.split('/').pop() || '';
  return last.includes('.') ? last.slice(last.lastIndexOf('.')) : '';
}

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Loupe écoute sur le port ${port}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.safeFetch = safeFetch;
module.exports.text = text;
module.exports.imageUrl = imageUrl;
module.exports.parseIdentify2Protect = parseIdentify2Protect;
module.exports.parseEcap = parseEcap;
module.exports.parseTraceObject = parseTraceObject;
module.exports.parsePublicPage = parsePublicPage;
module.exports.assertPublicHost = assertPublicHost;
