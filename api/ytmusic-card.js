import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import axios from "axios";

async function loadFonts() {
  try {
    const bnFontRes = await axios.get(
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansbengali/NotoSansBengali-Bold.ttf",
      { responseType: "arraybuffer" }
    );
    GlobalFonts.register(Buffer.from(bnFontRes.data), "CustomFont");

    const enFontRes = await axios.get(
      "https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto-Bold.ttf",
      { responseType: "arraybuffer" }
    );
    GlobalFonts.register(Buffer.from(enFontRes.data), "RobotoFont");
  } catch (e) {
    console.error("Font loading error:", e.message);
  }
}

let fontsLoaded = false;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { results } = req.body;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: "Please provide a valid 'results' array." });
  }

  try {
    if (!fontsLoaded) {
      await loadFonts();
      fontsLoaded = true;
    }

    const canvas = createCanvas(1000, 850);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, 1000, 850);

    ctx.fillStyle = "#FF0000";
    ctx.font = 'bold 50px CustomFont, RobotoFont';
    ctx.fillText("YouTube Music", 50, 80);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 120);
    ctx.lineTo(950, 120);
    ctx.stroke();

    const thumbPromises = results.map(song =>
      song.thumbnail ? loadImage(song.thumbnail).catch(() => null) : null
    );
    const thumbnails = await Promise.all(thumbPromises);

    let y = 180;

    for (let i = 0; i < results.length; i++) {
      const song = results[i];

      ctx.fillStyle = "#FF0000";
      ctx.font = 'bold 35px CustomFont, RobotoFont';
      ctx.fillText(`${i + 1}`, 50, y + 60);

      if (thumbnails[i]) {
        ctx.save();
        ctx.beginPath();
        const rx = 120, ry = y, rw = 100, rh = 100, radius = 10;
        ctx.moveTo(rx + radius, ry);
        ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, radius);
        ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, radius);
        ctx.arcTo(rx, ry + rh, rx, ry, radius);
        ctx.arcTo(rx, ry, rx + rw, ry, radius);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(thumbnails[i], 120, y, 100, 100);
        ctx.restore();
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.font = 'bold 30px CustomFont, RobotoFont';
      let title = song.title || "Unknown Title";
      if (ctx.measureText(title).width > 650) {
        title = title.slice(0, 35) + "...";
      }
      ctx.fillText(title, 250, y + 40);

      ctx.fillStyle = "#aaaaaa";
      ctx.font = '24px CustomFont, RobotoFont';
      const duration = song.durationText || song.duration || "N/A";
      const artist = song.artist || "Unknown Artist";
      ctx.fillText(`${artist} • ${duration}`, 250, y + 85);

      y += 130;
    }

    const imageBuffer = await canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    return res.send(imageBuffer);

  } catch (err) {
    console.error("Canvas Render Error:", err);
    return res.status(500).json({ error: "Failed to generate canvas image." });
  }
}
