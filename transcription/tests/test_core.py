from __future__ import annotations

import io
import math
import unittest
import wave

import numpy as np

from sonora_analysis.core import analyze_wav, read_wav_mono


def wav_bytes(frequencies: tuple[float, ...], duration: float = 1.2, sample_rate: int = 22_050) -> bytes:
    time = np.arange(int(duration * sample_rate), dtype=np.float64) / sample_rate
    signal = sum(np.sin(2 * math.pi * frequency * time) for frequency in frequencies) / len(frequencies)
    envelope = np.minimum(1, time * 30) * np.minimum(1, (duration - time) * 30)
    pcm = np.clip(signal * envelope * 0.72, -1, 1)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes((pcm * 32767).astype("<i2").tobytes())
    return buffer.getvalue()


class AnalysisTests(unittest.TestCase):
    def test_reads_pcm_wav(self) -> None:
        samples, sample_rate = read_wav_mono(wav_bytes((440.0,)))
        self.assertEqual(sample_rate, 22_050)
        self.assertGreater(samples.size, 20_000)

    def test_detects_a4_single_note(self) -> None:
        result = analyze_wav(wav_bytes((440.0,)))
        self.assertTrue(result.notes)
        self.assertEqual(result.notes[0].midi, 69)
        self.assertGreater(result.notes[0].confidence, 0.7)

    def test_detects_c_major_chord(self) -> None:
        result = analyze_wav(wav_bytes((261.6256, 329.6276, 391.9954)))
        self.assertTrue(result.chords)
        self.assertEqual(result.chords[0].label, "C")

    def test_serializes_frontend_contract(self) -> None:
        payload = analyze_wav(wav_bytes((440.0,), duration=0.6)).to_dict()
        self.assertEqual(payload["engine"], "sonora-dsp-v0.2")
        self.assertIn("sampleRate", payload)
        self.assertIn("onsetSeconds", payload["notes"][0])


if __name__ == "__main__":
    unittest.main()
