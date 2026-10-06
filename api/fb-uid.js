import axios from "axios";
import qs from "qs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      status: "error",
      message: "Method not allowed. Use GET."
    });
  }

  const { link } = req.query;

  if (!link) {
    return res.status(400).json({
      status: "error",
      message: "Link is required."
    });
  }

  try {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36";

    // ------------------------------------------------
    // 1. First visit the website and get a NEW session
    // ------------------------------------------------
    const sessionResponse = await axios.get(
      "https://id.traodoisub.com/",
      {
        headers: {
          "User-Agent": userAgent,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache"
        },
        timeout: 15000,
        validateStatus: () => true
      }
    );

    // Get Set-Cookie headers
    const setCookies = sessionResponse.headers["set-cookie"] || [];

    let phpSession = null;

    for (const cookie of setCookies) {
      const match = cookie.match(/PHPSESSID=([^;]+)/i);

      if (match) {
        phpSession = match[1];
        break;
      }
    }

    // ------------------------------------------------
    // 2. If PHPSESSID wasn't returned, stop
    // ------------------------------------------------
    if (!phpSession) {
      return res.status(502).json({
        status: "error",
        message: "Could not create a new PHP session.",
        details: "PHPSESSID was not returned by id.traodoisub.com"
      });
    }

    // ------------------------------------------------
    // 3. Send the UID request using the NEW session
    // ------------------------------------------------
    const postData = qs.stringify({
      link: link
    });

    const apiResponse = await axios.post(
      "https://id.traodoisub.com/api.php",
      postData,
      {
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded; charset=UTF-8",

          "Cookie": `PHPSESSID=${phpSession}`,

          "User-Agent": userAgent,

          "Accept": "application/json, text/javascript, */*; q=0.01",

          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",

          "Origin": "https://id.traodoisub.com",

          "Referer": "https://id.traodoisub.com/",

          "X-Requested-With": "XMLHttpRequest",

          "Cache-Control": "no-cache"
        },

        timeout: 15000,

        validateStatus: () => true
      }
    );

    // ------------------------------------------------
    // 4. Return successful UID
    // ------------------------------------------------
    if (apiResponse.data && apiResponse.data.id) {
      return res.status(200).json({
        status: "success",
        id: apiResponse.data.id,
        link: link
      });
    }

    // ------------------------------------------------
    // 5. Return upstream error
    // ------------------------------------------------
    return res.status(400).json({
      status: "error",
      message:
        apiResponse.data?.error ||
        apiResponse.data?.message ||
        "Could not extract Facebook UID.",
      upstream: apiResponse.data
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      details: err.message
    });
  }
}
