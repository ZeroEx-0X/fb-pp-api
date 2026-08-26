import { createCanvas, loadImage } from "@napi-rs/canvas";

export default async function handler(req, res) {
  // শুধুমাত্র POST Request এলাউ করা
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { results } = req.body;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: "Please provide a valid 'results' array." });
  }

  try {
    const canvas = createCanvas(1000, 850);
    const ctx = canvas.getContext("2d");

    // ব্যাকগ্রাউন্ড
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, 1000, 850);

    // টাইটেল ও ডিভাইডার
    ctx.fillStyle = "#FF0000";
    ctx.font = "bold 50px sans-serif";
    ctx.fillText("YouTube Music", 50, 80);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 120);
    ctx.lineTo(950, 120);
    ctx.stroke();

    // থাম্বনেইলগুলো সমান্তরালে লোড করা
    const thumbPromises = results.map(song =>
      song.thumbnail ? loadImage(song.thumbnail).catch(() => null) : null
    );
    const thumbnails = await Promise.all(thumbPromises);

    let y = 180;

    for (let i = 0; i < results.length; i++) {
      const song = results[i];

      // ক্রমিক নম্বর
      ctx.fillStyle = "#FF0000";
      ctx.font = "bold 35px sans-serif";
      ctx.fillText(`${i + 1}`, 50, y + 60);

      // থাম্বনেইল রেন্ডার
      if (thumbnails[i]) {
        ctx.save();
        ctx.beginPath();
        // Rounded Rect for thumbnail
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

      // টাইটেল
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 30px sans-serif";
      let title = song.title || "Unknown";
      if (ctx.measureText(title).width > 650) {
        title = title.slice(0, 35) + "...";
      }
      ctx.fillText(title, 250, y + 40);

      // আর্টস্ট ও ডিউরেশন
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "24px sans-serif";
      const duration = song.durationText || song.duration || "N/A";
      const artist = song.artist || "Unknown Artist";
      ctx.fillText(`${artist} • ${duration}`, 250, y + 85);

      y += 130;
    }

    // ইমেজ বাফার তৈরি করা
    const imageBuffer = await canvas.toBuffer("image/png");

    // PNG ইমেজ রেসপন্স পাঠানো
    res.setHeader("Content-Type", "image/png");
    return res.send(imageBuffer);

  } catch (err) {
    console.error("Canvas Render Error:", err);
    return res.status(500).json({ error: "Failed to generate canvas image." });
  }
}
