export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { upc } = req.body;

    if (!upc || !/^\d{12,13}$/.test(upc)) {
      return res.status(400).json({ error: 'Valid UPC/EAN required (12-13 digits)' });
    }

    // UPCitemdb
    const proKey = process.env.UPCITEMS_KEY;
    const url = proKey
      ? `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}&apikey=${proKey}`
      : `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`;

    const [upcResponse, offResponse] = await Promise.allSettled([
      fetch(url),
      fetch(`https://world.openfoodfacts.org/api/v0/product/${upc}.json`)
    ]);

    const upcData = upcResponse.status === 'fulfilled' ? await upcResponse.value.json() : { items: [] };
    const offData = offResponse.status === 'fulfilled' ? await offResponse.value.json() : { product: null };

    res.json({
      upcitemdb: upcData.items || [],
      openfoodfacts: offData.product || null
    });
  } catch (error) {
    console.error('UPC lookup error:', error);
    res.status(500).json({ error: error.message });
  }
}