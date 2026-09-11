import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let imageUrl = null;

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      imageUrl = body?.imageUrl || body?.url || body?.image;
    } else if (req.method === 'GET') {
      imageUrl = req.query?.imageUrl || req.query?.url || req.query?.image;
    }

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'imageUrl required. POST { "imageUrl": "https://..." } or GET ?imageUrl=...'
      });
    }

    const searchUrl = `https://www.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}&sbisrc=cr_1_5_2&hl=en`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Best guess
    let bestGuess = '';
    const guessSelectors = [
      'a[href*="/search?"] .fKDtNb',
      '.fKDtNb',
      '#result-stats',
      'div[data-attrid="title"]',
      '.SPZz6b span',
    ];
    for (const sel of guessSelectors) {
      const text = $(sel).first().text().trim();
      if (text && text.length > 2) {
        bestGuess = text;
        break;
      }
    }

    // Similar images
    const similarImages = [];
    const seen = new Set();

    $('div[data-id], .isv-r, .rg_bx, a[href*="/imgres"]').each((i, el) => {
      if (similarImages.length >= 20) return false;

      const $el = $(el);
      let imgSrc = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      let link = $el.find('a').attr('href') || $el.attr('href') || '';
      let title = $el.find('img').attr('alt') || $el.find('.VFACy').text() || $el.find('span').first().text() || '';

      if (link && link.includes('/url?q=')) {
        const match = link.match(/\/url\?q=([^&]+)/);
        if (match) link = decodeURIComponent(match[1]);
      }
      if (link && link.startsWith('/')) {
        link = 'https://www.google.com' + link;
      }

      if (imgSrc && imgSrc.startsWith('data:')) imgSrc = '';

      const key = (imgSrc || link).slice(0, 80);
      if ((imgSrc || link) && !seen.has(key)) {
        seen.add(key);
        similarImages.push({
          title: title.trim() || 'Similar image',
          image: imgSrc || null,
          source: link || null,
          thumbnail: imgSrc || null,
        });
      }
    });

    // Fallback from script tags
    if (similarImages.length < 5) {
      const scripts = $('script').map((i, el) => $(el).html()).get().join('\n');
      const imgMatches = scripts.match(/https:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp|gif)/gi) || [];
      imgMatches.slice(0, 15).forEach((url) => {
        if (!seen.has(url) && !url.includes('gstatic.com/favicon') && !url.includes('logo')) {
          seen.add(url);
          similarImages.push({
            title: 'Similar image',
            image: url,
            source: null,
            thumbnail: url,
          });
        }
      });
    }

    const similarSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(bestGuess || 'similar images')}`;

    return res.status(200).json({
      success: true,
      message: 'Reverse image search completed',
      data: {
        bestGuess: bestGuess || null,
        originalImage: imageUrl,
        similarSearchUrl,
        similarImages: similarImages.slice(0, 15),
        totalFound: similarImages.length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to perform reverse image search',
      data: null,
    });
  }
}
