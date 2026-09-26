export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, engine, imageUrl, gl, hl } = req.body;
    
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'SerpApi not configured' });
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      engine: engine || 'google_lens',
      q: query || '',
      gl: gl || 'us',
      hl: hl || 'en'
    });

    if (imageUrl) params.append('url', imageUrl);

    const response = await fetch(`https://serpapi.com/search?${params}`);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('SerpApi error:', error);
    res.status(500).json({ error: error.message });
  }
}