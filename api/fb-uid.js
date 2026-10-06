import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { link } = req.query;

  if (!link) {
    return res.status(400).json({
      error: 'Link is required. Example: /api/fb-uid?link=https://www.facebook.com/Adi.0X',
    });
  }

  try {
    // লিংক নরমালাইজ করা
    let fbUrl = link.trim();
    if (!/^https?:\/\//i.test(fbUrl)) {
      fbUrl = 'https://' + fbUrl;
    }

    const urlObj = new URL(fbUrl);
    if (!/(^|\.)facebook\.com$/i.test(urlObj.hostname)) {
      return res.status(400).json({ error: 'Only Facebook links are allowed.' });
    }

    // Facebook HTML ফেচ করা
    const response = await axios.get(fbUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      maxRedirects: 5,
      timeout: 15000,
      validateStatus: () => true, // 404/500 হলেও HTML পার্স করার চেষ্টা করবে
    });

    const html = response.data;

    if (typeof html !== 'string') {
      return res.status(500).json({ error: 'Invalid response from Facebook.' });
    }

    let uid = null;

    // ১. al:ios:url মেটা ট্যাগ থেকে
    let match = html.match(
      /<meta[^>]+property=["']al:ios:url["'][^>]+content=["']fb:\/\/profile\/(\d+)["']/i
    );
    if (!match) {
      match = html.match(
        /<meta[^>]+content=["']fb:\/\/profile\/(\d+)["'][^>]+property=["']al:ios:url["']/i
      );
    }
    if (match) uid = match[1];

    // ২. apple-itunes-app মেটা ট্যাগ থেকে
    if (!uid) {
      match = html.match(
        /<meta[^>]+name=["']apple-itunes-app["'][^>]+content=["'][^"']*app-argument=fb:\/\/profile\/(\d+)/i
      );
      if (!match) {
        match = html.match(
          /<meta[^>]+content=["'][^"']*app-argument=fb:\/\/profile\/(\d+)[^"']*["'][^>]+name=["']apple-itunes-app["']/i
        );
      }
      if (match) uid = match[1];
    }

    // ৩. যেকোনো জায়গায় fb://profile/UID থাকলে
    if (!uid) {
      match = html.match(/fb:\/\/profile\/(\d+)/i);
      if (match) uid = match[1];
    }

    if (!uid) {
      return res.status(404).json({
        status: 'error',
        message: 'UID not found in page source. Profile may be private or Facebook blocked the request.',
      });
    }

    return res.status(200).json({
      status: 'success',
      uid: uid,
      link: fbUrl,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
      details: err.message,
    });
  }
}
