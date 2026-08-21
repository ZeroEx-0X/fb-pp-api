import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export default async function handler(req, res) {
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { url, type } = req.body;

  if (!url || !type) {
    return res.status(400).json({ error: "Please provide 'url' and 'type' (audio or video) in request body." });
  }

  if (type !== "audio" && type !== "video") {
    return res.status(400).json({ error: "Invalid file type. Type must be 'audio' or 'video'." });
  }

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input_${Date.now()}.${type === "audio" ? "mp3" : "mp4"}`);
  const outputPath = path.join(tempDir, `output_${Date.now()}.${type === "audio" ? "mp4" : "mp3"}`);

  try {
    const response = await axios.get(url, { responseType: "stream" });
    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    await new Promise((resolve, reject) => {
      if (type === "audio") {
        ffmpeg()
          .input("color=c=black:s=640x180:r=25")
          .inputOptions(["-f lavfi"])
          .input(inputPath)
          .outputOptions([
            "-map 0:v:0",
            "-map 1:a:0",
            "-c:v libx264",
            "-c:a aac",
            "-shortest"
          ])
          .save(outputPath)
          .on("end", resolve)
          .on("error", reject);
      } else {
        ffmpeg(inputPath)
          .noVideo()
          .audioCodec("libmp3lame")
          .save(outputPath)
          .on("end", resolve)
          .on("error", reject);
      }
    });

    const mimeType = type === "audio" ? "video/mp4" : "audio/mpeg";
    const fileStream = fs.createReadStream(outputPath);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename=converted.${type === "audio" ? "mp4" : "mp3"}`);

    fileStream.pipe(res);

    fileStream.on("end", () => {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    });

  } catch (err) {
    console.error("Conversion Error:", err);

    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    return res.status(500).json({ error: "Conversion failed. Internal server error." });
  }
}
