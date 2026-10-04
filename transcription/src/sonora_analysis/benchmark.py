from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .core import NOTE_NAMES, NoteEvent, detect_chords, detect_notes
from .synthetic import synthesize_note


@dataclass(frozen=True)
class TruthNote:
    midi: int
    onset_seconds: float
    duration_seconds: float

    @property
    def offset_seconds(self) -> float:
        return self.onset_seconds + self.duration_seconds


def synthesize_sequence(instrument: str, midis: list[int], *, seed: int, sample_rate: int = 16_000) -> tuple[np.ndarray, list[TruthNote]]:
    rng = np.random.default_rng(seed)
    pieces: list[np.ndarray] = [np.zeros(int(sample_rate * 0.12), dtype=np.float32)]
    truth: list[TruthNote] = []
    cursor = 0.12
    previous: int | None = None
    for index, midi in enumerate(midis):
        if previous == midi:
            midi = midi + 2 if midi < 70 else midi - 2
        duration = float(rng.choice([0.28, 0.36, 0.46, 0.58]))
        gap = float(rng.choice([0.065, 0.085, 0.11]))
        audio = synthesize_note(instrument, midi, sample_rate=sample_rate, duration=duration, seed=seed * 100 + index)
        pieces.append(audio)
        truth.append(TruthNote(midi, cursor, duration))
        pieces.append(np.zeros(int(round(sample_rate * gap)), dtype=np.float32))
        cursor += duration + gap
        previous = midi
    pieces.append(np.zeros(int(sample_rate * 0.12), dtype=np.float32))
    return np.concatenate(pieces), truth


def _f1(true_positive: int, predicted: int, expected: int) -> tuple[float, float, float]:
    precision = true_positive / max(1, predicted)
    recall = true_positive / max(1, expected)
    f1 = 2 * precision * recall / max(1e-12, precision + recall)
    return float(precision), float(recall), float(f1)


def match_notes(truth: list[TruthNote], predicted: tuple[NoteEvent, ...], onset_tolerance: float = 0.08) -> tuple[list[tuple[TruthNote, NoteEvent]], list[tuple[TruthNote, NoteEvent]]]:
    onset_matches: list[tuple[TruthNote, NoteEvent]] = []
    offset_matches: list[tuple[TruthNote, NoteEvent]] = []
    used: set[int] = set()
    for expected in truth:
        candidates = [
            (index, note)
            for index, note in enumerate(predicted)
            if index not in used and note.midi == expected.midi and abs(note.onset_seconds - expected.onset_seconds) <= onset_tolerance
        ]
        if not candidates:
            continue
        index, note = min(candidates, key=lambda item: abs(item[1].onset_seconds - expected.onset_seconds))
        used.add(index)
        onset_matches.append((expected, note))
        offset_tolerance = max(0.08, expected.duration_seconds * 0.2)
        predicted_offset = note.onset_seconds + note.duration_seconds
        if abs(predicted_offset - expected.offset_seconds) <= offset_tolerance:
            offset_matches.append((expected, note))
    return onset_matches, offset_matches


def sequence_metrics(cases: list[tuple[list[TruthNote], tuple[NoteEvent, ...]]]) -> dict[str, float | int]:
    expected_count = sum(len(truth) for truth, _ in cases)
    predicted_count = sum(len(predicted) for _, predicted in cases)
    onset_matches = []
    offset_matches = []
    for truth, predicted in cases:
        onset, offset = match_notes(truth, predicted)
        onset_matches.extend(onset)
        offset_matches.extend(offset)
    onset_precision, onset_recall, onset_f1 = _f1(len(onset_matches), predicted_count, expected_count)
    _, _, note_offset_f1 = _f1(len(offset_matches), predicted_count, expected_count)
    onset_errors = [abs(pred.onset_seconds - expected.onset_seconds) for expected, pred in onset_matches]
    offset_errors = [abs(pred.onset_seconds + pred.duration_seconds - expected.offset_seconds) for expected, pred in onset_matches]
    return {
        "expectedNotes": expected_count,
        "predictedNotes": predicted_count,
        "matchedNotes": len(onset_matches),
        "onsetPrecision": onset_precision,
        "onsetRecall": onset_recall,
        "onsetF1": onset_f1,
        "noteWithOffsetF1": note_offset_f1,
        "meanOnsetErrorMs": float(np.mean(onset_errors) * 1000) if onset_errors else 0.0,
        "meanOffsetErrorMs": float(np.mean(offset_errors) * 1000) if offset_errors else 0.0,
    }


def run_sequence_benchmark(sequence_count: int = 16, notes_per_sequence: int = 8) -> dict[str, object]:
    scale = np.array([60, 62, 64, 65, 67, 69, 71, 72])
    by_instrument: dict[str, dict[str, float | int]] = {}
    all_cases = []
    for instrument_index, instrument in enumerate(("piano", "violin")):
        cases = []
        for sequence_index in range(sequence_count):
            rng = np.random.default_rng(10_000 * instrument_index + sequence_index)
            midis = rng.choice(scale, notes_per_sequence, replace=True).tolist()
            audio, truth = synthesize_sequence(instrument, midis, seed=20_000 * instrument_index + sequence_index)
            cases.append((truth, detect_notes(audio, 16_000)))
        by_instrument[instrument] = sequence_metrics(cases)
        all_cases.extend(cases)
    return {
        "dataset": "synthetic-sequences-v1",
        "sequenceCount": sequence_count * 2,
        "notesPerSequence": notes_per_sequence,
        "overall": sequence_metrics(all_cases),
        "byInstrument": by_instrument,
    }


def synthesize_chord(root: int, minor: bool, *, seed: int, sample_rate: int = 16_000, duration: float = 1.0) -> np.ndarray:
    intervals = (0, 3, 7) if minor else (0, 4, 7)
    rng = np.random.default_rng(seed)
    voices = []
    for voice_index, interval in enumerate(intervals):
        midi = 60 + root + interval
        voice = synthesize_note("piano", midi, sample_rate=sample_rate, duration=duration, seed=seed * 10 + voice_index)
        voices.append(voice * rng.uniform(0.78, 1.0))
    chord = np.sum(np.stack(voices), axis=0)
    return (chord / max(float(np.max(np.abs(chord))), 1e-8) * 0.82).astype(np.float32)


def run_chord_benchmark(variants: int = 3) -> dict[str, object]:
    expected: list[str] = []
    predicted: list[str] = []
    rows = []
    for root in range(12):
        for minor in (False, True):
            label = f"{NOTE_NAMES[root]}{'m' if minor else ''}"
            for variant in range(variants):
                audio = synthesize_chord(root, minor, seed=root * 100 + int(minor) * 10 + variant)
                events = detect_chords(audio, 16_000)
                durations: dict[str, float] = {}
                for event in events:
                    durations[event.label] = durations.get(event.label, 0.0) + (event.end_seconds - event.start_seconds)
                guess = max(durations, key=durations.get) if durations else "N"
                expected.append(label)
                predicted.append(guess)
                rows.append({"expected": label, "predicted": guess, "variant": variant})
    correct = sum(left == right for left, right in zip(expected, predicted, strict=True))
    progression_expected = []
    progression_predicted = []
    progression_count = 6
    chords_per_progression = 8
    for progression_index in range(progression_count):
        rng = np.random.default_rng(80_000 + progression_index)
        pieces = [np.zeros(int(16_000 * 0.12), dtype=np.float32)]
        truth_intervals = []
        cursor = 0.12
        for chord_index in range(chords_per_progression):
            root = int(rng.integers(0, 12))
            minor = bool(rng.integers(0, 2))
            label = f"{NOTE_NAMES[root]}{'m' if minor else ''}"
            duration = 0.72
            pieces.append(synthesize_chord(root, minor, seed=90_000 + progression_index * 100 + chord_index, duration=duration))
            truth_intervals.append((label, cursor, cursor + duration))
            gap = 0.07
            pieces.append(np.zeros(int(16_000 * gap), dtype=np.float32))
            cursor += duration + gap
        events = detect_chords(np.concatenate(pieces), 16_000)
        for label, start, end in truth_intervals:
            midpoint = (start + end) / 2
            covering = [event for event in events if event.start_seconds <= midpoint <= event.end_seconds]
            guess = max(covering, key=lambda event: event.confidence).label if covering else "N"
            progression_expected.append(label)
            progression_predicted.append(guess)
    progression_correct = sum(left == right for left, right in zip(progression_expected, progression_predicted, strict=True))
    return {
        "dataset": "synthetic-triads-v1",
        "classes": 24,
        "examples": len(expected),
        "accuracy": correct / len(expected),
        "progressionCount": progression_count,
        "progressionChordCount": len(progression_expected),
        "progressionAccuracy": progression_correct / len(progression_expected),
        "errors": [row for row in rows if row["expected"] != row["predicted"]],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark sequence timing and 24-class chord recognition")
    parser.add_argument("--output", default="transcription/reports/sequence-chord-baseline-v0.2.json")
    parser.add_argument("--sequences", type=int, default=16, help="sequences per instrument")
    parser.add_argument("--notes", type=int, default=8, help="notes per sequence")
    parser.add_argument("--chord-variants", type=int, default=3)
    args = parser.parse_args()
    report = {
        "sequence": run_sequence_benchmark(args.sequences, args.notes),
        "chord": run_chord_benchmark(args.chord_variants),
    }
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(report, ensure_ascii=False, indent=2)
    destination.write_text(serialized, encoding="utf-8")
    print(serialized)


if __name__ == "__main__":
    main()
