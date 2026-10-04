from __future__ import annotations

import unittest

from sonora_analysis.benchmark import run_chord_benchmark, run_sequence_benchmark


class BenchmarkTests(unittest.TestCase):
    def test_sequence_metrics_cover_pitch_onset_and_offset(self) -> None:
        report = run_sequence_benchmark(sequence_count=2, notes_per_sequence=5)
        metrics = report["overall"]
        self.assertEqual(metrics["expectedNotes"], 20)
        self.assertGreaterEqual(metrics["onsetF1"], 0.90)
        self.assertGreaterEqual(metrics["noteWithOffsetF1"], 0.90)

    def test_all_major_and_minor_chord_classes(self) -> None:
        report = run_chord_benchmark(variants=1)
        self.assertEqual(report["classes"], 24)
        self.assertGreaterEqual(report["accuracy"], 0.95)
        self.assertGreaterEqual(report["progressionAccuracy"], 0.85)


if __name__ == "__main__":
    unittest.main()
