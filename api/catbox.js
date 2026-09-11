import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
    });
  }

  try {
    // Parse incoming multipart/form-data
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    const uploadedFile = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "No file provided. Use field name: file",
      });
    }

    // Read uploaded file
    const fileStream = fs.createReadStream(uploadedFile.filepath);

    // Create Catbox request
    const catboxForm = new FormData();

    catboxForm.append("reqtype", "fileupload");
    catboxForm.append("fileToUpload", fileStream, {
      filename: uploadedFile.originalFilename || "upload",
      contentType: uploadedFile.mimetype || "application/octet-stream",
    });

    // Upload to Catbox
    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      headers: catboxForm.getHeaders(),
      body: catboxForm,
    });

    const result = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: "Catbox upload failed",
        details: result,
      });
    }

    // Catbox normally returns the URL as plain text
    const url = result.trim();

    // Delete temporary file
    try {
      fs.unlinkSync(uploadedFile.filepath);
    } catch {}

    return res.status(200).json({
      success: true,
      url,
    });

  } catch (error) {
    console.error("Upload error:", error);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      details: error.message,
    });
  }
}
