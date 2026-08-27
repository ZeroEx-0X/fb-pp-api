import axios from "axios";

export default async function handler(req, res) {
  const { url, prompt } = req.method === "POST" ? req.body : req.query;

  if (!url || !prompt) {
    return res.status(400).json({ 
      error: "Missing parameters. Both 'url' and 'prompt' are required." 
    });
  }

  try {
    const apiUrl = `https://api-faa.my.id/faa/editfoto?url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`;
    
    const response = await axios.get(apiUrl, {
      responseType: "arraybuffer",
      timeout: 25000 
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    return res.send(Buffer.from(response.data));

  } catch (error) {
    console.error("Edit Foto API Error:", error.message);

    if (error.response) {
      let errorData = error.response.data;
      
      if (Buffer.isBuffer(errorData)) {
        try {
          errorData = JSON.parse(errorData.toString("utf8"));
        } catch {
          errorData = errorData.toString("utf8");
        }
      }

      return res.status(error.response.status).json({
        error: "External API Error",
        status: error.response.status,
        details: errorData
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        error: "Gateway Timeout", 
        message: "The external editing API took too long to respond." 
      });
    }

    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message 
    });
  }
}
