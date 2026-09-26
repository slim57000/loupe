const test = require('node:test');
const assert = require('node:assert/strict');
const { after, before } = require('node:test');

process.env.ACCESS_TOKENS = '';
process.env.GOOGLE_VISION_KEY = '';
const { app, safeFetch, parseIdentify2Protect, parseEcap, parseTraceObject, parsePublicPage, assertPublicHost } = require('../proxy/server');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('le contrôle de santé est public', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('la configuration publique ne révèle aucun secret', async () => {
  const response = await fetch(`${baseUrl}/api/public-config`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.authRequired, false);
  assert.equal(typeof data.maxImageMb, 'number');
  assert.equal(JSON.stringify(data).includes('KEY'), false);
});

test('la page et le client sont servis', async () => {
  const page = await fetch(`${baseUrl}/`);
  const script = await fetch(`${baseUrl}/app.js`);
  const translations = await fetch(`${baseUrl}/i18n.js`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>Loupe/);
  assert.equal(script.status, 200);
  assert.match(await script.text(), /const programs/);
  assert.equal(translations.status, 200);
  assert.match(await translations.text(), /export function applyLanguage/);
});

test('une route API inconnue renvoie 404', async () => {
  const response = await fetch(`${baseUrl}/api/inconnue`, { method: 'POST' });
  assert.equal(response.status, 404);
});

test('un code-barres invalide est refusé', async () => {
  const response = await fetch(`${baseUrl}/api/upc/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upc: 'abc' })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /chiffres/);
});

test('un programme officiel inconnu est refusé', async () => {
  const response = await fetch(`${baseUrl}/api/program/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program: 'unknown' })
  });
  assert.equal(response.status, 400);
});

test('une analyse sans configuration Vision renvoie 503', async () => {
  const response = await fetch(`${baseUrl}/api/vision/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl: 'https://example.org/image.jpg' })
  });
  assert.equal(response.status, 503);
});

test('les adresses réseau privées sont refusées', async () => {
  await assert.rejects(() => assertPublicHost('127.0.0.1'), /privées/);
  await assert.rejects(() => assertPublicHost('localhost'), /privées/);
});

test('une page publique est nettoyée avant extraction', () => {
  const page = parsePublicPage('<html><head><title>Example</title></head><body><script>secret()</script><h1> titre </h1><p> visible </p><a href="/next">next</a></body></html>', 'https://example.org/page');
  assert.equal(page.title, 'Example');
  assert.match(page.text, /titre/);
  assert.doesNotMatch(page.text, /secret/);
  assert.deepEqual(page.links, ['https://example.org/next']);
});

test('safeFetch refuse une destination non autorisée', async () => {
  await assert.rejects(() => safeFetch('https://127.0.0.1/'), /Destination externe refusée/);
});

test('la page Identify2Protect fournit ses objets publiés', () => {
  const html = `<div class="field__item">
    <a href="/files/object.jpg" target="_blank"><img src="/files/styles/object.jpg.webp"></a>
    <h3>T-Shirt<br>(Object Number 25-0002)</h3>
    <p>This t-shirt has a logo and a word below it.</p>
    <p><a class="usa-button" href="mailto:Identify2Protect@hsi.dhs.gov?subject=Identify2Protect%20Object%3A%2025-0002">Submit Tip for Object Number 25-0002</a></p>
  </div>`;
  const items = parseIdentify2Protect(html, 'https://www.dhs.gov/know2protect/identify2protect');
  assert.equal(items.length, 1);
  assert.equal(items[0].reference, '25-0002');
  assert.equal(items[0].title, 'T-Shirt');
  assert.equal(items[0].imageUrl, 'https://www.dhs.gov/files/object.jpg');
});

test('la page ECAP fournit ses personnes publiées', () => {
  const html = `<li class="portal-type-person">
    <a href="https://www.fbi.gov/wanted/ecap/jane-doe-46">
      <div class="focuspoint" data-base-url="https://www.fbi.gov/wanted/ecap/jane-doe-46/@@images/image/"><img alt="UNKNOWN INDIVIDUAL - JANE DOE 46" src="https://www.fbi.gov/wanted/ecap/jane-doe-46/@@images/image/preview"></div>
    </a>
  </li>`;
  const items = parseEcap(html, 'https://www.fbi.gov/wanted/ecap/view');
  assert.equal(items.length, 1);
  assert.equal(items[0].reference, 'UNKNOWN INDIVIDUAL - JANE DOE 46');
  assert.equal(items[0].sourceUrl, 'https://www.fbi.gov/wanted/ecap/jane-doe-46');
  assert.equal(items[0].imageUrl, 'https://www.fbi.gov/wanted/ecap/jane-doe-46/@@images/image/high');
});

test('la page Europol fournit ses objets publiés', () => {
  const data = { NodeLoader: { node: { lists: [{ items: [{ title: 'TRACE AN OBJECT - C46012025', alias: '/stopchildabuse/6444', summary: 'Trace this object', mainImage: { thumbs: [{ width: 100, url: '/small.png' }, { width: 800, url: '/large.png' }] } }] }] } } };
  const html = `<script>window.SERVER_DATA=${JSON.stringify(data)};</script>`;
  const items = parseTraceObject(html, 'https://www.europol.europa.eu/stopchildabuse');
  assert.equal(items.length, 1);
  assert.equal(items[0].reference, 'C46012025');
  assert.equal(items[0].imageUrl, 'https://www.europol.europa.eu/large.png');
  assert.equal(items[0].sourceUrl, 'https://www.europol.europa.eu/stopchildabuse/6444');
});
