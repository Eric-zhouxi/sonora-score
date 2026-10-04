from __future__ import annotations

import math

import numpy as np


def midi_frequency(midi: int) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def synthesize_note(
    instrument: str,
    midi: int,
    *,
    sample_rate: int = 16_000,
    duration: float = 1.25,
    seed: int = 0,
) -> np.ndarray:
    if instrument not in {"piano", "violin"}:
        raise ValueError(f"unsupported synthetic instrument: {instrument}")
    rng = np.random.default_rng(seed)
    time = np.arange(int(sample_rate * duration), dtype=np.float64) / sample_rate
    detune = 2 ** (rng.uniform(-5, 5) / 1200)
    fundamental = midi_frequency(midi) * detune
    phase = rng.uniform(0, 2 * math.pi, 18)
    signal = np.zeros_like(time)

    if instrument == "piano":
        attack = 1 - np.exp(-time * rng.uniform(65, 95))
        decay = np.exp(-time * rng.uniform(1.8, 3.0))
        envelope = attack * decay
        for harmonic in range(1, 15):
            frequency = fundamental * harmonic * (1 + 0.00018 * harmonic * harmonic)
            if frequency >= sample_rate * 0.48:
                break
            amplitude = (1 / harmonic ** rng.uniform(1.45, 1.8)) * np.exp(-time * harmonic * 0.12)
            signal += amplitude * np.sin(2 * math.pi * frequency * time + phase[harmonic])
        hammer = rng.normal(0, 1, time.size) * np.exp(-time * 70) * 0.08
        signal = signal * envelope + hammer
    else:
        vibrato_rate = rng.uniform(4.5, 6.2)
        vibrato_depth = rng.uniform(0.002, 0.006)
        instantaneous_phase = 2 * math.pi * fundamental * (time + vibrato_depth / vibrato_rate * np.sin(2 * math.pi * vibrato_rate * time))
        attack = np.minimum(1.0, time / rng.uniform(0.045, 0.12))
        release = np.minimum(1.0, (duration - time) / 0.12)
        envelope = attack * np.maximum(0, release) * (0.84 + 0.08 * np.sin(2 * math.pi * rng.uniform(1.5, 2.4) * time))
        for harmonic in range(1, 18):
            if fundamental * harmonic >= sample_rate * 0.48:
                break
            amplitude = 1 / harmonic ** rng.uniform(0.82, 1.08)
            signal += amplitude * np.sin(instantaneous_phase * harmonic + phase[harmonic])
        bow_noise = rng.normal(0, 1, time.size) * 0.018
        signal = (signal + bow_noise) * envelope

    delay = int(sample_rate * rng.uniform(0.018, 0.035))
    if delay < signal.size:
        signal[delay:] += signal[:-delay] * rng.uniform(0.035, 0.10)
    signal += rng.normal(0, rng.uniform(0.0005, 0.004), signal.size)
    peak = max(float(np.max(np.abs(signal))), 1e-8)
    return (signal / peak * rng.uniform(0.55, 0.92)).astype(np.float32)
