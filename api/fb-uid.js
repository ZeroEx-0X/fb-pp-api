import axios from 'axios';
import qs from 'qs';

export default async function handler(req, res) {
  // শুধুমাত্র GET রিকোয়েস্ট গ্রহণ করবে
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { link } = req.query;

  if (!link) {
    return res.status(400).json({
      error: "Link is required. Example: /api/fb-uid?link=https://facebook.com/zuck",
    });
  }

  try {
    // Traodoisub API-তে POST রিকোয়েস্ট পাঠানো হচ্ছে
    const data = qs.stringify({ 'link': link });
    
    const response = await axios({
      method: 'post',
      url: 'https://id.traodoisub.com/api.php',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://id.traodoisub.com/'
      },
      data: data
    });

    // সফল হলে রেজাল্ট পাঠানো
    if (response.data && response.data.id) {
      return res.status(200).json({
        status: "success",
        id: response.data.id,
        link: link
      });
    } else {
      return res.status(400).json({
        status: "error",
        message: response.data.error || "Could not extract UID from this link."
      });
    }

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      details: err.message
    });
  }
}
