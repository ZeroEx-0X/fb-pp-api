import os
import glob
import json
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler

import yt_dlp
import imageio_ffmpeg


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        query = urllib.parse.parse_qs(
            urllib.parse.urlparse(self.path).query
        )

        video_url = query.get("url", [None])[0]

        if not video_url:
            self.send_json(400, {
                "success": False,
                "error": "URL পাওয়া যায়নি"
            })
            return

        tmp_dir = tempfile.mkdtemp(dir="/tmp")
        output_template = os.path.join(
            tmp_dir,
            "%(id)s.%(ext)s"
        )

        cookie_path = None

        try:
            # =========================
            # YouTube Cookies
            # =========================
            yt_cookies_data = os.environ.get("YT_COOKIES")

            if yt_cookies_data:
                cookie_path = os.path.join(
                    tmp_dir,
                    "youtube_cookies.txt"
                )

                with open(
                    cookie_path,
                    "w",
                    encoding="utf-8"
                ) as f:
                    f.write(yt_cookies_data)

            # =========================
            # yt-dlp configuration
            # =========================
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,

                # Audio format fallback
                "format": (
                    "bestaudio[ext=m4a]/"
                    "bestaudio[ext=webm]/"
                    "bestaudio/"
                    "best"
                ),

                "outtmpl": output_template,

                "ffmpeg_location":
                    imageio_ffmpeg.get_ffmpeg_exe(),

                # Don't force android / ios clients
                "extractor_args": {
                    "youtube": {
                        "player_client": [
                            "web_embedded",
                            "default"
                        ]
                    }
                },

                # Avoid unnecessary downloads
                "retries": 3,
                "fragment_retries": 3,

                # Audio conversion
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
            }

            # Add cookies only when available
            if cookie_path and os.path.exists(cookie_path):
                ydl_opts["cookiefile"] = cookie_path

            # =========================
            # Download
            # =========================
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            # =========================
            # Find generated MP3
            # =========================
            files = glob.glob(
                os.path.join(tmp_dir, "*")
            )

            if not files:
                self.send_json(500, {
                    "success": False,
                    "error": "অডিও ফাইল তৈরি হতে পারেনি"
                })
                return

            # Prefer MP3
            mp3_files = [
                f for f in files
                if f.lower().endswith(".mp3")
            ]

            filepath = (
                mp3_files[0]
                if mp3_files
                else files[0]
            )

            filesize = os.path.getsize(filepath)

            # =========================
            # Vercel response limit
            # =========================
            if filesize > 4500000:
                self.send_json(400, {
                    "success": False,
                    "error": (
                        "ফাইল সাইজ Vercel 4.5MB "
                        "লিমিট অতিক্রম করেছে"
                    )
                })
                return

            # =========================
            # Send audio
            # =========================
            with open(filepath, "rb") as f:
                data = f.read()

            self.send_response(200)
            self.send_header(
                "Content-Type",
                "audio/mpeg"
            )
            self.send_header(
                "Content-Disposition",
                'attachment; filename="audio.mp3"'
            )
            self.send_header(
                "Access-Control-Allow-Origin",
                "*"
            )
            self.send_header(
                "Content-Length",
                str(len(data))
            )
            self.end_headers()

            self.wfile.write(data)

        except yt_dlp.utils.DownloadError as e:
            self.send_json(500, {
                "success": False,
                "error": str(e)
            })

        except Exception as e:
            self.send_json(500, {
                "success": False,
                "error": str(e)
            })

        finally:
            # =========================
            # Cleanup
            # =========================
            try:
                for f in glob.glob(
                    os.path.join(tmp_dir, "*")
                ):
                    os.remove(f)

                os.rmdir(tmp_dir)

            except Exception:
                pass

    # =============================
    # JSON response helper
    # =============================
    def send_json(self, status, data):
        body = json.dumps(
            data,
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Content-Length",
            str(len(body))
        )

        self.end_headers()

        self.wfile.write(body)
