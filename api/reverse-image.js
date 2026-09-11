import reverseImageSearch from "image-reverse-search";

export default async function handler(req, res) {
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

  let imageUrl;

  if (req.method === "GET") {
    imageUrl = req.query?.imageUrl;
  } else if (req.method === "POST") {
    imageUrl = req.body?.imageUrl;
  } else {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET or POST."
    });
  }

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      error: "imageUrl is required"
    });
  }

  try {
    new URL(imageUrl);
  } catch {
    return res.status(400).json({
      success: false,
      error: "Invalid imageUrl"
    });
  }

  try {
    const results = await reverseImageSearch(imageUrl);

    return res.status(200).json({
      success: true,
      count: Array.isArray(results) ? results.length : 0,
      results
    });

  } catch (error) {
    console.error("Reverse image search error:", error);

    return res.status(500).json({
      success: false,
      error: "Reverse image search failed",
      message: error?.message || String(error)
    });
  }
}
