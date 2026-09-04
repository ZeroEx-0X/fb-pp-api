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
                {"error": "url পরামিতি আবশ্যক। Example: /api/merge?url=https://..."},
            )
            return

        tmp_dir = tempfile.mkdtemp(dir="/tmp")
        outtmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "merge_output_format": "mp4",
            "outtmpl": outtmpl,
            "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            files = glob.glob(os.path.join(tmp_dir, "*.mp4"))
            if not files:
                self._send_json(500, {"error": "মার্জ করা ভিডিও পাওয়া যায়নি"})
                return

            filepath = files[0]
            filesize = os.path.getsize(filepath)

            # Vercel serverless response limit is ~4.5MB
            if filesize > 4_400_000:
                self._send_json(
                    413,
                    {
                        "error": "ভিডিও সাইজ Vercel-এর response লিমিট (~4.5MB) এর চেয়ে বড়, তাই সরাসরি পাঠানো যাচ্ছে না।",
                        "filesize": filesize,
                    },
                )
                return

            with open(filepath, "rb") as f:
                data = f.read()

            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Content-Disposition", 'attachment; filename="video.mp4"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)

        except Exception as e:
            self._send_json(500, {"error": str(e)})
        finally:
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
