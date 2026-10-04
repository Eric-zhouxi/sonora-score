from __future__ import annotations

import unittest

from sonora_analysis.samples import load_manifest


class SampleManifestTests(unittest.TestCase):
    def test_reviewed_subset_has_expected_instruments_and_pitches(self) -> None:
        records = load_manifest("assets/samples/manifest.json")
        self.assertEqual({record.instrument for record in records}, {"piano", "violin"})
        self.assertEqual(len(records), 8)
        self.assertEqual({record.midi for record in records}, {60, 64, 67, 69})
        self.assertTrue(all(record.url.startswith("https://theremin.music.uiowa.edu/") for record in records))
        self.assertTrue(all(record.sha256 and len(record.sha256) == 64 for record in records))


if __name__ == "__main__":
    unittest.main()
