from __future__ import annotations

import argparse
import hashlib
import json
import wave
from pathlib import Path

import numpy as np

from .core import read_audio_mono
from .features import trim_and_normalize
from .samples import load_manifest


def resample_linear(samples: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    if source_rate == target_rate:
        return samples
    target_length = max(1, int(round(samples.size * target_rate / source_rate)))
    positions = np.linspace(0, samples.size - 1, target_length)
    return np.interp(positions, np.arange(samples.size), samples).astype(np.float32)


def prepare_sample(source: Path, destination: Path, max_seconds: float, target_rate: int = 22_050) -> dict[str, object]:
    samples, sample_rate = read_audio_mono(source)
    samples = trim_and_normalize(samples, sample_rate, max_seconds=max_seconds)
    samples = resample_linear(samples, sample_rate, target_rate)
    fade = min(samples.size // 4, int(target_rate * 0.04))
    if fade:
        samples[:fade] *= np.linspace(0, 1, fade)
        samples[-fade:] *= np.linspace(1, 0, fade)
    samples = np.clip(samples * 0.88, -1, 1)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(target_rate)
        output.writeframes((samples * 32767).astype("<i2").tobytes())
    payload = destination.read_bytes()
    return {"path": destination.as_posix(), "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare compact browser sampler assets from reviewed source audio")
    parser.add_argument("--manifest", default="assets/samples/manifest.json")
    parser.add_argument("--cache", default="assets/samples/cache")
    parser.add_argument("--output", default="public/samples")
    args = parser.parse_args()
    durations = {"piano": 2.8, "violin": 2.0}
    results = []
    for record in load_manifest(args.manifest):
        if record.midi != 69:
            continue
        source = Path(args.cache) / record.file_name
        if not source.exists():
            raise FileNotFoundError(f"download sample first: {source}")
        destination = Path(args.output) / f"{record.instrument}-a4.wav"
        results.append({"sourceId": record.id, **prepare_sample(source, destination, durations[record.instrument])})
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
