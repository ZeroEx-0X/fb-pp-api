from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os
import glob
import tempfile
import yt_dlp
import imageio_ffmpeg


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        video_url = query.get("url", [None])[0]

        if not video_url:
            self._send_json(
                400,
                {"error": "url পরামিতি আবশ্যক। Example: /api/audio?url=https://..."},
            )
            return

        tmp_dir = tempfile.mkdtemp(dir="/tmp")
        outtmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")
        cookie_path = None

        # Vercel Env Variable থেকে Cookies বের করে টেম্পোরারি ফাইল তৈরি
        yt_cookies_data = os.environ.get("YT_COOKIES")
        if yt_cookies_data:
            cookie_path = os.path.join(tmp_dir, "youtube_cookies.txt")
            with open(cookie_path, "w", encoding="utf-8") as f:
                f.write(yt_cookies_data)

        # MP3 অডিও এক্সট্র্যাকশনের অপশনসমূহ
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "format": "bestaudio/best",
            "outtmpl": outtmpl,
            "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"],
                }
            },
        }

        # Cookie ফাইল থাকলে অপশনে যুক্ত করা
        if cookie_path and os.path.exists(cookie_path):
            ydl_opts["cookiefile"] = cookie_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            files = glob.glob(os.path.join(tmp_dir, "*.mp3"))
            if not files:
                self._send_json(500, {"error": "অডিও এক্সট্র্যাক্ট করা সম্ভব হয়নি।"})
                return

            filepath = files[0]
            filesize = os.path.getsize(filepath)

            # Vercel-এর রেসপন্স লিমিট প্রায় ৪.৫MB
            if filesize > 4_500_000:
                self._send_json(
                    413,
                    {
                        "error": "অডিও ফাইলটির সাইজ Vercel-এর লিমিট (~4.5MB) অতিক্রম করেছে।",
                        "filesize": filesize,
                    },
                )
                return

            with open(filepath, "rb") as f:
                data = f.read()

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Disposition", 'attachment; filename="audio.mp3"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)

        except Exception as e:
            self._send_json(500, {"error": str(e)})
        finally:
            # টেম্পোরারি ফাইলসমূহ মুছে ফেলা
            try:
                for f in glob.glob(os.path.join(tmp_dir, "*")):
                    os.remove(f)
                os.rmdir(tmp_dir)
            except Exception:
                pass

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)
