from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sonora_analysis.model import TimbrePitchModel
from sonora_analysis.train import train_and_evaluate


class ModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.model, cls.metrics = train_and_evaluate([60, 64, 67, 69], train_variants=4, test_variants=2, epochs=220)

    def test_learns_instrument_and_pitch_on_unseen_variants(self) -> None:
        self.assertGreaterEqual(self.metrics["instrumentAccuracy"], 0.95)
        self.assertGreaterEqual(self.metrics["pitchAccuracy"], 0.95)
        self.assertEqual(self.metrics["testExamples"], 16)

    def test_model_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.npz"
            self.model.save(path)
            loaded = TimbrePitchModel.load(path)
            self.assertEqual(loaded.instrument_classes.tolist(), ["piano", "violin"])
            self.assertEqual(loaded.pitch_classes.tolist(), [60, 64, 67, 69])


if __name__ == "__main__":
    unittest.main()
