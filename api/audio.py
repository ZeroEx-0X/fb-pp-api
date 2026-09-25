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
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        video_url = query.get('url', [None])[0]

        if not video_url:
            self.send_json(400, {"error": "URL ntiyabonetse"})
            return

        tmp_dir = tempfile.mkdtemp(dir="/tmp")
        output_template = os.path.join(tmp_dir, "%(id)s.%(ext)s")
        cookie_path = None

        # Gukoresha Cookies zivuye mu Variable y'Ikirere (Environment Variable)
        yt_cookies_data = os.environ.get('YT_COOKIES')
        if yt_cookies_data:
            cookie_path = os.path.join(tmp_dir, "youtube_cookies.txt")
            with open(cookie_path, 'w', encoding='utf-8') as f:
                f.write(yt_cookies_data)

        # Amahitamo ya yt-dlp
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'format': 'bestaudio',
            'outtmpl': output_template,
            'ffmpeg_location': imageio_ffmpeg.get_ffmpeg_exe(),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }

        if cookie_path and os.path.exists(cookie_path):
            ydl_opts['cookiefile'] = cookie_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            files = glob.glob(os.path.join(tmp_dir, "*"))
            if not files:
                self.send_json(500, {"error": "Inyandiko y'amajwi ntiyashoboye kuboneka"})
                return

            filepath = files[0]
            filesize = os.path.getsize(filepath)

            # Umupaka wa Vercel ni 4.5 MB
            if filesize > 4500000:
                self.send_json(400, {"error": "Inyandiko irarenze umupaka wa Vercel (4.5MB)"})
                return

            with open(filepath, "rb") as f:
                data = f.read()

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Disposition", 'attachment; filename="audio.mp3"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        except Exception as e:
            self.send_json(500, {"error": str(e)})
        finally:
            try:
                for f in glob.glob(os.path.join(tmp_dir, "*")):
                    os.remove(f)
                os.rmdir(tmp_dir)
            except Exception:
                pass

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)
