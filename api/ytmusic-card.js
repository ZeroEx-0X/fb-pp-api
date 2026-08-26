import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

// ফন্ট প্রপারলি লোড করার ফাংশন
async function ensureFontsLoaded() {
  try {
    const fontPath = path.join(os.tmpdir(), "NotoSansBengali-Bold.ttf");
    
    // যদি অলেইডি টেম্প ফোল্ডারে ফন্ট থাকে, আবার ডাউনলোড করার দরকার নেই
    if (!fs.existsSync(fontPath)) {
      const fontRes = await axios.get(
        "https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali-Bold.ttf",
        { responseType: "arraybuffer" }
      );
      fs.writeFileSync(fontPath, Buffer.from(fontRes.data));
    }

    // রেজিস্টার করা
    GlobalFonts.registerFromPath(fontPath, "CustomFont");
  } catch (e) {
    console.error("Font register error:", e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { results } = req.body;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: "Please provide a valid 'results' array." });
  }

  try {
    // প্রতি রিকোয়েস্টে ফন্ট এনশিওর করে নেওয়া
    await ensureFontsLoaded();

    const canvas = createCanvas(1000, 850);
    const ctx = canvas.getContext("2d");

    // ব্যাকগ্রাউন্ড
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, 1000, 850);

    // হেডার
    ctx.fillStyle = "#FF0000";
    ctx.font = 'bold 50px "CustomFont", sans-serif';
    ctx.fillText("YouTube Music", 50, 80);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 120);
    ctx.lineTo(950, 120);
    ctx.stroke();

    // থাম্বনেইল লোড
    const thumbPromises = results.map(song =>
      song.thumbnail ? loadImage(song.thumbnail).catch(() => null) : null
    );
    const thumbnails = await Promise.all(thumbPromises);

    let y = 180;

    for (let i = 0; i < results.length; i++) {
      const song = results[i];

      // ১. সিরিয়াল নম্বর
      ctx.fillStyle = "#FF0000";
      ctx.font = 'bold 35px "CustomFont", sans-serif';
      ctx.fillText(`${i + 1}`, 50, y + 60);

      // ২. থাম্বনেইল (Rounded Corners)
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

      // ৩. গানের টাইটেল
      ctx.fillStyle = "#FFFFFF";
      ctx.font = 'bold 30px "CustomFont", sans-serif';
      let title = song.title || "Unknown Title";
      if (ctx.measureText(title).width > 650) {
        title = title.slice(0, 35) + "...";
      }
      ctx.fillText(title, 250, y + 40);

      // ৪. শিল্পী ও ডিউরেশন
      ctx.fillStyle = "#aaaaaa";
      ctx.font = '24px "CustomFont", sans-serif';
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
    return res.status(500).json({ error: "Failed to generate canvas image: " + err.message });
  }
}
