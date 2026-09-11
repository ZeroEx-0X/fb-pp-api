import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let imageUrl = null;

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      imageUrl = body?.imageUrl || body?.url || body?.image;
    } else {
      imageUrl = req.query?.imageUrl || req.query?.url || req.query?.image;
    }

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'imageUrl required'
      });
    }

    // Lens endpoint
    const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}&hl=en&gl=us`;

    const response = await fetch(lensUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://images.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-site',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Debug: কতটা HTML পাচ্ছি
    console.log('HTML length:', html.length);

    let bestGuess = $('div[data-attrid="title"]').first().text().trim()
      || $('.SPZz6b span').first().text().trim()
      || $('[jsname]').filter((i, el) => $(el).text().length > 5 && $(el).text().length < 80).first().text().trim()
      || null;

    const similarImages = [];
    const seen = new Set();

    // বিভিন্ন selector চেষ্টা
    $('img').each((i, el) => {
      if (similarImages.length >= 15) return false;

      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src || src.startsWith('data:') || src.includes('gstatic.com/images?q=tbn:ANd9Gc') === false && src.includes('encrypted-tbn')) {
        // keep encrypted-tbn thumbnails
      }

      if (src && (src.includes('encrypted-tbn') || src.includes('gstatic') || src.match(/\.(jpg|jpeg|png|webp)/i))) {
        if (!seen.has(src)) {
          seen.add(src);
          similarImages.push({
            title: $(el).attr('alt') || 'Similar image',
            image: src,
            thumbnail: src,
            source: null
          });
        }
      }
    });

    // Script ট্যাগ থেকে JSON ডেটা খোঁজা
    $('script').each((i, el) => {
      const text = $(el).html() || '';
      if (text.includes('Visual matches') || text.includes('AF_initDataCallback')) {
        const matches = text.match(/https:\/\/[^"'\s]+?\.(?:jpg|jpeg|png|webp)/gi) || [];
        matches.forEach(url => {
          if (!seen.has(url) && similarImages.length < 20) {
            seen.add(url);
            similarImages.push({
              title: 'Similar image',
              image: url,
              thumbnail: url,
              source: null
            });
          }
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: similarImages.length > 0 ? 'Results found' : 'Google blocked or no results (common with pure HTTP)',
      data: {
        bestGuess,
        originalImage: imageUrl,
        similarSearchUrl: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`,
        similarImages: similarImages.slice(0, 15),
        totalFound: similarImages.length,
        note: 'Pure HTTP scraping of Google Lens is unreliable in 2026. Consider SerpApi / Apify / paid services for production.'
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      data: null
    });
  }
}
