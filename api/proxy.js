const axios = require("axios");

module.exports = async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    // 403 Forbidden এড়াতে MyInstants-এর মতো Header সেট করা হয়েছে
    const response = await axios({
      method: "GET",
      url: decodeURIComponent(targetUrl),
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.myinstants.com/",
        "Accept": "*/*"
      }
    });

    // Audio Response Header পাস করে দেওয়া হচ্ছে
    res.setHeader("Content-Type", response.headers["content-type"] || "audio/mpeg");
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }

    // Audio Data Stream করা হচ্ছে
    response.data.pipe(res);
  } catch (error) {
    console.error("Proxy Error:", error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to fetch media file" });
  }
};
