from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
import json
import requests


API_BASE = "https://nayan-video-downloader.vercel.app/youtube"


class handler(BaseHTTPRequestHandler):

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            youtube_url = params.get("url", [None])[0]

            if not youtube_url:
                return self.send_json({
                    "success": False,
                    "error": "Missing url parameter"
                }, 400)

            # Call your API
            api_url = API_BASE + "?url=" + quote(
                youtube_url,
                safe=""
            )

            response = requests.get(
                api_url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0"
                },
                timeout=60
            )

            if response.status_code != 200:
                return self.send_json({
                    "success": False,
                    "error": "Downloader API returned HTTP "
                             + str(response.status_code),
                    "details": response.text[:1000]
                }, 502)

            try:
                data = response.json()
            except Exception:
                return self.send_json({
                    "success": False,
                    "error": "Downloader API did not return JSON",
                    "details": response.text[:1000]
                }, 502)

            # Try to find audio/download URL recursively
            audio_url = find_audio_url(data)

            if not audio_url:
                return self.send_json({
                    "success": False,
                    "error": "Audio URL not found in API response",
                    "api_response": data
                }, 502)

            # Return a clean response
            return self.send_json({
                "success": True,
                "audio": audio_url,
                "source": youtube_url
            })

        except requests.exceptions.Timeout:
            return self.send_json({
                "success": False,
                "error": "Downloader API timeout"
            }, 504)

        except Exception as e:
            return self.send_json({
                "success": False,
                "error": str(e)
            }, 500)


def find_audio_url(obj):
    """
    Recursively search JSON for an audio/download URL.
    """

    preferred_keys = [
        "audio",
        "audio_url",
        "audioUrl",
        "download",
        "download_url",
        "downloadUrl",
        "url",
        "link"
    ]

    if isinstance(obj, dict):

        # First check preferred keys
        for key in preferred_keys:
            if key in obj:
                value = obj[key]

                if isinstance(value, str):
                    if value.startswith("http://") or value.startswith("https://"):
                        return value

                elif isinstance(value, dict):
                    result = find_audio_url(value)
                    if result:
                        return result

        # Then recursively search everything
        for value in obj.values():
            result = find_audio_url(value)
            if result:
                return result

    elif isinstance(obj, list):

        for item in obj:
            result = find_audio_url(item)
            if result:
                return result

    elif isinstance(obj, str):

        if obj.startswith("http://") or obj.startswith("https://"):
            return obj

    return None
