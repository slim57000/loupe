export default function handler(req, res) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    configured: {
      vision: !!process.env.GOOGLE_VISION_KEY,
      ebay: !!process.env.EBAY_APP_ID,
      serpapi: !!process.env.SERPAPI_KEY,
      bestbuy: !!process.env.BESTBUY_KEY,
      upcitemdb: !!process.env.UPCITEMS_KEY,
      google_cse: !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX),
      wikidata: true
    }
  });
}