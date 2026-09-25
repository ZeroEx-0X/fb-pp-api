import os
import glob
import json
import tempfile
import urllib.parse
import urllib.request
import subprocess
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        video_url = query.get('url', [None])[0]

        if not video_url:
            self.send_json(400, {"error": "URL পাওয়া যায়নি"})
            return

        try:
            # 외부 API কল করে তথ্য আনা
            api_endpoint = f"https://nayan-video-downloader.vercel.app/youtube?url={urllib.parse.quote(video_url)}"
            req = urllib.request.Request(api_endpoint, headers={'User-Agent': 'Mozilla/5.0'})
            
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))

            if not res_data.get("status") or "data" not in res_data:
                self.send_json(500, {"error": "API থেকে তথ্য আনা সম্ভব হয়নি"})
                return

            formats = res_data["data"].get("formats", [])
            download_url = None

            # ১. প্রথমে audio ফরম্যাট খুঁজে বের করা (medium/low quality)
            for fmt in formats:
                if fmt.get("type") == "audio" and fmt.get("url"):
                    download_url = fmt["url"]
                    break

            # ২. অডিও না পেলে 240p/144p ভিডিও স্ট্রিম থেকে ব্যাকআপ নেওয়া
            if not download_url:
                for fmt in formats:
                    if fmt.get("url"):
                        download_url = fmt["url"]
                        break

            if not download_url:
                self.send_json(404, {"error": "কোন ডাউনলোডেবল স্ট্রিম পাওয়া যায়নি"})
                return

            # Temporary Directory তৈরি
            tmp_dir = tempfile.mkdtemp(dir="/tmp")
            output_mp3 = os.path.join(tmp_dir, "output.mp3")

            # FFmpeg দিয়ে সরাসরি URL থেকে অডিও কনভার্ট করা
            ffmpeg_cmd = [
                "ffmpeg",
                "-y",
                "-i", download_url,
                "-vn",
                "-acodec", "libmp3lame",
                "-ab", "128k",
                "-ar", "44100",
                output_mp3
            ]

            subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

            if not os.path.exists(output_mp3):
                self.send_json(500, {"error": "FFmpeg অডিও ফাইল তৈরি করতে পারেনি"})
                return

            filesize = os.path.getsize(output_mp3)

            # Vercel লিমিট চেক (4.5MB)
            if filesize > 4500000:
                self.send_json(400, {"error": "ফাইল সাইজ Vercel লিমিট (4.5MB) অতিক্রম করেছে"})
                return

            with open(output_mp3, "rb") as f:
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
