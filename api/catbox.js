import axios from "axios";
import FormData from "form-data";
import formidable from "formidable";
import fs from "fs";

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

  let tempFile = null;

  try {
    /*
     * Parse incoming multipart/form-data
     */
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    let uploadedFile = files.file;

    if (Array.isArray(uploadedFile)) {
      uploadedFile = uploadedFile[0];
    }

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "No file received. Field name must be 'file'.",
      });
    }

    tempFile = uploadedFile.filepath;

    /*
     * Create Catbox form
     */
    const catboxForm = new FormData();

    // IMPORTANT: Catbox requires this
    catboxForm.append("reqtype", "fileupload");

    catboxForm.append(
      "fileToUpload",
      fs.createReadStream(uploadedFile.filepath),
      {
        filename:
          uploadedFile.originalFilename ||
          "upload.bin",

        contentType:
          uploadedFile.mimetype ||
          "application/octet-stream",
      }
    );

    /*
     * Upload to Catbox using Axios
     */
    const response = await axios.post(
      "https://catbox.moe/user/api.php",
      catboxForm,
      {
        headers: {
          ...catboxForm.getHeaders(),
        },

        maxBodyLength: Infinity,
        maxContentLength: Infinity,

        timeout: 120000,
      }
    );

    const fileUrl = String(response.data).trim();

    /*
     * Catbox returns URL as plain text
     */
    if (
      !fileUrl ||
      !fileUrl.startsWith("http")
    ) {
      return res.status(502).json({
        success: false,
        error: "Catbox returned an invalid response.",
        details: fileUrl,
      });
    }

    /*
     * Delete temporary file
     */
    try {
      fs.unlinkSync(tempFile);
    } catch {}

    /*
     * Send URL back to your bot
     */
    return res.status(200).json({
      success: true,
      url: fileUrl,
    });

  } catch (error) {
    console.error("CATBOX ERROR:", error);

    /*
     * Cleanup
     */
    if (tempFile) {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch {}
    }

    /*
     * Catbox error
     */
    if (error.response) {
      return res.status(502).json({
        success: false,
        error: "Catbox upload failed",
        details:
          typeof error.response.data === "string"
            ? error.response.data
            : error.response.data,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      details: error.message,
    });
  }
}
