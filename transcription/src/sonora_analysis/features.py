from __future__ import annotations

import math

import numpy as np

from .core import _pitch_from_frame


def trim_and_normalize(samples: np.ndarray, sample_rate: int, max_seconds: float = 1.8) -> np.ndarray:
    mono = np.asarray(samples, dtype=np.float32)
    peak = float(np.max(np.abs(mono)))
    if peak <= 1e-8:
        return np.zeros(max(2048, int(sample_rate * 0.2)), dtype=np.float32)
    active = np.flatnonzero(np.abs(mono) >= peak * 0.025)
    start = max(0, int(active[0]) - int(sample_rate * 0.015)) if active.size else 0
    clipped = mono[start : start + int(sample_rate * max_seconds)] / peak
    if clipped.size < 2048:
        clipped = np.pad(clipped, (0, 2048 - clipped.size))
    return clipped.astype(np.float32)


def estimate_fundamental(samples: np.ndarray, sample_rate: int) -> tuple[float, float]:
    frame_size = max(2048, 1 << int(math.ceil(math.log2(sample_rate * 0.09))))
    hop = frame_size // 3
    observations: list[tuple[float, float]] = []
    for start in range(0, max(1, samples.size - frame_size + 1), hop):
        frame = samples[start : start + frame_size]
        if frame.size < frame_size:
            frame = np.pad(frame, (0, frame_size - frame.size))
        pitch = _pitch_from_frame(frame, sample_rate)
        if pitch is not None:
            observations.append(pitch)
    if not observations:
        return 0.0, 0.0
    midi_values = np.array([69 + 12 * math.log2(frequency / 440) for frequency, _ in observations])
    median_midi = float(np.median(midi_values))
    keep = np.abs(midi_values - median_midi) <= 0.75
    selected = [value for value, accepted in zip(observations, keep, strict=True) if accepted]
    if not selected:
        selected = observations
    return float(np.median([item[0] for item in selected])), float(np.mean([item[1] for item in selected]))


def extract_features(samples: np.ndarray, sample_rate: int) -> np.ndarray:
    audio = trim_and_normalize(samples, sample_rate)
    frequency, pitch_confidence = estimate_fundamental(audio, sample_rate)
    frame_size = min(4096, 1 << int(math.floor(math.log2(audio.size))))
    frame_size = max(2048, frame_size)
    hop = frame_size // 2
    frames = []
    for start in range(0, max(1, audio.size - frame_size + 1), hop):
        frame = audio[start : start + frame_size]
        if frame.size < frame_size:
            frame = np.pad(frame, (0, frame_size - frame.size))
        frames.append(np.abs(np.fft.rfft(frame * np.hanning(frame_size))))
    magnitude = np.mean(np.stack(frames), axis=0) + 1e-9
    frequencies = np.fft.rfftfreq(frame_size, 1 / sample_rate)
    power_sum = float(np.sum(magnitude))
    centroid = float(np.sum(frequencies * magnitude) / power_sum) / (sample_rate / 2)
    cumulative = np.cumsum(magnitude)
    rolloff_index = int(np.searchsorted(cumulative, cumulative[-1] * 0.85))
    rolloff = float(frequencies[min(rolloff_index, frequencies.size - 1)]) / (sample_rate / 2)
    geometric = float(np.exp(np.mean(np.log(magnitude))))
    flatness = geometric / float(np.mean(magnitude))

    harmonic = np.zeros(14, dtype=np.float64)
    if frequency > 0:
        for index in range(1, harmonic.size + 1):
            target = frequency * index
            if target >= sample_rate / 2:
                break
            bin_index = int(round(target / sample_rate * frame_size))
            left, right = max(0, bin_index - 1), min(magnitude.size, bin_index + 2)
            harmonic[index - 1] = float(np.max(magnitude[left:right]))
    harmonic /= max(float(harmonic[0]), 1e-8)
    harmonic = np.log1p(harmonic * 10) / math.log(11)

    absolute = np.abs(audio)
    window = max(1, int(sample_rate * 0.02))
    cumulative_absolute = np.concatenate(([0.0], np.cumsum(absolute, dtype=np.float64)))
    envelope = (cumulative_absolute[window:] - cumulative_absolute[:-window]) / window
    attack = float(np.argmax(envelope)) / sample_rate / max(audio.size / sample_rate, 1e-6)
    third = max(1, audio.size // 3)
    early_energy = float(np.sqrt(np.mean(audio[:third] ** 2)))
    late_energy = float(np.sqrt(np.mean(audio[-third:] ** 2)))
    sustain_ratio = late_energy / max(early_energy, 1e-8)
    zero_crossing = float(np.mean(np.signbit(audio[1:]) != np.signbit(audio[:-1])))
    rms = float(np.sqrt(np.mean(audio * audio)))
    log_pitch = math.log2(max(frequency, 1.0) / 440.0)
    pitch_class = (69 + 12 * log_pitch) % 12 if frequency > 0 else 0

    return np.array([
        log_pitch,
        math.sin(2 * math.pi * pitch_class / 12),
        math.cos(2 * math.pi * pitch_class / 12),
        pitch_confidence,
        *harmonic.tolist(),
        centroid,
        rolloff,
        flatness,
        attack,
        min(4.0, sustain_ratio),
        zero_crossing,
        rms,
    ], dtype=np.float64)
