export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, imageUrl, style, location, motifs } = req.body;

    if (!query && !imageUrl) {
      return res.status(400).json({ error: 'query or imageUrl required' });
    }

    const serpKey = process.env.SERPAPI_KEY;
    if (!serpKey) {
      return res.status(503).json({ error: 'SerpApi required for tattoo search' });
    }

    const tattooQuery = buildTattooQuery(query, style, location, motifs);

    // Google Images search for visual matches
    const imagesParams = new URLSearchParams({
      api_key: serpKey,
      engine: 'google_images',
      q: tattooQuery,
      ijn: '0'
    });

    // Web search for artist/shop/context info
    const webParams = new URLSearchParams({
      api_key: serpKey,
      engine: 'google',
      q: `${tattooQuery} site:tattoodo.com OR site:instagram.com OR site:pinterest.com OR site:inkedmag.com OR site:tattoo.com`,
      num: '10'
    });

    const [imagesResponse, webResponse] = await Promise.allSettled([
      fetch(`https://serpapi.com/search?${imagesParams}`),
      fetch(`https://serpapi.com/search?${webParams}`)
    ]);

    const imagesData = imagesResponse.status === 'fulfilled' ? await imagesResponse.value.json() : { images_results: [] };
    const webData = webResponse.status === 'fulfilled' ? await webResponse.value.json() : { organic_results: [] };

    res.json({
      images: imagesData.images_results || [],
      web: webData.organic_results || []
    });
  } catch (error) {
    console.error('Tattoo search error:', error);
    res.status(500).json({ error: error.message });
  }
}

function buildTattooQuery(baseQuery, style, location, motifs) {
  const parts = [];
  if (baseQuery) parts.push(baseQuery);
  if (style) parts.push(`style:${style}`);
  if (location) parts.push(`location:${location}`);
  if (motifs) parts.push(motifs);
  parts.push('tattoo');
  return parts.join(' ');
}