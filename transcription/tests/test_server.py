from __future__ import annotations

import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer

from test_core import wav_bytes
from sonora_analysis.server import Handler


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, method: str, path: str, body: bytes | None = None, content_type: str | None = None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {"Content-Type": content_type} if content_type else {}
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        payload = json.loads(response.read())
        connection.close()
        return response.status, payload

    def test_health(self) -> None:
        status, payload = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["engine"], "sonora-dsp-v0.2")

    def test_transcribes_raw_wav_body(self) -> None:
        status, payload = self.request("POST", "/v1/transcriptions", wav_bytes((440.0,)), "audio/wav")
        self.assertEqual(status, 200)
        self.assertEqual(payload["notes"][0]["midi"], 69)
        self.assertTrue(payload["chords"])
        self.assertIn(payload["instrument"]["label"], {"piano", "violin"})
        self.assertEqual(payload["instrument"]["model"], "timbre-pitch-v0.1")

    def test_rejects_non_wav_content_type(self) -> None:
        status, payload = self.request("POST", "/v1/transcriptions", b"not audio", "audio/mpeg")
        self.assertEqual(status, 415)
        self.assertIn("error", payload)


if __name__ == "__main__":
    unittest.main()
