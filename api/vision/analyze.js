import { ImageAnnotatorClient } from '@google-cloud/vision';

const vision = new ImageAnnotatorClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, imageBase64, features } = req.body;
    
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'imageUrl or imageBase64 required' });
    }

    const requestBody = {
      requests: [{
        image: imageBase64 
          ? { content: imageBase64 }
          : { source: { imageUri: imageUrl } },
        features: features || [
          { type: 'LOGO_DETECTION', maxResults: 10 },
          { type: 'TEXT_DETECTION', maxResults: 10 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          { type: 'WEB_DETECTION', maxResults: 10 },
          { type: 'IMAGE_PROPERTIES', maxResults: 5 },
          { type: 'SAFE_SEARCH_DETECTION', maxResults: 1 }
        ]
      }]
    };

    const [result] = await vision.annotateImages(requestBody);
    res.json(result);
  } catch (error) {
    console.error('Vision API error:', error);
    res.status(500).json({ error: error.message });
  }
}