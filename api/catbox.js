import axios from 'axios';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle URL or File via POST / GET
  try {
    let fileUrl = req.query.url;
    let userhash = req.query.userhash;

    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();
      try {
        const parsed = JSON.parse(body);
        if (parsed.url) fileUrl = parsed.url;
        if (parsed.userhash) userhash = parsed.userhash;
      } catch (e) {
        // If not JSON, fall back to query
      }
    }

    if (!fileUrl) {
      return res.status(400).json({ error: 'Please provide a valid "url" parameter.' });
    }

    // Download attachment buffer from Facebook CDN
    const fileResponse = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const buffer = Buffer.from(fileResponse.data);
    const contentType = fileResponse.headers['content-type'] || 'image/jpeg';
    
    // Extracted extension or default to jpg
    let ext = contentType.split('/')[1] || 'jpg';
    if (ext.includes(';')) ext = ext.split(';')[0];

    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    if (userhash) formData.append('userhash', userhash);

    const blob = new Blob([buffer], { type: contentType });
    formData.append('fileToUpload', blob, `file_${Date.now()}.${ext}`);

    // Upload to Catbox
    const response = await axios.post('https://catbox.moe/user/api.php', formData, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const resultUrl = response.data.trim();

    if (resultUrl.startsWith('http')) {
      return res.status(200).json({ status: true, url: resultUrl });
    } else {
      return res.status(500).json({ error: 'Catbox error', details: resultUrl });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Upload failed', details: error.message });
  }
}
