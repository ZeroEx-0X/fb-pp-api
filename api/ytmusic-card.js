import axios from "axios";

export default async function handler(req, res) {
  const { url, prompt } = req.method === "POST" ? req.body : req.query;

  if (!url || !prompt) {
    return res.status(400).json({ 
      error: "Both 'url' and 'prompt' parameters are required." 
    });
  }

  try {
    const apiUrl = `https://api-faa.my.id/faa/editfoto?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;
    
    const response = await axios.get(apiUrl, {
      responseType: "arraybuffer"
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);

    return res.send(Buffer.from(response.data));

  } catch (error) {
    console.error("Edit Foto API Error:", error.message);
    return res.status(500).json({ 
      error: "Failed to process photo editing. Internal server error." 
    });
  }
}
