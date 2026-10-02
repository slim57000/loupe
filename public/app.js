import { applyLanguage, confirmMessage, t, watchLanguageChanges } from './i18n.js';

const STORAGE_KEY = 'loupe.items.v1';
const VERSION = 1;

const programs = {
  identify2protect: {
    id: 'identify2protect',
    agency: 'DHS / HSI',
    country: 'États-Unis',
    name: 'Identify2Protect',
    description: 'Images anonymisées d’objets, lieux, logos, tatouages et détails à reconnaître.',
    pageUrl: 'https://www.dhs.gov/know2protect/identify2protect',
    reportUrl: 'https://www.dhs.gov/know2protect/identify2protect',
    types: ['object', 'location', 'logo', 'tattoo', 'watch', 'jewelry', 'clothing', 'scar', 'other']
  },
  traceObject: {
    id: 'traceObject',
    agency: 'Europol',
    country: 'Union européenne',
    name: 'Stop Child Abuse — Trace an Object',
    description: 'Objets et détails issus d’enquêtes non résolues, publiés pour demander l’aide du public.',
    pageUrl: 'https://www.europol.europa.eu/stopchildabuse',
    reportUrl: 'https://www.europol.europa.eu/stopchildabuse',
    types: ['object', 'location', 'logo', 'tattoo', 'watch', 'jewelry', 'clothing', 'scar', 'other']
  },
  ecap: {
    id: 'ecap',
    agency: 'FBI / NCMEC',
    country: 'États-Unis / international',
    name: 'Endangered Child Alert Program',
    description: 'Personnes non identifiées et leurs caractéristiques distinctives. Loupe n’effectue aucune recherche faciale automatique.',
    pageUrl: 'https://www.fbi.gov/wanted/ecap/view',
    reportUrl: 'https://tips.fbi.gov/home',
    types: ['tattoo', 'watch', 'jewelry', 'clothing', 'scar', 'other']
  }
};

const typeLabels = {
  object: 'Objet',
  location: 'Lieu',
  logo: 'Logo ou marque',
  tattoo: 'Tatouage',
  watch: 'Montre',
  jewelry: 'Bijou',
  clothing: 'Vêtement distinctif',
  scar: 'Cicatrice ou marque',
  other: 'Autre caractéristique'
};

const reportTemplates = {
  identify2protect: {
    fr: {
      title: 'Signalement Identify2Protect — HSI',
      intro: 'Indiquez ce que vous reconnaissez dans l’image, puis les informations utiles pour localiser le lieu, le commerce ou l’organisation concernée.',
      fields: [
        ['reference', 'Numéro d’objet', 'Reprenez exactement le numéro publié par HSI.'],
        ['image', 'Image concernée', 'Indiquez l’adresse de l’image officielle.'],
        ['description', 'Ce que vous reconnaissez', 'Marque, modèle, motif, texte, couleur, emplacement dans l’image.'],
        ['location', 'Lieu ou indice de lieu', 'Ville, rue, magasin, hôtel, pays.'],
        ['when', 'Période possible', 'Année ou estimation de la période.'],
        ['organization', 'Organisation ou équipe', 'Nom visible sur un logo, un uniforme, une bannière ou un objet.'],
        ['sources', 'Sources consultées', 'Adresses exactes vérifiées.'],
        ['followup', 'Autorisation de suivi', 'Indiquez oui ou non si HSI peut vous recontacter.']
      ]
    },
    en: {
      title: 'Identify2Protect report — HSI',
      intro: 'Describe what you recognise in the image, then add information that may help locate the place, business or organisation.',
      fields: [
        ['reference', 'Object number', 'Copy the exact number published by HSI.'],
        ['image', 'Relevant image', 'Provide the official image address.'],
        ['description', 'What you recognise', 'Brand, model, pattern, text, colour, position in the image.'],
        ['location', 'Place or location clue', 'City, street, shop, hotel, country.'],
        ['when', 'Possible period', 'Year or estimated period.'],
        ['organization', 'Organisation or team', 'Name visible on a logo, uniform, banner or object.'],
        ['sources', 'Sources checked', 'Exact addresses verified.'],
        ['followup', 'Follow-up permission', 'State yes or no if HSI may contact you.']
      ]
    }
  },
  traceObject: {
    fr: {
      title: 'Signalement Trace an Object — Europol',
      intro: 'Décrivez l’objet reconnu et tout élément pouvant aider Europol ou l’autorité nationale à poursuivre l’enquête.',
      fields: [
        ['reference', 'Référence de l’objet', 'Référence publiée par Europol, si elle existe.'],
        ['description', 'Objet reconnu et identification', 'Type, marque, modèle, dimensions, matériaux, texte.'],
        ['location', 'Lieu ou point de vente', 'Commerce, marché, site en ligne, pays, ville.'],
        ['when', 'Période d’achat ou de diffusion', 'Date estimée et source de cette estimation.'],
        ['sources', 'Sources consultées', 'Adresses exactes vérifiées.'],
        ['contact', 'Coordonnées facultatives', 'Ajoutez un moyen de contact uniquement si vous acceptez un suivi.']
      ]
    },
    en: {
      title: 'Trace an Object report — Europol',
      intro: 'Describe the recognised object and anything that may help Europol or a national authority continue the investigation.',
      fields: [
        ['reference', 'Object reference', 'Europol reference, if available.'],
        ['description', 'Recognised object and identification', 'Type, brand, model, dimensions, materials, text.'],
        ['location', 'Place or point of sale', 'Shop, market, website, country, city.'],
        ['when', 'Purchase or circulation period', 'Estimated date and the basis for that estimate.'],
        ['sources', 'Sources checked', 'Exact addresses verified.'],
        ['contact', 'Optional contact details', 'Add contact details only if you agree to follow-up.']
      ]
    }
  },
  ecap: {
    fr: {
      title: 'Signalement ECAP — FBI / NCMEC',
      intro: 'Le FBI demande autant d’identifiants que possible. N’ajoutez que des caractéristiques distinctives réellement observées et vérifiables.',
      fields: [
        ['reference', 'Personne concernée', 'Désignation publiée par le FBI, par exemple John/Jane Doe.'],
        ['description', 'Caractéristiques distinctives', 'Tatouages, montres, bijoux, vêtements, cicatrices, défaut visible.'],
        ['location', 'Indices de lieu', 'Endroit, type de logement, décor, signe distinctif.'],
        ['when', 'Période', 'Année, saison ou estimation fondée sur un indice visible.'],
        ['sources', 'Sources consultées', 'Adresses exactes des pages et images officielles.'],
        ['limitations', 'Limites de votre observation', 'Indiquez clairement ce que vous n’avez pas pu voir ou confirmer.']
      ]
    },
    en: {
      title: 'ECAP report — FBI / NCMEC',
      intro: 'The FBI requests as many identifiers as possible. Add only distinctive features that you actually observed and can verify.',
      fields: [
        ['reference', 'Person of interest', 'FBI designation, for example John/Jane Doe.'],
        ['description', 'Distinctive features', 'Tattoos, watch, jewelry, clothing, scars, visible defect.'],
        ['location', 'Location clues', 'Place, housing type, décor, distinctive sign.'],
        ['when', 'Period', 'Year, season or estimate based on a visible clue.'],
        ['sources', 'Sources checked', 'Exact official page and image addresses.'],
        ['limitations', 'Limits of your observation', 'Clearly state what you could not see or confirm.']
      ]
    }
  }
};

const statusLabels = {
  to_review: 'À examiner',
  lead_found: 'Piste trouvée',
  reported: 'Signalé'
};

const serviceLabels = {
  vision: 'Analyse visuelle Google Vision',
  serpapi: 'Recherche visuelle SerpApi',
  web: 'Recherche web',
  products: 'Catalogues ouverts',
  upc: 'Codes-barres',
  wikidata: 'Wikidata',
  manual: 'Inspection manuelle des liens',
  ebay: 'Recherche eBay',
  bestbuy: 'Recherche Best Buy'
};

const serviceUrls = {
  vision: 'https://console.cloud.google.com/apis/library/vision.googleapis.com',
  serpapi: 'https://serpapi.com/dashboard',
  web: 'https://programmablesearchengine.google.com/controlpanel/all',
  ebay: 'https://developer.ebay.com/',
  bestbuy: 'https://developer.bestbuy.com/'
};

const serviceKeyRequired = new Set(['vision', 'serpapi', 'web', 'ebay', 'bestbuy']);

const hotlines = [
  {
    name: 'INHOPE — réseau mondial',
    description: 'Sélectionnez votre pays pour joindre la ligne d’aide nationale compétente.',
    url: 'https://inhope.org/report-here',
    action: 'Trouver ma ligne d’aide'
  },
  {
    name: 'NCMEC CyberTipline — États-Unis',
    description: 'Signalement en ligne de l’exploitation sexuelle d’enfants.',
    url: 'https://report.cybertip.org/reporting',
    action: 'Signaler aux États-Unis'
  },
  {
    name: 'CyberTIP — Canada',
    description: 'Signalement fédéral canadien de l’exploitation sexuelle des enfants.',
    url: 'https://www.cybertip.ca/app/en/',
    action: 'Signaler au Canada'
  }
];

const THEME_KEY = 'loupe.theme';

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  return ['light', 'dark', 'auto'].includes(stored) ? stored : 'auto';
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

const state = {
  items: loadItems(),
  language: localStorage.getItem('loupe.language') === 'en' ? 'en' : 'fr',
  theme: loadTheme(),
  sessionImages: new Map(),
  serverConfig: null,
  publicConfig: null,
  selectedImage: null,
  replacingItemId: null,
  cropSource: null,
  cropImage: null,
  cropSelection: null,
  analysisRunning: false,
  stopAnalysis: false,
  languageWatchStarted: false
};

const byId = (id) => document.getElementById(id);
const mainContent = byId('mainContent');
const itemGrid = byId('itemsGrid');
const toastRegion = byId('toastRegion');
const resultDialog = byId('resultDialog');
const resultDialogTitle = byId('resultDialogTitle');
const resultDialogContent = byId('resultDialogContent');
const cropDialog = byId('cropDialog');
const cropCanvas = byId('cropCanvas');
const replaceImageInput = byId('replaceImageInput');

function createElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function createLink(label, url, className = 'button secondary') {
  const link = createElement('a', label, className);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatDate(value) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 'date inconnue';
  return new Date(timestamp).toLocaleString('fr', { dateStyle: 'short', timeStyle: 'short' });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === 'string' && programs[item.program]).map((item) => ({
      id: item.id,
      program: item.program,
      type: programs[item.program].types.includes(item.type) ? item.type : 'other',
      reference: String(item.reference || '').slice(0, 80),
      imageUrl: /^https:\/\//i.test(item.imageUrl || '') ? item.imageUrl : '',
      sourceUrl: /^https:\/\//i.test(item.sourceUrl || '') ? item.sourceUrl : '',
      description: String(item.description || '').slice(0, 4000),
      notes: String(item.notes || '').slice(0, 4000),
      status: statusLabels[item.status] ? item.status : 'to_review',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      analysis: item.analysis && typeof item.analysis === 'object' ? item.analysis : null
    }));
  } catch {
    return [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    return true;
  } catch {
    toast('Sauvegarde impossible : l’espace local du navigateur est plein.', 'error');
    return false;
  }
}

function toast(message, type = 'info') {
  const messageElement = createElement('div', null, `toast ${type}`);
  if (type === 'error') messageElement.setAttribute('role', 'alert');
  const textElement = createElement('span', message);
  const close = createElement('button', '×', 'toast-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer le message');
  close.addEventListener('click', () => messageElement.remove());
  messageElement.append(textElement, close);
  toastRegion.append(messageElement);
  setTimeout(() => messageElement.remove(), type === 'error' ? 9000 : 4500);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new Error('Le serveur Loupe ne répond pas.');
  }
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    const error = new Error(data.error || 'La requête a échoué.');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function initialize() {
  applyTheme(state.theme);
  applyLanguage(state.language);
  if (!state.languageWatchStarted) {
    watchLanguageChanges();
    state.languageWatchStarted = true;
  }
  renderPrograms();
  renderHotlines();
  populateProgramSelects();
  renderFilters();
  renderItems();
  bindEvents();
  try {
    state.serverConfig = await api('/api/config');
    state.publicConfig = state.serverConfig;
    mainContent.hidden = false;
    renderServices();
  } catch (error) {
    state.serverConfig = { services: {} };
    state.publicConfig = { maxImageMb: 3 };
    mainContent.hidden = false;
    renderServices();
    toast('Le serveur de recherche est indisponible. Les fonctions hors ligne restent utilisables.', 'error');
  }
}

function renderPrograms() {
  const grid = byId('programsGrid');
  const fragment = document.createDocumentFragment();
  for (const program of Object.values(programs)) {
    const card = createElement('article', null, 'program-card');
    const agency = createElement('p', program.agency, 'eyebrow');
    const title = createElement('h3', program.name);
    const description = createElement('p', program.description.trim());
    const country = createElement('p', `Public cible : ${program.country}`, 'field-help');
    const actions = createElement('div', null, 'program-actions');
    const importButton = createElement('button', 'Importer la liste officielle', 'button secondary');
    importButton.type = 'button';
    importButton.addEventListener('click', () => importOfficialList(program));
    actions.append(
      createLink('Page du programme', program.pageUrl),
      importButton,
      createLink(program.reportUrl === program.pageUrl ? 'Informations et signalement' : 'Signaler', program.reportUrl, 'button primary')
    );
    card.append(agency, title, description, country, actions);
    fragment.append(card);
  }
  grid.replaceChildren(fragment);
}

function renderHotlines() {
  const grid = byId('hotlinesGrid');
  const fragment = document.createDocumentFragment();
  for (const hotline of hotlines) {
    const card = createElement('article', null, 'program-card');
    card.append(
      createElement('h3', hotline.name),
      createElement('p', hotline.description),
      createLink(hotline.action, hotline.url, 'button primary')
    );
    fragment.append(card);
  }
  grid.replaceChildren(fragment);
}

function populateProgramSelects() {
  for (const id of ['itemProgram', 'batchProgram', 'filterProgram']) {
    const select = byId(id);
    const previous = select.value;
    const placeholder = id === 'filterProgram' ? 'Tous les programmes' : 'Choisir un programme';
    const fragment = document.createDocumentFragment();
    const option = createElement('option', placeholder);
    option.value = '';
    fragment.append(option);
    for (const program of Object.values(programs)) {
      const programOption = createElement('option', `${program.agency} — ${program.name}`);
      programOption.value = program.id;
      fragment.append(programOption);
    }
    select.replaceChildren(fragment);
    if ([...select.options].some((entry) => entry.value === previous)) select.value = previous;
  }
  updateTypeOptions();
}

function updateTypeOptions() {
  const program = programs[byId('itemProgram').value];
  const typeSelect = byId('itemType');
  const previous = typeSelect.value;
  const fragment = document.createDocumentFragment();
  const placeholder = createElement('option', 'Choisir une nature');
  placeholder.value = '';
  fragment.append(placeholder);
  for (const type of program?.types || Object.keys(typeLabels)) {
    const option = createElement('option', typeLabels[type] || type);
    option.value = type;
    fragment.append(option);
  }
  typeSelect.replaceChildren(fragment);
  if (program?.types.includes(previous)) {
    typeSelect.value = previous;
    typeSelect.title = '';
  } else if (previous) {
    typeSelect.title = 'Cette nature n’est pas proposée pour ce programme.';
  }
}

function renderServices() {
  const list = byId('servicesList');
  const fragment = document.createDocumentFragment();
  for (const [key, label] of Object.entries(serviceLabels)) {
    const row = createElement('div', null, 'service-row');
    row.append(createElement('span', label));
    const available = Boolean(state.serverConfig?.services?.[key]);
    const status = available ? 'Configuré' : serviceKeyRequired.has(key) ? 'Clé requise' : 'Gratuit';
    row.append(createElement('span', status, `service-status ${available ? 'available' : 'unavailable'}`));
    if (serviceUrls[key]) row.append(createLink('Configurer', serviceUrls[key], 'text-link'));
    fragment.append(row);
  }
  list.replaceChildren(fragment);
}

function renderFilters() {
  const typeSelect = byId('filterType');
  const previous = typeSelect.value;
  const fragment = document.createDocumentFragment();
  const all = createElement('option', 'Toutes les natures');
  all.value = '';
  fragment.append(all);
  for (const [value, label] of Object.entries(typeLabels)) {
    const option = createElement('option', label);
    option.value = value;
    fragment.append(option);
  }
  typeSelect.replaceChildren(fragment);
  typeSelect.value = previous;
}

function bindEvents() {
  byId('languageSelect').value = state.language;
  byId('languageSelect').addEventListener('change', (event) => {
    state.language = event.target.value === 'en' ? 'en' : 'fr';
    localStorage.setItem('loupe.language', state.language);
    applyLanguage(state.language);
  });
  byId('themeSelect').value = state.theme;
  byId('themeSelect').addEventListener('change', (event) => {
    const next = ['light', 'dark', 'auto'].includes(event.target.value) ? event.target.value : 'auto';
    state.theme = next;
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
  byId('itemProgram').addEventListener('change', updateTypeOptions);
  for (const button of document.querySelectorAll('.tab')) {
    button.addEventListener('click', () => selectTab(button));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...document.querySelectorAll('.tab')];
      const current = tabs.indexOf(button);
      const next = tabs[(current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      selectTab(next);
    });
  }
  byId('itemImageFile').addEventListener('change', handleNewImage);
  byId('manualForm').addEventListener('submit', inspectManualPage);
  byId('formSingle').addEventListener('submit', handleSingleSubmit);
  byId('formBatch').addEventListener('submit', handleBatchSubmit);
  for (const id of ['filterSearch', 'filterProgram', 'filterType', 'filterStatus']) {
    byId(id).addEventListener(id === 'filterSearch' ? 'input' : 'change', renderItems);
  }
  byId('btnAnalyzeAll').addEventListener('click', analyzeAll);
  byId('btnStopAnalysis').addEventListener('click', (event) => {
    state.stopAnalysis = true;
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Arrêt demandé…';
  });
  byId('btnCrossref').addEventListener('click', crossReference);
  byId('btnExport').addEventListener('click', exportItems);
  byId('btnImport').addEventListener('click', () => byId('importFile').click());
  byId('importFile').addEventListener('change', importItems);
  byId('btnCloseResultDialog').addEventListener('click', () => resultDialog.close());
  byId('btnCancelCrop').addEventListener('click', () => cropDialog.close());
  byId('btnApplyCrop').addEventListener('click', applyCrop);
  replaceImageInput.addEventListener('change', handleReplaceImage);
  cropCanvas.addEventListener('pointerdown', startCropSelection);
  cropCanvas.addEventListener('pointermove', moveCropSelection);
  cropCanvas.addEventListener('pointerup', endCropSelection);
}

async function handleNewImage(event) {
  const file = event.target.files?.[0];
  const status = byId('localImageStatus');
  if (!file) {
    state.selectedImage = null;
    status.textContent = '';
    return;
  }
  status.textContent = 'Compression locale de l’image…';
  try {
    state.selectedImage = await compressImage(file, state.publicConfig?.maxImageMb || 10);
    status.textContent = `Image prête : ${formatBytes(state.selectedImage.bytes)}. Elle ne sera pas conservée : un rechargement de la page la fera disparaître.`;
  } catch (error) {
    state.selectedImage = null;
    event.target.value = '';
    status.textContent = error.message;
  }
}

function validateHttpsUrl(value, label) {
  if (!value) return '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} n’est pas une adresse valide.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`${label} doit commencer par https:// et ne doit pas contenir d’identifiant.`);
  }
  return parsed.toString();
}

function handleSingleSubmit(event) {
  event.preventDefault();
  try {
    const programId = byId('itemProgram').value;
    const type = byId('itemType').value;
    if (!programId || !type) throw new Error('Choisissez le programme et la nature de la fiche.');
    const imageUrl = validateHttpsUrl(byId('itemImageUrl').value.trim(), 'L’adresse de l’image');
    if (!imageUrl && !state.selectedImage) throw new Error('Ajouter une adresse HTTPS ou importer une image.');
    const now = new Date().toISOString();
    const item = {
      id: uid(),
      program: programId,
      type,
      reference: byId('itemRef').value.trim(),
      imageUrl,
      sourceUrl: validateHttpsUrl(byId('itemSourceUrl').value.trim(), 'La page source exacte'),
      description: byId('itemDescription').value.trim(),
      notes: byId('itemNotes').value.trim(),
      status: 'to_review',
      createdAt: now,
      updatedAt: now,
      analysis: null
    };
    if (state.selectedImage) state.sessionImages.set(item.id, state.selectedImage.dataUrl);
    state.items.unshift(item);
    saveItems();
    byId('formSingle').reset();
    byId('itemImageFile').value = '';
    byId('localImageStatus').textContent = '';
    state.selectedImage = null;
    renderItems();
    toast('Fiche ajoutée.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function handleBatchSubmit(event) {
  event.preventDefault();
  const programId = byId('batchProgram').value;
  if (!programs[programId]) return;
  const lines = byId('batchInput').value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return;
  const now = new Date().toISOString();
  let added = 0;
  for (const line of lines) {
    try {
      const [rawUrl, reference = ''] = line.split('|').map((part) => part.trim());
      const imageUrl = validateHttpsUrl(rawUrl, 'Chaque adresse d’image');
      state.items.unshift({
        id: uid(),
        program: programId,
        type: 'object',
        reference: reference.slice(0, 80),
        imageUrl,
        sourceUrl: '',
        description: '',
        notes: '',
        status: 'to_review',
        createdAt: now,
        updatedAt: now,
        analysis: null
      });
      added += 1;
    } catch {
      continue;
    }
  }
  const skipped = lines.length - added;
  saveItems();
  byId('formBatch').reset();
  renderItems();
  if (!added) {
    toast('Aucune adresse valide : chaque ligne doit commencer par une adresse https://.', 'error');
    return;
  }
  const skippedText = skipped ? `, ${skipped} ligne${skipped > 1 ? 's ignorées' : ' ignorée'}` : '';
  toast(`${added} adresse${added > 1 ? 's ajoutées' : ' ajoutée'}${skippedText}.`, 'success');
}

function getItemImage(item) {
  return state.sessionImages.get(item.id) || item.imageUrl || '';
}

function filteredItems() {
  const query = normalizeText(byId('filterSearch').value);
  const program = byId('filterProgram').value;
  const type = byId('filterType').value;
  const status = byId('filterStatus').value;
  return state.items.filter((item) => {
    const analysis = item.analysis || {};
    const haystack = normalizeText([
      item.reference,
      item.description,
      item.notes,
      analysis.keywords?.join(' '),
      analysis.brand,
      analysis.barcodes?.join(' '),
      analysis.findings?.map((finding) => `${finding.title} ${finding.brand} ${finding.snippet}`).join(' ')
    ].join(' '));
    return (!query || haystack.includes(query))
      && (!program || item.program === program)
      && (!type || item.type === type)
      && (!status || item.status === status);
  });
}

function renderItems() {
  const items = filteredItems();
  byId('itemCount').textContent = items.length === state.items.length ? String(state.items.length) : `${items.length} / ${state.items.length}`;
  const empty = byId('emptyState');
  empty.textContent = state.items.length ? 'Aucune fiche ne correspond aux filtres.' : 'Aucune fiche pour le moment. Ajoutez une fiche pour commencer.';
  empty.hidden = items.length > 0;
  const fragment = document.createDocumentFragment();
  for (const item of items) fragment.append(renderCard(item));
  itemGrid.replaceChildren(fragment);
}

function selectTab(button) {
  const target = button.dataset.tab;
  for (const tab of document.querySelectorAll('.tab')) {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  byId('tabSingle').classList.toggle('active', target === 'single');
  byId('tabSingle').hidden = target !== 'single';
  byId('tabBatch').classList.toggle('active', target === 'batch');
  byId('tabBatch').hidden = target !== 'batch';
}

function renderCard(item) {
  const card = byId('itemCardTemplate').content.firstElementChild.cloneNode(true);
  const program = programs[item.program];
  card.dataset.id = item.id;
  card.querySelector('.program-tag').textContent = program.agency;
  card.querySelector('.type-tag').textContent = typeLabels[item.type] || item.type;
  const status = card.querySelector('.card-status');
  status.value = item.status;
  status.setAttribute('aria-label', `Statut de la fiche ${item.reference || typeLabels[item.type]}`);
  status.addEventListener('change', () => updateStatus(item.id, status.value));
  const reference = card.querySelector('.card-ref');
  reference.textContent = item.reference || 'Sans référence';
  const description = card.querySelector('.card-description');
  description.textContent = item.description || 'Aucune description.';
  const source = card.querySelector('.card-source');
  if (item.sourceUrl) {
    source.append(createLink('Voir la page source exacte', item.sourceUrl, 'text-link'));
  } else {
    source.textContent = 'Ajoutez la page source exacte où ce détail est publié.';
  }
  const image = card.querySelector('img');
  const placeholder = card.querySelector('.image-placeholder');
  const imageSource = getItemImage(item);
  if (imageSource) {
    image.src = imageSource;
    image.hidden = false;
    placeholder.hidden = true;
    image.alt = item.reference || typeLabels[item.type];
  }
  renderAnalysisSummary(card.querySelector('.card-analysis'), item);
  card.querySelector('.analyze').addEventListener('click', () => analyzeItem(item, true));
  card.querySelector('.crop').addEventListener('click', () => openCropper(item));
  const reverse = card.querySelector('.reverse');
  reverse.addEventListener('click', () => reverseSearch(item));
  if (!item.imageUrl) {
    reverse.disabled = true;
    reverse.title = 'La recherche inversée nécessite une adresse HTTPS publique.';
  }
  card.querySelector('.replace').addEventListener('click', () => {
    if (!confirmMessage('Remplacer l’image de cette fiche ? L’image actuelle sera perdue.')) return;
    state.replacingItemId = item.id;
    replaceImageInput.value = '';
    replaceImageInput.click();
  });
  card.querySelector('.report').addEventListener('click', () => {
    window.open(program.reportUrl, '_blank', 'noopener,noreferrer');
  });
  card.querySelector('.summary').addEventListener('click', () => openSignalementSummary(item));
  card.querySelector('.delete').addEventListener('click', () => deleteItem(item.id));
  return card;
}

function updateStatus(id, value) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item || !statusLabels[value]) return;
  item.status = value;
  item.updatedAt = new Date().toISOString();
  saveItems();
  renderItems();
}

function deleteItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item || !confirmMessage(`Supprimer définitivement cette fiche${item.reference ? ` (${item.reference})` : ''} ?`)) return;
  state.items = state.items.filter((entry) => entry.id !== id);
  state.sessionImages.delete(id);
  saveItems();
  renderItems();
}

function renderAnalysisSummary(container, item) {
  container.replaceChildren();
  const analysis = item.analysis;
  if (!analysis) return;
  container.hidden = false;
  container.append(createElement('strong', 'Dernière analyse'));
  const rows = [
    ['Termes', analysis.keywords?.slice(0, 6).join(', ') || '—'],
    ['Marque à confirmer', analysis.brand || '—'],
    ['Correspondances', `${analysis.matchScore || 0}/100`],
    ['Date', formatDate(analysis.analyzedAt)]
  ];
  for (const [label, value] of rows) {
    const row = createElement('div', null, 'summary-row');
    row.append(createElement('span', label, 'summary-label'), createElement('span', value));
    container.append(row);
  }
  if (analysis.findings?.length) {
    const button = createElement('button', `Voir les ${analysis.findings.length} résultats et sources`, 'button secondary small full');
    button.addEventListener('click', () => openFindings(item));
    container.append(button);
  }
}

function extractVision(vision) {
  const logos = unique((vision.logoAnnotations || []).map((entry) => entry.description));
  const textValue = (vision.textAnnotations || [])[0]?.description || '';
  const objects = unique((vision.localizedObjectAnnotations || []).map((entry) => entry.name));
  const webEntities = (vision.webDetection?.webEntities || [])
    .map((entry) => ({ value: entry.value, score: entry.score }))
    .filter((entry) => entry.value);
  const pages = (vision.webDetection?.pagesWithMatchingImages || []).map((entry) => ({
    title: entry.pageTitle || '',
    url: entry.fullMatchUrl || entry.partialMatchUrl || ''
  })).filter((entry) => entry.url);
  const colors = (vision.imagePropertiesAnnotation?.dominantColors?.colors || [])
    .map((entry) => ({ name: entry.name || '', score: entry.score || 0, fraction: entry.pixelFraction || 0 }))
    .filter((entry) => entry.name);
  const barcodes = unique(textValue.match(/\b\d{8,14}\b/g) || []);
  const keywords = unique([...logos, ...objects, ...webEntities.map((entry) => entry.value), ...textValue.split(/\s+/)]).slice(0, 30);
  const countryCodes = unique(pages.map((page) => {
    try {
      const hostname = new URL(page.url).hostname;
      const parts = hostname.split('.');
      const suffix = parts.at(-2)?.toLowerCase();
      const map = { fr: 'France', de: 'Allemagne', es: 'Espagne', it: 'Italie', uk: 'Royaume-Uni', au: 'Australie', ca: 'Canada' };
      return map[suffix];
    } catch {
      return '';
    }
  }));
  return {
    logos,
    text: textValue,
    objects,
    webEntities,
    pages,
    colors,
    barcodes,
    keywords,
    countryCodes
  };
}

function normalizeFindings(results, sourceOverride) {
  return (results || []).map((entry) => ({
    title: String(entry.title || 'Sans titre').slice(0, 300),
    brand: String(entry.brand || '').slice(0, 160),
    image: /^https:\/\//i.test(entry.image || '') ? entry.image : '',
    url: /^https:\/\//i.test(entry.url || '') ? entry.url : '',
    snippet: String(entry.snippet || entry.price || '').slice(0, 600),
    source: String(entry.source || sourceOverride || 'Source').slice(0, 120),
    sourceUrl: /^https:\/\//i.test(entry.sourceUrl || '') ? entry.sourceUrl : '',
    score: Number.isFinite(Number(entry.score)) ? Number(entry.score) : 0
  })).slice(0, 20);
}

async function analyzeItem(item, showResults = false) {
  const source = getItemImage(item);
  let visionError = '';
  let extracted = { logos: [], text: '', objects: [], webEntities: [], pages: [], colors: [], barcodes: [], keywords: [], countryCodes: [] };
  if (source) {
    try {
      const payload = source.startsWith('data:')
        ? { imageBase64: source }
        : { imageUrl: source };
      const vision = await api('/api/vision/analyze', { method: 'POST', body: JSON.stringify(payload) });
      extracted = extractVision(vision);
    } catch (error) {
      visionError = error.message;
    }
  }
  const descriptionQuery = item.description.split(/[.!?\n]/).map((part) => part.trim()).filter(Boolean).slice(0, 2).join('. ');
  const baseQuery = unique([descriptionQuery, extracted.logos[0], extracted.objects.slice(0, 2).join(' '), extracted.keywords.slice(0, 5).join(' ')]).join(' ').slice(0, 240);
  const requests = [];
  if (baseQuery) {
    requests.push(api('/api/search/web', { method: 'POST', body: JSON.stringify({ query: baseQuery }) })
      .then((data) => normalizeFindings(data.results, 'Recherche web')));
  }
  if (baseQuery && ['object', 'watch', 'jewelry', 'clothing', 'logo'].includes(item.type)) {
    requests.push(api('/api/search/products', { method: 'POST', body: JSON.stringify({ query: baseQuery }) })
      .then((data) => normalizeFindings(data.results, 'Catalogue ouvert')));
    if (state.serverConfig?.services?.ebay) {
      requests.push(api('/api/search/ebay', { method: 'POST', body: JSON.stringify({ query: baseQuery }) })
        .then((data) => normalizeFindings(data.results, 'eBay')));
    }
    if (state.serverConfig?.services?.bestbuy) {
      requests.push(api('/api/search/bestbuy', { method: 'POST', body: JSON.stringify({ query: baseQuery }) })
        .then((data) => normalizeFindings(data.results, 'Best Buy')));
    }
  }
  for (const barcode of extracted.barcodes.slice(0, 2)) {
    requests.push(api('/api/upc/lookup', { method: 'POST', body: JSON.stringify({ upc: barcode }) })
      .then((data) => normalizeFindings(data.results, 'Code-barres')));
  }
  if (baseQuery && item.type === 'tattoo') {
    requests.push(api('/api/search/tattoos', { method: 'POST', body: JSON.stringify({ query: `${baseQuery} tattoo design` }) })
      .then((data) => normalizeFindings(data.results, 'Recherche de tatouages')));
  }
  const settled = await Promise.allSettled(requests);
  const findings = settled.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : []);
  const errors = [
    ...(visionError ? [visionError] : []),
    ...settled.filter((entry) => entry.status === 'rejected').map((entry) => entry.reason.message)
  ];
  let brand = extracted.logos[0] || '';
  let brandData = null;
  if (brand) {
    try {
      brandData = await api('/api/wikidata/brand', { method: 'POST', body: JSON.stringify({ brandName: brand }) });
      brand = brandData.brand || brand;
    } catch {
      brandData = null;
    }
  }
  const sourceNames = unique(findings.map((entry) => entry.source));
  const score = findings.length
    ? Math.min(95, 10 + sourceNames.length * 15 + extracted.logos.length * 10 + extracted.pages.length * 5)
    : 0;
  const analysis = {
    analyzedAt: new Date().toISOString(),
    keywords: extracted.keywords,
    logos: extracted.logos,
    objects: extracted.objects,
    colors: extracted.colors.slice(0, 5),
    barcodes: extracted.barcodes,
    webPages: extracted.pages.slice(0, 10),
    countryCandidates: extracted.countryCodes,
    brand,
    brandData,
    matchScore: score,
    findings: findings.slice(0, 20),
    errors: unique(errors).slice(0, 5)
  };
  item.analysis = analysis;
  item.updatedAt = new Date().toISOString();
  saveItems();
  renderItems();
  if (showResults) {
    if (findings.length) {
      openFindings(item);
      toast(`${findings.length} résultats trouvés. Le statut de la fiche n’a pas été modifié.`, 'success');
    } else {
      openMessage('Aucun résultat exploitable', errors.length ? errors.join(' ') : 'Ajoutez une description plus précise ou vérifiez les services configurés.');
    }
  }
  return analysis;
}

function suggestedSearchQueries(item, analysis) {
  const base = unique([
    item.reference,
    analysis.brand,
    ...(analysis.keywords || []).slice(0, 5),
    typeLabels[item.type]
  ]).join(' ');
  const country = analysis.countryCandidates?.[0] || '';
  const queries = [base, [base, country].filter(Boolean).join(' '), [typeLabels[item.type], base, 'achat'].filter(Boolean).join(' ')]
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => value.length > 3)
    .filter((value, index, values) => values.indexOf(value) === index);
  return queries.slice(0, 4);
}

function appendSuggestedSearches(item, analysis) {
  const queries = suggestedSearchQueries(item, analysis);
  if (!queries.length) return;
  const section = createElement('section', null, 'result-section');
  section.append(createElement('h3', 'Recherches complémentaires proposées'));
  section.append(createElement('p', 'Ces requêtes sont construites à partir des éléments observés. Ouvrez-les, vérifiez les pages et n’utilisez que les sources exactes.', 'field-help'));
  for (const query of queries) {
    const block = createElement('div', null, 'finding-card');
    const content = createElement('div', null, 'finding-content');
    content.append(createElement('strong', query));
    const links = createElement('div', null, 'program-actions');
    const encoded = encodeURIComponent(query);
    links.append(
      createLink('Google', `https://www.google.com/search?q=${encoded}`),
      createLink('Google Images', `https://www.google.com/search?tbm=isch&q=${encoded}`),
      createLink('Bing', `https://www.bing.com/search?q=${encoded}`),
      createLink('Shopping', `https://www.google.com/search?tbm=shop&q=${encoded}`)
    );
    content.append(links);
    block.append(content);
    section.append(block);
  }
  resultDialogContent.append(section);
}

function openFindings(item) {
  const analysis = item.analysis;
  if (!analysis) return;
  openResultDialog(`Résultats — ${item.reference || typeLabels[item.type]}`);
  const summary = createElement('div', null, 'result-summary');
  summary.append(
    createElement('p', analysis.brand ? `Marque détectée, à confirmer : ${analysis.brand}` : 'Aucune marque détectée.'),
    createElement('p', analysis.keywords?.length ? `Termes observés : ${analysis.keywords.slice(0, 12).join(', ')}` : 'Aucun terme visuel extrait.'),
    createElement('p', `Correspondances trouvées : ${analysis.matchScore}/100. Ce score n’est pas une probabilité d’identité.`)
  );
  if (analysis.brandData?.wikidataId) {
    summary.append(createLink('Consulter la source Wikidata', `https://www.wikidata.org/wiki/${encodeURIComponent(analysis.brandData.wikidataId)}`, 'text-link'));
  }
  resultDialogContent.append(summary);
  appendSourceList('Correspondances visuelles trouvées dans l’analyse', analysis.webPages);
  appendFindingList(analysis.findings);
  appendSuggestedSearches(item, analysis);
  appendSourceList('Pages de référence issues de l’analyse', (analysis.findings || []).map((entry) => ({ title: entry.title, url: entry.url })));
  if (analysis.errors?.length) {
    const errors = createElement('section', null, 'result-section');
    errors.append(createElement('h3', 'Services indisponibles pendant cette analyse'));
    const list = createElement('ul');
    analysis.errors.forEach((error) => list.append(createElement('li', error)));
    errors.append(list);
    resultDialogContent.append(errors);
  }
}

function appendFindingList(findings) {
  const section = createElement('section', null, 'result-section');
  section.append(createElement('h3', 'Résultats de recherche'));
  if (!findings?.length) {
    section.append(createElement('p', 'Aucun résultat.'));
    resultDialogContent.append(section);
    return;
  }
  const list = createElement('div', null, 'finding-list');
  for (const finding of findings) {
    const card = createElement('article', null, 'finding-card');
    if (finding.image) {
      const image = createElement('img');
      image.src = finding.image;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      card.append(image);
    }
    const content = createElement('div', null, 'finding-content');
    content.append(createElement('strong', finding.title));
    if (finding.brand) content.append(createElement('p', finding.brand));
    if (finding.snippet) content.append(createElement('p', finding.snippet));
    const metadata = createElement('p', `${finding.source}${finding.score ? ` · score ${finding.score}` : ''}`, 'field-help');
    content.append(metadata);
    if (finding.url) content.append(createLink('Ouvrir le résultat', finding.url, 'text-link'));
    card.append(content);
    list.append(card);
  }
  section.append(list);
  resultDialogContent.append(section);
}

function appendSourceList(title, sources) {
  const filtered = (sources || []).filter((entry) => entry.url);
  if (!filtered.length) return;
  const section = createElement('section', null, 'result-section');
  section.append(createElement('h3', title));
  const list = createElement('ul', null, 'source-list');
  for (const source of filtered) {
    const item = createElement('li');
    item.append(createLink(source.title || source.url, source.url, 'text-link'));
    list.append(item);
  }
  section.append(list);
  resultDialogContent.append(section);
}

async function inspectManualPage(event) {
  event.preventDefault();
  const input = byId('manualUrl');
  const status = byId('manualStatus');
  const button = event.currentTarget.querySelector('button');
  let sourceUrl;
  try {
    sourceUrl = validateHttpsUrl(input.value.trim(), 'L’adresse de la page');
    if (!sourceUrl) throw new Error('Collez une adresse HTTPS publique.');
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  button.disabled = true;
  status.textContent = 'Lecture de la page publique…';
  try {
    const data = await api('/api/manual/inspect', { method: 'POST', body: JSON.stringify({ url: sourceUrl }) });
    status.textContent = 'Page inspectée. Vérifiez les informations avant de créer une fiche.';
    openManualResult(data);
  } catch (error) {
    status.textContent = error.message;
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

function openManualResult(data) {
  openResultDialog('Page inspectée');
  const summary = createElement('div', null, 'result-summary');
  summary.append(createElement('strong', data.title || 'Sans titre'));
  if (data.description) summary.append(createElement('p', data.description));
  summary.append(createElement('p', data.canonical || data.sourceUrl, 'field-help'));
  summary.append(createLink('Ouvrir la page originale', data.sourceUrl, 'text-link'));
  const text = createElement('textarea');
  text.value = data.text || 'Aucun texte visible n’a été extrait.';
  text.rows = 14;
  text.readOnly = true;
  const links = createElement('div', null, 'source-list');
  for (const url of (data.links || []).slice(0, 20)) links.append(createLink(url, url, 'text-link'));
  const section = createElement('section', null, 'result-section');
  section.append(createElement('h3', 'Liens publics détectés'), links);
  const actions = createElement('div', null, 'program-actions');
  const add = createElement('button', 'Créer une fiche depuis cette page', 'button primary');
  add.addEventListener('click', () => addManualCase(data));
  actions.append(add, createLink('Ouvrir la page originale', data.sourceUrl));
  resultDialogContent.append(summary, createElement('h3', 'Texte visible'), text, section, actions);
}

function addManualCase(data) {
  const programId = byId('itemProgram').value;
  const type = byId('itemType').value;
  if (!programs[programId] || !type) {
    toast('Choisissez d’abord un programme et une nature dans le formulaire de fiche.', 'error');
    return;
  }
  const now = new Date().toISOString();
  state.items.unshift({
    id: uid(),
    program: programId,
    type,
    reference: '',
    imageUrl: '',
    sourceUrl: data.canonical || data.sourceUrl,
    description: [data.title, data.description].filter(Boolean).join(' — '),
    notes: `Inspection manuelle.\n${(data.text || '').slice(0, 3500)}`,
    status: 'to_review',
    createdAt: now,
    updatedAt: now,
    analysis: null
  });
  saveItems();
  renderItems();
  resultDialog.close();
  toast('Fiche créée depuis la page publique.', 'success');
}

async function importOfficialList(program) {
  toast(`Lecture de la page officielle ${program.name}…`);
  try {
    const data = await api('/api/program/import', {
      method: 'POST',
      body: JSON.stringify({ program: program.id })
    });
    openResultDialog(`Liste officielle — ${program.name}`);
    const summary = createElement('div', null, 'result-summary');
    summary.append(
      createElement('p', data.manual ? data.note : `${data.items.length} objet(s) publié(s) détecté(s).`),
      createElement('p', 'Loupe ne récupère que les objets, références et liens de la page officielle publique. Vérifiez chaque fiche avant de l’utiliser.')
    );
    summary.append(createLink('Voir la page officielle', data.sourceUrl, 'text-link'));
    resultDialogContent.append(summary);
    if (!data.items.length) return;
    const list = createElement('div', null, 'finding-list');
    for (const entry of data.items.slice(0, 12)) {
      const card = createElement('article', null, 'finding-card');
      const content = createElement('div', null, 'finding-content');
      content.append(createElement('strong', entry.title || entry.reference));
      if (entry.reference) content.append(createElement('p', `Référence : ${entry.reference}`, 'field-help'));
      if (entry.description) content.append(createElement('p', entry.description));
      if (entry.sourceUrl) content.append(createLink('Voir la fiche officielle', entry.sourceUrl, 'text-link'));
      card.append(content);
      list.append(card);
    }
    if (data.items.length > 12) list.append(createElement('p', `${data.items.length - 12} objet(s) supplémentaire(s) seront importé(s).`, 'field-help'));
    resultDialogContent.append(list);
    const actions = createElement('div', null, 'program-actions');
    const confirmImport = createElement('button', 'Ajouter ces fiches', 'button primary');
    confirmImport.addEventListener('click', () => addOfficialItems(data.items, program));
    actions.append(confirmImport, createLink('Ouvrir la page officielle', data.sourceUrl));
    resultDialogContent.append(actions);
  } catch (error) {
    openMessage('Import officiel indisponible', error.message);
  }
}

function inferOfficialType(programId, entry) {
  if (programId === 'ecap') return 'other';
  const value = normalizeText(`${entry.title || ''} ${entry.description || ''}`);
  if (/(tattoo|tatouage)/.test(value)) return 'tattoo';
  if (/(watch|montre)/.test(value)) return 'watch';
  if (/(jewelry|necklace|ring|bijou|collier|bague)/.test(value)) return 'jewelry';
  if (/(shirt|tee|hoodie|clothing|chaussure|shoe|hat|casquette|chemise)/.test(value)) return 'clothing';
  if (/(location|room|carpet|tile|lieu|salle|carrelage)/.test(value)) return 'location';
  return 'object';
}

function addOfficialItems(entries, program) {
  const existing = new Set(state.items.map((item) => `${item.program}|${item.reference}|${item.sourceUrl}`));
  const now = new Date().toISOString();
  let added = 0;
  for (const entry of entries) {
    const sourceUrl = /^https:\/\//i.test(entry.sourceUrl || '') ? entry.sourceUrl : '';
    const reference = String(entry.reference || '').slice(0, 80);
    const key = `${program.id}|${reference}|${sourceUrl}`;
    if (existing.has(key)) continue;
    existing.add(key);
    state.items.unshift({
      id: uid(),
      program: program.id,
      type: inferOfficialType(program.id, entry),
      reference,
      imageUrl: program.id === 'ecap' ? '' : (/^https:\/\//i.test(entry.imageUrl || '') ? entry.imageUrl : ''),
      sourceUrl,
      description: program.id === 'ecap' ? `Personne non identifiée publiée par ${program.agency}. Ajoutez uniquement les caractéristiques distinctives que vous reconnaissez.` : String(entry.description || '').slice(0, 4000),
      notes: 'Importé depuis la page officielle. Vérifiez la fiche avant toute recherche.',
      status: 'to_review',
      createdAt: now,
      updatedAt: now,
      analysis: null
    });
    added += 1;
  }
  saveItems();
  renderItems();
  resultDialog.close();
  toast(`${added} fiche(s) ajoutée(s) depuis la page officielle.`, 'success');
}

function openResultDialog(title) {
  resultDialogTitle.textContent = title;
  resultDialogContent.replaceChildren();
  if (!resultDialog.open) resultDialog.showModal();
}

function openMessage(title, message) {
  openResultDialog(title);
  resultDialogContent.append(createElement('p', message));
}

async function reverseSearch(item) {
  const imageUrl = item.imageUrl;
  openResultDialog(`Recherche d’image — ${item.reference || typeLabels[item.type]}`);
  if (imageUrl) {
    const section = createElement('section', null, 'result-section');
    section.append(createElement('h3', 'Moteurs de recherche visuelle'));
    const list = createElement('div', null, 'program-actions');
    const encoded = encodeURIComponent(imageUrl);
    list.append(
      createLink('Google Lens', `https://lens.google.com/uploadbyurl?url=${encoded}`),
      createLink('Recherche visuelle Bing', `https://www.bing.com/images/searchbyimage/upload?cbir=sbi&imgurl=${encoded}`),
      createLink('Yandex Images', `https://yandex.com/images/search?rpt=imageview&url=${encoded}`),
      createLink('TinEye', `https://tineye.com/search?url=${encoded}`)
    );
    section.append(list);
    resultDialogContent.append(section);
    if (state.serverConfig?.services?.serpapi) {
      try {
        const data = await api('/api/search/serpapi', { method: 'POST', body: JSON.stringify({ engine: 'google_lens', imageUrl }) });
        const results = normalizeSerpApi(data);
        appendFindingList(results);
      } catch (error) {
        const warning = createElement('p', error.message, 'warning');
        resultDialogContent.append(warning);
      }
    }
  } else {
    resultDialogContent.append(createElement('p', 'Une image importée localement n’a pas d’adresse publique. Utilisez l’analyse textuelle ou importez la même image depuis une adresse HTTPS officielle pour la recherche inversée.'));
  }
  const query = [item.reference, item.description, item.analysis?.brand, item.analysis?.keywords?.slice(0, 5).join(' ')].filter(Boolean).join(' ').slice(0, 240);
  if (query) {
    const section = createElement('section', null, 'result-section');
    section.append(createElement('h3', 'Recherche textuelle complémentaire'));
    const encoded = encodeURIComponent(query);
    const links = createElement('div', null, 'program-actions');
    links.append(
      createLink('Google', `https://www.google.com/search?q=${encoded}`),
      createLink('Bing', `https://www.bing.com/search?q=${encoded}`),
      createLink('Google Images', `https://www.google.com/search?tbm=isch&q=${encoded}`)
    );
    section.append(links);
    resultDialogContent.append(section);
  }
}

function normalizeSerpApi(data) {
  const results = [];
  for (const match of data.visual_matches || []) {
    results.push({ title: match.title || match.source || 'Correspondance visuelle', url: match.link || match.image || '', image: match.image || '', source: 'Google Lens' });
  }
  for (const result of data.organic_results || []) {
    results.push({ title: result.title, url: result.link, snippet: result.snippet, source: 'Google' });
  }
  for (const result of data.shopping_results || []) {
    results.push({ title: result.title, url: result.product_link || result.link, image: result.image, price: result.price, source: 'Google Shopping' });
  }
  return normalizeFindings(results, 'Google Lens').filter((entry) => entry.url);
}

async function analyzeAll() {
  if (state.analysisRunning) return;
  state.analysisRunning = true;
  state.stopAnalysis = false;
  const skipAnalyzed = byId('skipAnalyzed').checked;
  const queue = state.items.filter((item) => (!skipAnalyzed || !item.analysis) && (getItemImage(item) || item.description));
  const progress = byId('analysisProgress');
  const fill = byId('progressFill');
  const label = byId('progressText');
  const result = byId('analysisResults');
  if (!queue.length) {
    result.textContent = 'Aucune fiche à analyser : ajoutez une image ou une description, ou décochez « Ignorer les fiches déjà analysées ».';
    state.analysisRunning = false;
    return;
  }
  byId('btnAnalyzeAll').disabled = true;
  byId('btnStopAnalysis').hidden = false;
  byId('btnStopAnalysis').disabled = false;
  byId('btnStopAnalysis').textContent = 'Arrêter';
  progress.hidden = false;
  let completed = 0;
  for (const item of queue) {
    if (state.stopAnalysis) break;
    result.textContent = `Analyse de ${item.reference || typeLabels[item.type]}…`;
    try {
      await analyzeItem(item, false);
    } catch (error) {
      toast(error.message, 'error');
    }
    completed += 1;
    const percent = queue.length ? Math.round(completed / queue.length * 100) : 100;
    fill.dataset.percent = String(Math.round(percent / 5) * 5);
    progress.setAttribute('aria-valuenow', String(percent));
    label.textContent = `${completed} / ${queue.length}`;
  }
  const completedLabel = completed > 1 ? 'fiches' : 'fiche';
  result.textContent = state.stopAnalysis
    ? `Analyse arrêtée après ${completed} ${completedLabel}.`
    : `${completed} ${completedLabel} ${completed > 1 ? 'analysées' : 'analysée'}.`;
  state.analysisRunning = false;
  byId('btnAnalyzeAll').disabled = false;
  byId('btnStopAnalysis').hidden = true;
  renderItems();
}

function crossReference() {
  const analyzed = state.items.filter((item) => item.analysis);
  const pairs = [];
  for (let index = 0; index < analyzed.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < analyzed.length; otherIndex += 1) {
      const pair = compareItems(analyzed[index], analyzed[otherIndex]);
      if (pair.score >= 20) pairs.push(pair);
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  renderCrossReference(pairs.slice(0, 20), analyzed.length);
}

function compareItems(left, right) {
  const reasons = [];
  let score = 0;
  if (left.reference && normalizeText(left.reference) === normalizeText(right.reference)) {
    score += 60;
    reasons.push('même référence');
  }
  if (left.sourceUrl && left.sourceUrl === right.sourceUrl) {
    score += 35;
    reasons.push('même page source exacte');
  }
  const leftBarcodes = new Set(left.analysis.barcodes || []);
  const commonBarcodes = (right.analysis.barcodes || []).filter((value) => leftBarcodes.has(value));
  if (commonBarcodes.length) {
    score += 45;
    reasons.push(`code-barres ${commonBarcodes.join(', ')}`);
  }
  if (left.analysis.brand && normalizeText(left.analysis.brand) === normalizeText(right.analysis.brand)) {
    score += 25;
    reasons.push(`même marque détectée : ${left.analysis.brand}`);
  }
  const leftTerms = new Set((left.analysis.keywords || []).map(normalizeText).filter(Boolean));
  const rightTerms = new Set((right.analysis.keywords || []).map(normalizeText).filter(Boolean));
  const commonTerms = [...leftTerms].filter((term) => rightTerms.has(term) && term.length > 2);
  if (commonTerms.length) {
    score += Math.min(30, commonTerms.length * 5);
    reasons.push(`termes communs : ${commonTerms.slice(0, 8).join(', ')}`);
  }
  if (left.program === right.program) {
    score += 5;
    reasons.push('même programme');
  }
  return { left, right, score: Math.min(100, score), reasons };
}

function renderCrossReference(pairs, analyzedCount) {
  const container = byId('crossrefResults');
  container.replaceChildren();
  if (!pairs.length) {
    container.append(createElement('p', analyzedCount < 2 ? 'Au moins deux fiches doivent être analysées pour pouvoir être comparées.' : 'Aucune correspondance suffisamment forte. Ajoutez des descriptions ou lancez les analyses.'));
    return;
  }
  for (const pair of pairs) {
    const card = createElement('article', null, 'crossref-pair');
    const title = createElement('strong', `${pair.left.reference || `fiche ${pair.left.id.slice(0, 8)}`} ↔ ${pair.right.reference || `fiche ${pair.right.id.slice(0, 8)}`} · ${pair.score}/100`);
    const reasons = createElement('p', pair.reasons.join(' · '), 'field-help');
    card.append(title, reasons);
    container.append(card);
  }
}

function reportFieldValue(item, key) {
  const analysis = item.analysis || {};
  const empty = state.language === 'en' ? 'Not provided' : 'Non renseigné';
  const values = {
    reference: item.reference,
    image: item.imageUrl || (state.sessionImages.has(item.id) ? (state.language === 'en' ? 'Imported image, not stored after reloading' : 'Image importée, non conservée après rechargement') : ''),
    description: [item.description, analysis.keywords?.slice(0, 12).join(', ')].filter(Boolean).join(' — '),
    location: analysis.countryCandidates?.length ? `${analysis.countryCandidates.join(', ')} (${state.language === 'en' ? 'to confirm' : 'à confirmer'})` : '',
    when: '',
    organization: [analysis.brand, ...(analysis.logos || [])].filter(Boolean).join(', '),
    sources: unique([
      item.sourceUrl,
      ...(analysis.webPages || []).map((entry) => entry.url),
      ...(analysis.findings || []).map((entry) => entry.url).filter(Boolean)
    ]),
    followup: '',
    contact: '',
    limitations: item.notes
  };
  const value = values[key];
  if (Array.isArray(value)) return value.length ? value.join('\n') : empty;
  return value || empty;
}

function buildAgencyReport(item) {
  const program = programs[item.program];
  const template = reportTemplates[item.program]?.[state.language] || reportTemplates[item.program]?.fr;
  const lines = [template.title, template.intro, ''];
  for (const [key, label] of template.fields) {
    lines.push(`${label} : ${reportFieldValue(item, key)}`);
  }
  lines.push('', program.id === 'identify2protect'
    ? (state.language === 'en' ? 'I confirm that the information above is based on what I personally observed.' : 'Je confirme que les informations ci-dessus reposent sur ce que j’ai personnellement observé.')
    : (state.language === 'en' ? 'This report contains leads only and does not identify anyone by itself.' : 'Ce signalement contient des pistes et ne permet pas à lui seul d’identifier une personne.'));
  return { text: lines.join('\n'), template, program };
}

function openSignalementSummary(item) {
  const report = buildAgencyReport(item);
  openResultDialog(state.language === 'en' ? 'Agency report template' : 'Modèle de signalement par agence');
  const instructions = createElement('p', report.template.intro);
  const fieldSection = createElement('section', null, 'result-section');
  fieldSection.append(createElement('h3', t('Champs du modèle')));
  const fieldList = createElement('ul');
  for (const [, label, hint] of report.template.fields) {
    const entry = createElement('li');
    entry.append(createElement('strong', label));
    if (hint) entry.append(createElement('p', hint, 'field-help'));
    fieldList.append(entry);
  }
  fieldSection.append(fieldList);
  const textarea = createElement('textarea');
  textarea.value = report.text;
  textarea.rows = 20;
  textarea.readOnly = true;
  const actions = createElement('div', null, 'program-actions');
  const copy = createElement('button', t('Copier le dossier'), 'button primary');
  copy.addEventListener('click', () => copyText(report.text));
  actions.append(copy, createLink(t('Ouvrir le formulaire officiel'), report.program.reportUrl));
  resultDialogContent.append(instructions, fieldSection, textarea, actions);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Dossier copié.', 'success');
  } catch {
    toast('La copie automatique a échoué. Sélectionnez et copiez le texte manuellement.', 'error');
  }
}

function exportItems() {
  const payload = {
    application: 'Loupe',
    version: VERSION,
    exportedAt: new Date().toISOString(),
    notice: 'Contient des pistes de recherche. Les images importées localement ne sont pas exportées.',
    items: state.items
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = createElement('a');
  link.href = url;
  link.download = `loupe-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importItems(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const previous = state.items;
  try {
    const parsed = JSON.parse(await file.text());
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items) || !items.some((item) => item && typeof item.id === 'string' && programs[item.program])) {
      throw new Error('Ce fichier ne contient pas de fiches Loupe valides.');
    }
    if (state.items.length && !confirmMessage(`Remplacer les ${state.items.length} fiches enregistrées par ${items.length} fiches importées ?`)) {
      event.target.value = '';
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    state.items = loadItems();
    if (!state.items.length) throw new Error('Aucune fiche valide n’a pu être importée.');
    const dropped = items.length - state.items.length;
    state.sessionImages.clear();
    renderItems();
    const importedLabel = state.items.length > 1 ? 'fiches importées' : 'fiche importée';
    const droppedText = dropped > 0 ? `, ${dropped} entrée${dropped > 1 ? 's ignorées' : ' ignorée'} hors format Loupe` : '';
    toast(`${state.items.length} ${importedLabel}${droppedText}.`, 'success');
  } catch (error) {
    state.items = previous;
    saveItems();
    toast(error.message, 'error');
  } finally {
    event.target.value = '';
  }
}

async function handleReplaceImage(event) {
  const file = event.target.files?.[0];
  if (!file || !state.replacingItemId) return;
  try {
    const image = await compressImage(file, state.publicConfig?.maxImageMb || 10);
    const item = state.items.find((entry) => entry.id === state.replacingItemId);
    if (!item) return;
    state.sessionImages.set(item.id, image.dataUrl);
    item.imageUrl = '';
    item.updatedAt = new Date().toISOString();
    saveItems();
    renderItems();
    toast('Image importée et redimensionnée.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.replacingItemId = null;
    event.target.value = '';
  }
}

async function compressImage(file, maxMegabytes) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Format accepté : JPEG, PNG ou WebP.');
  }
  if (file.size > 25 * 1024 * 1024) throw new Error('Le fichier original dépasse 25 Mo.');
  const image = await loadImageElement(URL.createObjectURL(file), true);
  const maxDimension = 2400;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  let quality = 0.88;
  let blob = await canvasToBlob(canvas, quality);
  const maxBytes = Math.max(1, Math.min(25, maxMegabytes)) * 1024 * 1024;
  while (blob.size > maxBytes && quality > 0.48) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  while (blob.size > maxBytes && canvas.width > 700) {
    canvas = document.createElement('canvas');
    canvas.width = Math.round(canvas.width * 0.8);
    canvas.height = Math.round(canvas.height * 0.8);
    context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > maxBytes) throw new Error('L’image reste trop volumineuse après compression.');
  return {
    dataUrl: await blobToDataUrl(blob),
    bytes: blob.size,
    width: canvas.width,
    height: canvas.height
  };
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Compression impossible.')), 'image/jpeg', quality));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Lecture de l’image impossible.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(source, revoke = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https:\/\//i.test(source)) image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (revoke) URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      if (revoke) URL.revokeObjectURL(source);
      reject(new Error('L’image n’a pas pu être chargée depuis cette adresse (site source bloquant la lecture entre sites, adresse invalide ou image retirée). Importez le fichier localement pour la recadrer.'));
    };
    image.src = source;
  });
}

async function openCropper(item) {
  const source = getItemImage(item);
  if (!source) {
    toast('Importez d’abord une image pour cette fiche.', 'error');
    return;
  }
  try {
    let imageSource = source;
    if (/^https:\/\//i.test(source)) {
      toast('Chargement de l’image pour recadrage…');
      const response = await fetch(source, { mode: 'cors' });
      if (!response.ok) throw new Error('Adresse d’image inaccessible : le site d’origine bloque probablement la lecture entre sites. Importez le fichier localement pour le recadrer.');
      imageSource = await blobToDataUrl(await response.blob());
    }
    state.cropImage = await loadImageElement(imageSource);
    state.cropSource = item.id;
    state.cropSelection = null;
    const maxWidth = 900;
    const scale = Math.min(1, maxWidth / state.cropImage.naturalWidth);
    cropCanvas.width = Math.round(state.cropImage.naturalWidth * scale);
    cropCanvas.height = Math.round(state.cropImage.naturalHeight * scale);
    drawCropOverlay();
    cropDialog.showModal();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function cropPoint(event) {
  const rect = cropCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(cropCanvas.width, (event.clientX - rect.left) * cropCanvas.width / rect.width)),
    y: Math.max(0, Math.min(cropCanvas.height, (event.clientY - rect.top) * cropCanvas.height / rect.height))
  };
}

function startCropSelection(event) {
  event.preventDefault();
  cropCanvas.setPointerCapture(event.pointerId);
  const point = cropPoint(event);
  state.cropSelection = { start: point, end: point };
  drawCropOverlay();
}

function moveCropSelection(event) {
  if (!state.cropSelection) return;
  state.cropSelection.end = cropPoint(event);
  drawCropOverlay();
}

function endCropSelection(event) {
  if (!state.cropSelection) return;
  state.cropSelection.end = cropPoint(event);
  const { start, end } = state.cropSelection;
  if (Math.abs(end.x - start.x) < 8 || Math.abs(end.y - start.y) < 8) state.cropSelection = null;
  drawCropOverlay();
}

function drawCropOverlay() {
  const context = cropCanvas.getContext('2d');
  context.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  context.drawImage(state.cropImage, 0, 0, cropCanvas.width, cropCanvas.height);
  if (!state.cropSelection) return;
  const rectangle = selectionRectangle(state.cropSelection);
  context.fillStyle = 'rgba(0, 0, 0, 0.58)';
  context.beginPath();
  context.rect(0, 0, cropCanvas.width, cropCanvas.height);
  context.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  context.fill('evenodd');
  context.strokeStyle = '#58a6ff';
  context.lineWidth = 3;
  context.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
}

function selectionRectangle(selection) {
  const x = Math.min(selection.start.x, selection.end.x);
  const y = Math.min(selection.start.y, selection.end.y);
  return { x, y, width: Math.abs(selection.end.x - selection.start.x), height: Math.abs(selection.end.y - selection.start.y) };
}

async function applyCrop() {
  if (!state.cropSelection || !state.cropSource) {
    toast('Tracez une zone sur l’image.', 'error');
    return;
  }
  const rectangle = selectionRectangle(state.cropSelection);
  const scaleX = state.cropImage.naturalWidth / cropCanvas.width;
  const scaleY = state.cropImage.naturalHeight / cropCanvas.height;
  const sourceRectangle = {
    x: Math.round(rectangle.x * scaleX),
    y: Math.round(rectangle.y * scaleY),
    width: Math.round(rectangle.width * scaleX),
    height: Math.round(rectangle.height * scaleY)
  };
  const output = document.createElement('canvas');
  output.width = sourceRectangle.width;
  output.height = sourceRectangle.height;
  output.getContext('2d').drawImage(
    state.cropImage,
    sourceRectangle.x,
    sourceRectangle.y,
    sourceRectangle.width,
    sourceRectangle.height,
    0,
    0,
    sourceRectangle.width,
    sourceRectangle.height
  );
  const maxDimension = 2400;
  if (Math.max(output.width, output.height) > maxDimension) {
    const factor = maxDimension / Math.max(output.width, output.height);
    const scaled = document.createElement('canvas');
    scaled.width = Math.round(output.width * factor);
    scaled.height = Math.round(output.height * factor);
    scaled.getContext('2d').drawImage(output, 0, 0, scaled.width, scaled.height);
    output.width = scaled.width;
    output.height = scaled.height;
    output.getContext('2d').drawImage(scaled, 0, 0);
  }
  const blob = await canvasToBlob(output, 0.9);
  const item = state.items.find((entry) => entry.id === state.cropSource);
  if (!item) return;
  state.sessionImages.set(item.id, await blobToDataUrl(blob));
  item.updatedAt = new Date().toISOString();
  saveItems();
  renderItems();
  cropDialog.close();
  state.cropSelection = null;
  state.cropImage = null;
  state.cropSource = null;
  toast('Zone sélectionnée. L’image recadrée ne sera pas conservée après rechargement. Relancez l’analyse.', 'success');
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

initialize();
