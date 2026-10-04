from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from .core import read_audio_mono
from .benchmark import TruthNote, sequence_metrics
from .core import detect_notes
from .features import extract_features, trim_and_normalize
from .model import TimbrePitchModel, accuracy, macro_f1
from .samples import load_manifest


def evaluate_manifest(model_path: str | Path, manifest_path: str | Path, sample_dir: str | Path) -> dict[str, object]:
    model = TimbrePitchModel.load(model_path)
    rows = []
    expected_instruments = []
    expected_pitches = []
    predicted_instruments = []
    predicted_pitches = []
    records = load_manifest(manifest_path)
    for record in records:
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
        "realSequenceSmoke": evaluate_real_sequences(records, sample_dir),
    }


def evaluate_real_sequences(records, sample_dir: str | Path, sequences_per_instrument: int = 6) -> dict[str, object]:
    by_instrument = {}
    all_cases = []
    for instrument_index, instrument in enumerate(("piano", "violin")):
        available = {record.midi: record for record in records if record.instrument == instrument}
        if len(available) < 2:
            continue
        sample_rate = 0
        prepared = {}
        duration = 0.44 if instrument == "piano" else 0.52
        for midi, record in available.items():
            audio, current_rate = read_audio_mono(Path(sample_dir) / record.file_name)
            if sample_rate and current_rate != sample_rate:
                raise ValueError("real sequence smoke requires a shared sample rate")
            sample_rate = current_rate
            clip = trim_and_normalize(audio, sample_rate, max_seconds=duration)
            target_length = int(round(duration * sample_rate))
            clip = np.pad(clip[:target_length], (0, max(0, target_length - clip.size)))
            fade = min(int(sample_rate * 0.025), clip.size // 4)
            clip[-fade:] *= np.linspace(1, 0, fade)
            prepared[midi] = clip.astype(np.float32)
        cases = []
        midi_choices = np.array(sorted(prepared))
        for sequence_index in range(sequences_per_instrument):
            rng = np.random.default_rng(300_000 + instrument_index * 10_000 + sequence_index)
            sequence = rng.choice(midi_choices, 8, replace=True).tolist()
            pieces = [np.zeros(int(sample_rate * 0.12), dtype=np.float32)]
            truth = []
            cursor = 0.12
            for midi in sequence:
                gap = 0.09
                pieces.append(prepared[int(midi)])
                truth.append(TruthNote(int(midi), cursor, duration))
                pieces.append(np.zeros(int(sample_rate * gap), dtype=np.float32))
                cursor += duration + gap
            predicted = detect_notes(np.concatenate(pieces), sample_rate)
            cases.append((truth, predicted))
        by_instrument[instrument] = sequence_metrics(cases)
        all_cases.extend(cases)
    return {
        "sequenceCount": sequences_per_instrument * len(by_instrument),
        "notesPerSequence": 8,
        "overall": sequence_metrics(all_cases),
        "byInstrument": by_instrument,
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
