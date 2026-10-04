from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from .core import read_audio_mono
from .features import extract_features
from .model import TimbrePitchModel, accuracy, macro_f1
from .samples import load_manifest


def evaluate_manifest(model_path: str | Path, manifest_path: str | Path, sample_dir: str | Path) -> dict[str, object]:
    model = TimbrePitchModel.load(model_path)
    rows = []
    expected_instruments = []
    expected_pitches = []
    predicted_instruments = []
    predicted_pitches = []
    for record in load_manifest(manifest_path):
        path = Path(sample_dir) / record.file_name
        if not path.exists():
            continue
        samples, sample_rate = read_audio_mono(path)
        features = extract_features(samples, sample_rate)
        instrument, pitch = model.predict(features)
        instrument_probabilities, pitch_probabilities = model.predict_proba(features)
        row = {
            "id": record.id,
            "expectedInstrument": record.instrument,
            "predictedInstrument": str(instrument[0]),
            "instrumentConfidence": float(np.max(instrument_probabilities)),
            "expectedMidi": record.midi,
            "predictedMidi": int(pitch[0]),
            "pitchConfidence": float(np.max(pitch_probabilities)),
        }
        rows.append(row)
        expected_instruments.append(record.instrument)
        expected_pitches.append(record.midi)
        predicted_instruments.append(str(instrument[0]))
        predicted_pitches.append(int(pitch[0]))
    if not rows:
        raise ValueError("no downloaded manifest samples were found")
    expected_i = np.array(expected_instruments)
    predicted_i = np.array(predicted_instruments)
    return {
        "dataset": "uiowa-mis-reviewed-subset-v1",
        "sampleCount": len(rows),
        "instrumentAccuracy": accuracy(expected_i, predicted_i),
        "instrumentMacroF1": macro_f1(expected_i, predicted_i),
        "pitchAccuracy": accuracy(np.array(expected_pitches), np.array(predicted_pitches)),
        "samples": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a Sonora model on downloaded, licensed samples")
    parser.add_argument("--model", default="transcription/models/timbre-pitch-v0.1.npz")
    parser.add_argument("--manifest", default="assets/samples/manifest.json")
    parser.add_argument("--samples", default="assets/samples/cache")
    parser.add_argument("--output", help="optional JSON metrics destination")
    args = parser.parse_args()
    metrics = evaluate_manifest(args.model, args.manifest, args.samples)
    serialized = json.dumps(metrics, ensure_ascii=False, indent=2)
    if args.output:
        destination = Path(args.output)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(serialized, encoding="utf-8")
    print(serialized)


if __name__ == "__main__":
    main()
