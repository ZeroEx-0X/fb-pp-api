import axios from "axios";
import * as cheerio from "cheerio";

async function findUid(link) {
  try {
    const response = await axios.post(
      "https://seomagnifier.com/fbid",
      new URLSearchParams({
        facebook: "1",
        sitelink: link
      }),
      {
        headers: {
          "content-type":
            "application/x-www-form-urlencoded; charset=UTF-8",

          "Cookie":
            "PHPSESSID=0d8feddd151431cf35ccb0522b056dc6"
        }
      }
    );

    const id = response.data;

    // Seomagnifier থেকে numeric UID পাওয়া গেলে
    if (!isNaN(id)) {
      return String(id).trim();
    }

    // Seomagnifier fail করলে Facebook page থেকে try করবে
    const html = await axios.get(link, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/124.0.0.0 Safari/537.36"
      }
    });

    const $ = cheerio.load(html.data);

    const el =
      $('meta[property="al:android:url"]').attr("content") ||
      $('meta[name="al:android:url"]').attr("content");

    if (!el) {
      throw new Error("UID not found");
    }

    const number = el.split("/").pop();

    if (!number || isNaN(number)) {
      throw new Error("UID not found");
    }

    return number;

  } catch (error) {
    throw new Error(
      error.message ||
      "An unexpected error occurred. Please try again."
    );
  }
}

export default async function handler(req, res) {

  // Only GET
  if (req.method !== "GET") {
    return res.status(405).json({
      status: "error",
      message: "Method not allowed. Use GET."
    });
  }

  const { link } = req.query;

  // Link missing
  if (!link) {
    return res.status(400).json({
      status: "error",
      message:
        "Link is required. Example: /api/fb-uid?link=https://facebook.com/zuck"
    });
  }

  try {

    // Facebook URL check
    const url = new URL(link);

    const allowedHosts = [
      "facebook.com",
      "www.facebook.com",
      "m.facebook.com"
    ];

    if (!allowedHosts.includes(url.hostname.toLowerCase())) {
      return res.status(400).json({
        status: "error",
        message: "Only Facebook URLs are supported."
      });
    }

    // Find UID
    const id = await findUid(link);

    return res.status(200).json({
      status: "success",
      id: id,
      link: link
    });

  } catch (error) {

    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to find Facebook UID."
    });
  }
}

"package.json"-এ শুধু এগুলো থাকলেই হবে:

{
  "dependencies": {
    "axios": "^1.7.9",
    "cheerio": "^1.0.0"
  }
}

তারপর test:

https://YOUR-DOMAIN.vercel.app/api/fb-uid?link=https://www.facebook.com/Adi.0X

⚠️ একটা বিষয়: তোমার দেওয়া "PHPSESSID" যদি expired/invalid হয়ে থাকে, তাহলে একই code হলেও Seomagnifier থেকে UID আসবে না। নতুন session cookie প্রয়োজন হলে hard-coded পুরোনো cookie কাজ করবে না।
