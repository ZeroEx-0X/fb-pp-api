import axios from 'axios';

// Node.js Helper function to parse multipart form-data in ESM / Serverless
async function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      
      if (!boundaryMatch) {
        return resolve({ fields: {}, files: {} });
      }
      
      const boundary = boundaryMatch[1] || boundaryMatch[2];
      const parts = buffer.toString('binary').split(`--${boundary}`);
      const fields = {};
      const files = {};

      for (const part of parts) {
        if (!part || part.trim() === '--') continue;

        const [headerSection, bodySection] = part.split('\r\n\r\n');
        if (!bodySection) continue;

        const body = bodySection.slice(0, -2); // Remove trailing \r\n
        const contentDisposition = headerSection.match(/Content-Disposition:[^\r\n]*/i);
        if (!contentDisposition) continue;

        const nameMatch = contentDisposition[0].match(/name="([^"]+)"/i);
        const filenameMatch = contentDisposition[0].match(/filename="([^"]+)"/i);

        if (nameMatch) {
          const fieldName = nameMatch[1];
          if (filenameMatch) {
            const filename = filenameMatch[1];
            const contentTypeMatch = headerSection.match(/Content-Type:[^\r\n]*/i);
            const fileType = contentTypeMatch ? contentTypeMatch[0].split(':')[1].trim() : 'application/octet-stream';
            
            files[fieldName] = {
              filename,
              contentType: fileType,
              buffer: Buffer.from(body, 'binary')
            };
          } else {
            fields[fieldName] = Buffer.from(body, 'binary').toString('utf-8');
          }
        }
      }

      resolve({ fields, files });
    });
    req.on('error', err => reject(err));
  });
}

export const config = {
  api: {
    bodyParser: false, // File upload-এর জন্য Native Parser বন্ধ রাখা হয়েছে
  },
};

export default async function handler(req, res) {
  // CORS Support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET Request: Direct URL Upload
  if (req.method === 'GET') {
    const { url, userhash } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Please provide a valid "url" query parameter.' });
    }

    try {
      const formData = new FormData();
      formData.append('reqtype', 'urlupload');
      formData.append('url', url);
      if (userhash) formData.append('userhash', userhash);

      const response = await axios.post('https://catbox.moe/user/api.php', formData, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      return res.status(200).json({ status: true, url: response.data.trim() });
    } catch (error) {
      return res.status(500).json({ error: 'URL upload failed', details: error.message });
    }
  }

  // 2. POST Request: Direct Buffer / File Upload
  if (req.method === 'POST') {
    try {
      const { fields, files } = await parseMultipartForm(req);
      const file = files.file;
      const userhash = fields.userhash;

      if (!file) {
        return res.status(400).json({ error: 'No file found in payload. Use form-data key "file".' });
      }

      // Native Blob Object creation for Node ESM
      const fileBlob = new Blob([file.buffer], { type: file.contentType });
      const formData = new FormData();
      
      formData.append('reqtype', 'fileupload');
      if (userhash) formData.append('userhash', userhash);
      formData.append('fileToUpload', fileBlob, file.filename);

      const response = await axios.post('https://catbox.moe/user/api.php', formData, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      return res.status(200).json({ status: true, url: response.data.trim() });
    } catch (error) {
      return res.status(500).json({ error: 'File upload failed', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
