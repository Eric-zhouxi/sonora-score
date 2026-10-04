from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from sonora_analysis.samples import load_manifest


class SampleManifestTests(unittest.TestCase):
    def test_reviewed_subset_has_expected_instruments_and_pitches(self) -> None:
        records = load_manifest("assets/samples/manifest.json")
        self.assertEqual({record.instrument for record in records}, {"piano", "violin", "cello", "flute"})
        self.assertEqual(len(records), 10)
        self.assertEqual(sum(record.instrument == "piano" for record in records), 4)
        self.assertEqual(sum(record.instrument == "violin" for record in records), 4)
        self.assertEqual(sum(record.instrument == "cello" for record in records), 1)
        self.assertEqual(sum(record.instrument == "flute" for record in records), 1)
        self.assertEqual({record.midi for record in records}, {60, 64, 67, 69})
        self.assertTrue(all(record.url.startswith("https://theremin.music.uiowa.edu/") for record in records))
        self.assertTrue(all(record.sha256 and len(record.sha256) == 64 for record in records))

    def test_browser_derivatives_match_manifest(self) -> None:
        manifest = json.loads(Path("assets/samples/manifest.json").read_text(encoding="utf-8"))
        derivatives = [sample["webAsset"] for sample in manifest["samples"] if "webAsset" in sample]
        self.assertEqual(len(derivatives), 4)
        for derivative in derivatives:
            payload = Path(derivative["path"]).read_bytes()
            self.assertEqual(len(payload), derivative["bytes"])
            self.assertEqual(hashlib.sha256(payload).hexdigest(), derivative["sha256"])


if __name__ == "__main__":
    unittest.main()
