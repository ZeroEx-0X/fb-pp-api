from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import yt_dlp


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        video_url = query.get("url", [None])[0]

        if not video_url:
            self._send_json(
                400,
                {"error": "url পরামিতি আবশ্যক। Example: /api/download?url=https://..."},
            )
            return

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)

            formats = []
            for f in info.get("formats", []) or []:
                if not f.get("url"):
                    continue
                formats.append(
                    {
                        "format_id": f.get("format_id"),
                        "ext": f.get("ext"),
                        "resolution": f.get("resolution") or f.get("format_note"),
                        "filesize": f.get("filesize") or f.get("filesize_approx"),
                        "has_audio": f.get("acodec") not in (None, "none"),
                        "has_video": f.get("vcodec") not in (None, "none"),
                        "url": f.get("url"),
                    }
                )

            result = {
                "title": info.get("title"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration"),
                "uploader": info.get("uploader"),
                "direct_url": info.get("url"),
                "formats": formats,
            }

            self._send_json(200, result)

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)
