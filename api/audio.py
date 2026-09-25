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

            # ==============================
            # Cookies
            # ==============================

            cookies = os.environ.get("YT_COOKIES")

            if cookies:
                cookie_path = os.path.join(
                    tmp_dir,
                    "youtube_cookies.txt"
                )

                with open(
                    cookie_path,
                    "w",
                    encoding="utf-8"
                ) as f:
                    f.write(cookies)

            # ==============================
            # yt-dlp
            # ==============================

            ydl_opts = {
                "quiet": True,
                "no_warnings": False,
                "noplaylist": True,

                # Try audio first
                "format": (
                    "bestaudio[ext=m4a]/"
                    "bestaudio[ext=webm]/"
                    "bestaudio/"
                    "best"
                ),

                "outtmpl": output_template,

                "ffmpeg_location":
                    imageio_ffmpeg.get_ffmpeg_exe(),

                # IMPORTANT
                # Do not force android / ios
                "extractor_args": {
                    "youtube": {
                        "player_client": [
                            "default",
                            "web_embedded"
                        ]
                    }
                },

                "retries": 3,
                "fragment_retries": 3,

                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
            }

            # ==============================
            # Add cookies
            # ==============================

            if cookie_path and os.path.exists(cookie_path):
                ydl_opts["cookiefile"] = cookie_path

            # ==============================
            # Download
            # ==============================

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:

                info = ydl.extract_info(
                    video_url,
                    download=True
                )

            # ==============================
            # Find output
            # ==============================

            files = glob.glob(
                os.path.join(tmp_dir, "*")
            )

            mp3_files = [
                f for f in files
                if f.lower().endswith(".mp3")
            ]

            if not mp3_files:

                self.send_json(500, {
                    "success": False,
                    "error": "MP3 তৈরি হয়নি",
                    "files": [
                        os.path.basename(f)
                        for f in files
                    ]
                })

                return

            filepath = mp3_files[0]

            filesize = os.path.getsize(filepath)

            # ==============================
            # Vercel response limit
            # ==============================

            if filesize > 4500000:

                self.send_json(400, {
                    "success": False,
                    "error": (
                        "ফাইল সাইজ Vercel-এর "
                        "4.5MB response limit-এর বেশি"
                    ),
                    "size": filesize
                })

                return

            # ==============================
            # Send MP3
            # ==============================

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

            try:

                for f in glob.glob(
                    os.path.join(tmp_dir, "*")
                ):
                    os.remove(f)

                os.rmdir(tmp_dir)

            except Exception:
                pass

    # ==============================
    # JSON helper
    # ==============================

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
