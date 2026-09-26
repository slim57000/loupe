export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, country, categories } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }

    const sources = [
      { name: 'openfoodfacts', url: 'https://world.openfoodfacts.org/cgi/search.pl' },
      { name: 'openproductsfacts', url: 'https://world.openproductsfacts.org/cgi/search.pl' },
      { name: 'openbeautyfacts', url: 'https://world.openbeautyfacts.org/cgi/search.pl' }
    ];

    const results = await Promise.allSettled(sources.map(async (source) => {
      const params = new URLSearchParams({
        search_terms: query,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: '20'
      });
      if (country) params.append('countries', country);
      
      const response = await fetch(`${source.url}?${params}`);
      const data = await response.json();
      return { source: source.name, products: data.products || [] };
    }));

    const aggregated = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.products.map(p => ({
        ...p,
        source: r.value.source,
        matchScore: calculateMatchScore(p, query)
      })))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50);

    res.json({ results: aggregated });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: error.message });
  }
}

function calculateMatchScore(product, query) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  let score = 0;
  
  const searchableText = [
    product.product_name || '',
    product.brand || '',
    product.manufacturer || '',
    product.categories || '',
    product.ingredients_text || ''
  ].join(' ').toLowerCase();
  
  for (const term of queryTerms) {
    if (searchableText.includes(term)) score += 10;
  }
  
  if (product.brand && queryTerms.some(t => product.brand.toLowerCase().includes(t))) {
    score += 20;
  }
  
  return score;
}