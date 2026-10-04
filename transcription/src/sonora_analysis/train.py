from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from .features import extract_features
from .model import accuracy, macro_f1, train_model
from .synthetic import synthesize_note


def build_synthetic_dataset(midis: list[int], variants: int, seed_offset: int = 0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    features: list[np.ndarray] = []
    instruments: list[str] = []
    pitches: list[int] = []
    for instrument_index, instrument in enumerate(("piano", "violin")):
        for midi in midis:
            for variant in range(variants):
                seed = seed_offset + instrument_index * 100_000 + midi * 100 + variant
                audio = synthesize_note(instrument, midi, seed=seed)
                features.append(extract_features(audio, 16_000))
                instruments.append(instrument)
                pitches.append(midi)
    return np.stack(features), np.array(instruments), np.array(pitches)


def train_and_evaluate(midis: list[int], train_variants: int = 12, test_variants: int = 4, epochs: int = 320):
    train_features, train_instruments, train_pitches = build_synthetic_dataset(midis, train_variants)
    test_features, test_instruments, test_pitches = build_synthetic_dataset(midis, test_variants, seed_offset=5_000_000)
    model = train_model(train_features, train_instruments, train_pitches, epochs=epochs)
    predicted_instruments, predicted_pitches = model.predict(test_features)
    metrics = {
        "trainExamples": int(train_features.shape[0]),
        "testExamples": int(test_features.shape[0]),
        "featureCount": int(train_features.shape[1]),
        "instrumentAccuracy": accuracy(test_instruments, predicted_instruments),
        "instrumentMacroF1": macro_f1(test_instruments, predicted_instruments),
        "pitchAccuracy": accuracy(test_pitches, predicted_pitches),
        "midiRange": [min(midis), max(midis)],
        "dataset": "synthetic-smoke-v1",
    }
    return model, metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Sonora's reproducible single-note smoke model")
    parser.add_argument("--output", default="transcription/models/timbre-pitch-v0.1.npz")
    parser.add_argument("--metrics", default="transcription/reports/synthetic-baseline-v0.1.json")
    parser.add_argument("--midi-min", type=int, default=60)
    parser.add_argument("--midi-max", type=int, default=71)
    parser.add_argument("--train-variants", type=int, default=12)
    parser.add_argument("--test-variants", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=320)
    args = parser.parse_args()
    model, metrics = train_and_evaluate(list(range(args.midi_min, args.midi_max + 1)), args.train_variants, args.test_variants, args.epochs)
    model.save(args.output)
    metrics_path = Path(args.metrics)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
