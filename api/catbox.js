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
  let tempFile = null;

  // =========================
  // METHOD CHECK
  // =========================

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
      message: "Only POST requests are allowed.",
    });
  }

  try {
    // =========================
    // PARSE MULTIPART FORM
    // =========================

    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 4 * 1024 * 1024,
    });

    const [fields, files] = await form.parse(req);

    let uploadedFile = files.file;

    // formidable sometimes returns an array
    if (Array.isArray(uploadedFile)) {
      uploadedFile = uploadedFile[0];
    }

    // =========================
    // CHECK FILE
    // =========================

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "No file received.",
        message: "The multipart field name must be 'file'.",
      });
    }

    tempFile = uploadedFile.filepath;

    // =========================
    // FILE INFORMATION
    // =========================

    const filename =
      uploadedFile.originalFilename ||
      "upload.bin";

    const contentType =
      uploadedFile.mimetype ||
      "application/octet-stream";

    // =========================
    // CATBOX FORM
    // =========================

    const catboxForm = new FormData();

    catboxForm.append(
      "reqtype",
      "fileupload"
    );

    catboxForm.append(
      "fileToUpload",
      fs.createReadStream(
        uploadedFile.filepath
      ),
      {
        filename: filename,
        contentType: contentType,
      }
    );

    // =========================
    // UPLOAD TO CATBOX
    // =========================

    const catboxResponse = await axios.post(
      "https://catbox.moe/user/api.php",
      catboxForm,
      {
        headers: {
          ...catboxForm.getHeaders(),

          // Browser-like User Agent
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",

          "Accept": "*/*",
          "Connection": "keep-alive",
        },

        maxBodyLength: Infinity,
        maxContentLength: Infinity,

        timeout: 120000,

        validateStatus: () => true,
      }
    );

    // =========================
    // CATBOX RESPONSE
    // =========================

    const rawResponse =
      typeof catboxResponse.data === "string"
        ? catboxResponse.data.trim()
        : JSON.stringify(
            catboxResponse.data
          );

    // =========================
    // CATBOX ERROR
    // =========================

    if (
      catboxResponse.status < 200 ||
      catboxResponse.status >= 300
    ) {
      return res.status(502).json({
        success: false,
        error: "Catbox upload failed.",
        catboxStatus: catboxResponse.status,
        catboxResponse: rawResponse,
      });
    }

    // Catbox normally returns direct URL as plain text
    const fileUrl = String(
      catboxResponse.data
    ).trim();

    // =========================
    // INVALID CATBOX RESPONSE
    // =========================

    if (
      !fileUrl ||
      !fileUrl.startsWith("http")
    ) {
      return res.status(502).json({
        success: false,
        error: "Catbox returned an invalid response.",
        catboxStatus: catboxResponse.status,
        catboxResponse: fileUrl || "Empty response",
      });
    }

    // =========================
    // DELETE TEMP FILE
    // =========================

    try {
      if (
        tempFile &&
        fs.existsSync(tempFile)
      ) {
        fs.unlinkSync(tempFile);
      }
    } catch (cleanupError) {
      console.error(
        "TEMP FILE CLEANUP ERROR:",
        cleanupError
      );
    }

    // =========================
    // SUCCESS
    // =========================

    return res.status(200).json({
      success: true,
      url: fileUrl,
      filename: filename,
      contentType: contentType,
    });

  } catch (error) {
    console.error(
      "CATBOX VERCEL ERROR:",
      error
    );

    // =========================
    // CLEANUP AFTER ERROR
    // =========================

    if (tempFile) {
      try {
        if (
          fs.existsSync(tempFile)
        ) {
          fs.unlinkSync(tempFile);
        }
      } catch (cleanupError) {
        console.error(
          "CLEANUP ERROR:",
          cleanupError
        );
      }
    }

    // =========================
    // FORMIDABLE ERROR
    // =========================

    if (
      error.code ===
      "ETOOBIG"
    ) {
      return res.status(413).json({
        success: false,
        error: "File is too large.",
        message:
          "Maximum supported file size is approximately 4 MB.",
      });
    }

    // =========================
    // AXIOS / CATBOX ERROR
    // =========================

    if (error.response) {
      let responseData =
        error.response.data;

      if (
        typeof responseData ===
        "object"
      ) {
        try {
          responseData =
            JSON.stringify(
              responseData
            );
        } catch {
          responseData =
            String(responseData);
        }
      }

      return res.status(502).json({
        success: false,
        error: "Catbox request failed.",
        httpStatus:
          error.response.status,
        statusText:
          error.response.statusText ||
          "",
        details:
          responseData ||
          "No response data",
      });
    }

    // =========================
    // GENERAL ERROR
    // =========================

    return res.status(500).json({
      success: false,
      error: "Upload failed.",
      message:
        error.message ||
        "Unknown error",
      code:
        error.code ||
        null,
    });
  }
}
