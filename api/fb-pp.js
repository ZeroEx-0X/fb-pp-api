export default async function handler(req, res) {
  const { uid } = req.query;

  if (!uid) {
    return res.status(400).json({
      error: "UID is required. Example: /api/fb-pp?uid=1000xxxxx",
    });
  }

  const ACCESS_TOKEN = "6628568379|c1e620fa708a1d5696fb991c1bde5662";

  try {
    const fbUrl = `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;

    const response = await fetch(fbUrl);

    if (!response.ok) {
      return res.status(404).json({ error: "User not found" });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");

    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
