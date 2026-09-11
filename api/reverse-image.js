const { reverseImageSearch } = require("image-reverse-search");

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET
  if (req.method === "GET") {
    return searchImage(req.query?.imageUrl, res);
  }

  // POST
  if (req.method === "POST") {
    const { imageUrl } = req.body || {};
    return searchImage(imageUrl, res);
  }

  return res.status(405).json({
    success: false,
    error: "Method not allowed. Use GET or POST."
  });
};


async function searchImage(imageUrl, res) {
  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      error: "imageUrl is required"
    });
  }

  // Validate URL
  try {
    new URL(imageUrl);
  } catch {
    return res.status(400).json({
      success: false,
      error: "Invalid image URL"
    });
  }

  try {
    const results = await reverseImageSearch(imageUrl, {
      waitTime: 8000,
      headless: "new",
      humanBehavior: true,
      viewport: {
        width: 1920,
        height: 1080
      }
    });

    return res.status(200).json({
      success: true,
      count: results?.length || 0,
      results: (results || []).map((item) => ({
        title: item.title || null,
        source: item.source || null,
        link: item.link || null,
        image: item.image || null
      }))
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Reverse image search failed",
      message: error?.message || "Unknown error"
    });
  }
}
