export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, num } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }

    // Try Google Custom Search first
    const cseKey = process.env.GOOGLE_CSE_KEY;
    const cseCx = process.env.GOOGLE_CSE_CX;

    if (cseKey && cseCx) {
      const params = new URLSearchParams({
        key: cseKey,
        cx: cseCx,
        q: query,
        num: num || 10
      });

      const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
      const data = await response.json();
      return res.json({ source: 'google_cse', results: data.items || [] });
    }

    // Fallback to SerpApi
    const serpKey = process.env.SERPAPI_KEY;
    if (serpKey) {
      const params = new URLSearchParams({
        api_key: serpKey,
        engine: 'google',
        q: query,
        num: num || 10
      });

      const response = await fetch(`https://serpapi.com/search?${params}`);
      const data = await response.json();
      return res.json({ source: 'serpapi', results: data.organic_results || [] });
    }

    res.status(503).json({ error: 'No web search API configured' });
  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({ error: error.message });
  }
}