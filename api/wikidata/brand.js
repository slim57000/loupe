export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { brandName } = req.body;

    if (!brandName) {
      return res.status(400).json({ error: 'brandName required' });
    }

    // Search Wikidata for brand
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: brandName,
      language: 'en',
      format: 'json',
      type: 'item',
      limit: '5'
    });

    const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams}`);
    const searchData = await searchResponse.json();

    if (!searchData.search?.length) {
      return res.json({ brand: null, country: null, description: null });
    }

    // Get details for top match
    const entityId = searchData.search[0].id;
    const detailParams = new URLSearchParams({
      action: 'wbgetentities',
      ids: entityId,
      format: 'json',
      props: 'labels|descriptions|claims',
      languages: 'en|fr|de|es|it'
    });

    const detailResponse = await fetch(`https://www.wikidata.org/w/api.php?${detailParams}`);
    const detailData = await detailResponse.json();

    const entity = detailData.entities?.[entityId];
    if (!entity) return res.json({ brand: null, country: null, description: null });

    // Extract country of origin (P495)
    const countryClaim = entity.claims?.P495?.[0];
    const country = countryClaim?.mainsnak?.datavalue?.value?.id;

    res.json({
      brand: entity.labels?.en?.value || brandName,
      wikidataId: entityId,
      country: country ? getCountryName(country) : null,
      countryCode: country,
      description: entity.descriptions?.en?.value || null
    });
  } catch (error) {
    console.error('Wikidata error:', error);
    res.status(500).json({ error: error.message });
  }
}

function getCountryName(wikidataId) {
  const countries = {
    'Q30': 'United States', 'Q142': 'France', 'Q183': 'Germany', 'Q145': 'United Kingdom',
    'Q38': 'Italy', 'Q29': 'Spain', 'Q17': 'Japan', 'Q159': 'China', 'Q668': 'India',
    'Q155': 'Brazil', 'Q408': 'Australia', 'Q16': 'Canada', 'Q189': 'Russia'
  };
  return countries[wikidataId] || wikidataId;
}