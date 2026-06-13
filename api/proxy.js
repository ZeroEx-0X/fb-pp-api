import axios from 'axios';

export default async function handler(req, res) {
  // CORS হেডার সেট করা যাতে বট বা অন্য যেকোনো জায়গা থেকে এটি অ্যাক্সেস করা যায়
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS রিকোয়েস্ট হ্যান্ডেল করা (CORS Pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ইউআরএল প্যারামিটার চেক করা
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ 
      error: "Missing 'url' parameter. Example: /api/proxy?url=https://example.com" 
    });
  }

  try {
    // রিয়েল ব্রাউজারের মতো ছদ্মবেশ ধরার জন্য হেডার (Cloudflare বাইপাস করতে সাহায্য করবে)
    const response = await axios({
      method: 'GET',
      url: decodeURIComponent(targetUrl),
      responseType: 'arraybuffer', // সব ধরণের ডাটা (JSON, Stream, Text, Audio) সাপোর্ট করার জন্য
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000 // ১৫ সেকেন্ড টাইমআউট
    });

    // টার্গেট সাইট থেকে যে ডাটা টাইপ (Content-Type) আসবে, প্রক্সিতেও সেই টাইপ পাঠানো
    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // ডাটা বাফার আকারে রিটার্ন করা
    const buffer = Buffer.from(response.data);
    return res.status(response.status).send(buffer);

  } catch (error) {
    const statusCode = error.response ? error.response.status : 500;
    
    // যদি এরর ডাটা বাফার আকারে থাকে, তবে সেটিকে টেক্সটে রূপান্তর করা
    let errorDetails = error.message;
    if (error.response && error.response.data) {
      try {
        errorDetails = JSON.parse(Buffer.from(error.response.data).toString());
      } catch {
        errorDetails = Buffer.from(error.response.data).toString();
      }
    }

    return res.status(statusCode).json({
      success: false,
      message: "Proxy request failed",
      details: errorDetails
    });
  }
}
