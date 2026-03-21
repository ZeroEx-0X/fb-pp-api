import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Query is required. Example: /api/myinstants?query=funny" });
  }

  try {
    // MyInstants-এর মেইন সার্চ ইউআরএল
    const searchUrl = `https://www.myinstants.com/search/?name=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        "Referer": "https://www.myinstants.com/"
      }
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // সাইটের ইন্টারনাল লজিক অনুযায়ী ডাটা বের করা
    $(".instant").each((i, el) => {
      const title = $(el).find(".instant-link").text().trim();
      const slug = $(el).find(".instant-link").attr("href");
      const onclickAttr = $(el).find(".small-button").attr("onclick");
      
      // অডিওর মেইন পাথ এক্সট্রাক্ট করা (v1 স্টাইল)
      const mp3Match = onclickAttr ? onclickAttr.match(/'([^']+)'/) : null;
      const mp3Url = mp3Match ? `https://www.myinstants.com${mp3Match[1]}` : null;

      if (title && mp3Url) {
        results.push({
          title,
          url: `https://www.myinstants.com${slug}`,
          audio: mp3Url
        });
      }
    });

    // CORS এবং ক্যাশ কন্ট্রোল
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    return res.status(200).json({
      status: true,
      creator: "Adi.0X",
      total: results.length,
      results: results
    });

  } catch (error) {
    return res.status(500).json({ 
      error: "Vercel Proxy Error", 
      message: error.message 
    });
  }
}
