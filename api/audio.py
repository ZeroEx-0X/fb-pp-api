import os
import glob
import json
import tempfile
import urllib.parse
import urllib.request
import subprocess
import imageio_ffmpeg
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        video_url = query.get('url', [None])[0]

        if not video_url:
            self.send_json(400, {"error": "URL পাওয়া যায়নি"})
            return

        tmp_dir = None
        try:
            # ১. থার্ড পার্টি API থেকে স্ট্রিম তথ্য বের করা
            api_endpoint = f"https://nayan-video-downloader.vercel.app/youtube?url={urllib.parse.quote(video_url)}"
            req = urllib.request.Request(api_endpoint, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))

            if not res_data.get("status") or "data" not in res_data:
                self.send_json(500, {"error": "API থেকে তথ্য আনা সম্ভব হয়নি"})
                return

            formats = res_data["data"].get("formats", [])
            download_url = None

            # Audio স্ট্রিম খোঁজা
            for fmt in formats:
                if fmt.get("type") == "audio" and fmt.get("url"):
                    download_url = fmt["url"]
                    break

            # ব্যাকআপ স্ট্রিম
            if not download_url:
                for fmt in formats:
                    if fmt.get("url"):
                        download_url = fmt["url"]
                        break

            if not download_url:
                self.send_json(404, {"error": "কোন ডাউনলোডেবল স্ট্রিম পাওয়া যায়নি"})
                return

            tmp_dir = tempfile.mkdtemp(dir="/tmp")
            input_file = os.path.join(tmp_dir, "input_media")
            output_mp3 = os.path.join(tmp_dir, "output.mp3")

            # ২. FFmpeg এ পাঠানোর আগে ফাইলটি /tmp ডিরেক্টরিতে পুরোপুরি ডাউনলোড করা
            dl_req = urllib.request.Request(download_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            })
            
            with urllib.request.urlopen(dl_req) as response, open(input_file, 'wb') as out_file:
                out_file.write(response.read())

            # ৩. লোকাল ফাইল ব্যবহার করে FFmpeg রান করা
            ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
            ffmpeg_cmd = [
                ffmpeg_path,
                "-y",
                "-i", input_file,
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

            # Vercel Payload Limit Warning Check (~4.5MB)
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
            if tmp_dir and os.path.exists(tmp_dir):
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
