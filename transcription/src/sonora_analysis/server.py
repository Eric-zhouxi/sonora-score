from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np

from .core import analyze_wav, read_wav_mono
from .features import extract_features
from .model import TimbrePitchModel

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "timbre-pitch-v0.1.npz"


def load_instrument_model(path: str | Path = DEFAULT_MODEL_PATH) -> TimbrePitchModel | None:
    model_path = Path(path)
    return TimbrePitchModel.load(model_path) if model_path.exists() else None


INSTRUMENT_MODEL = load_instrument_model()


class Handler(BaseHTTPRequestHandler):
    server_version = "SonoraTranscription/0.1"

    def _json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(200, {"status": "ok", "engine": "sonora-dsp-v0.1"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/transcriptions":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            self._json(413, {"error": "audio body must be between 1 byte and 25 MB"})
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0] not in {"audio/wav", "audio/x-wav", "application/octet-stream"}:
            self._json(415, {"error": "baseline engine accepts PCM WAV only"})
            return
        try:
            body = self.rfile.read(length)
            analysis = analyze_wav(body)
            payload = analysis.to_dict()
            if INSTRUMENT_MODEL is not None:
                samples, sample_rate = read_wav_mono(body)
                features = extract_features(samples, sample_rate)
                instruments, _ = INSTRUMENT_MODEL.predict(features)
                probabilities, _ = INSTRUMENT_MODEL.predict_proba(features)
                payload["instrument"] = {
                    "label": str(instruments[0]),
                    "confidence": round(float(np.max(probabilities)), 4),
                    "model": "timbre-pitch-v0.1",
                }
            else:
                payload["instrument"] = None
            self._json(200, payload)
        except (ValueError, EOFError) as error:
            self._json(422, {"error": str(error)})

    def log_message(self, message: str, *args: object) -> None:
        print(f"[sonora] {self.address_string()} {message % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local Sonora transcription API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()
    print(f"Sonora transcription API listening on http://{args.host}:{args.port}")
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
