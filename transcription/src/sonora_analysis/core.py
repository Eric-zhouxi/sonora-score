from __future__ import annotations

import io
import math
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import BinaryIO

import numpy as np

NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


@dataclass(frozen=True)
class NoteEvent:
    midi: int
    onset_seconds: float
    duration_seconds: float
    frequency_hz: float
    confidence: float

    def to_dict(self) -> dict[str, float | int]:
        return {
            "midi": self.midi,
            "onsetSeconds": round(self.onset_seconds, 4),
            "durationSeconds": round(self.duration_seconds, 4),
            "frequencyHz": round(self.frequency_hz, 3),
            "confidence": round(self.confidence, 4),
        }


@dataclass(frozen=True)
class ChordEvent:
    label: str
    start_seconds: float
    end_seconds: float
    confidence: float

    def to_dict(self) -> dict[str, float | str]:
        return {
            "label": self.label,
            "startSeconds": round(self.start_seconds, 4),
            "endSeconds": round(self.end_seconds, 4),
            "confidence": round(self.confidence, 4),
        }


@dataclass(frozen=True)
class Analysis:
    sample_rate: int
    duration_seconds: float
    notes: tuple[NoteEvent, ...]
    chords: tuple[ChordEvent, ...]
    engine: str = "sonora-dsp-v0.1"

    def to_dict(self) -> dict[str, object]:
        return {
            "engine": self.engine,
            "sampleRate": self.sample_rate,
            "durationSeconds": round(self.duration_seconds, 4),
            "notes": [note.to_dict() for note in self.notes],
            "chords": [chord.to_dict() for chord in self.chords],
        }


def _decode_pcm(raw: bytes, sample_width: int, byte_order: str = "little") -> np.ndarray:
    if sample_width == 1:
        return (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    if sample_width == 2:
        dtype = "<i2" if byte_order == "little" else ">i2"
        return np.frombuffer(raw, dtype=dtype).astype(np.float32) / 32768.0
    if sample_width == 3:
        packed = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        if byte_order == "little":
            values = packed[:, 0].astype(np.int32) | (packed[:, 1].astype(np.int32) << 8) | (packed[:, 2].astype(np.int32) << 16)
        else:
            values = packed[:, 2].astype(np.int32) | (packed[:, 1].astype(np.int32) << 8) | (packed[:, 0].astype(np.int32) << 16)
        values = np.where(values & 0x800000, values - 0x1000000, values)
        return values.astype(np.float32) / 8388608.0
    if sample_width == 4:
        dtype = "<i4" if byte_order == "little" else ">i4"
        return np.frombuffer(raw, dtype=dtype).astype(np.float32) / 2147483648.0
    raise ValueError(f"unsupported PCM sample width: {sample_width}")


def read_wav_mono(source: str | Path | bytes | BinaryIO) -> tuple[np.ndarray, int]:
    handle: str | BinaryIO
    if isinstance(source, bytes):
        handle = io.BytesIO(source)
    else:
        handle = source
    with wave.open(handle, "rb") as audio:
        if audio.getcomptype() != "NONE":
            raise ValueError("only uncompressed PCM WAV is supported by the baseline engine")
        channels = audio.getnchannels()
        sample_rate = audio.getframerate()
        samples = _decode_pcm(audio.readframes(audio.getnframes()), audio.getsampwidth())
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if samples.size == 0:
        raise ValueError("WAV file contains no samples")
    return samples.astype(np.float32), sample_rate


def read_audio_mono(source: str | Path | bytes | BinaryIO) -> tuple[np.ndarray, int]:
    if isinstance(source, (str, Path)) and Path(source).suffix.lower() in {".aif", ".aiff", ".aifc"}:
        import aifc

        with aifc.open(str(source), "rb") as audio:
            if audio.getcomptype() not in {b"NONE", "NONE"}:
                raise ValueError("only uncompressed AIFF is supported")
            channels = audio.getnchannels()
            sample_rate = audio.getframerate()
            samples = _decode_pcm(audio.readframes(audio.getnframes()), audio.getsampwidth(), "big")
        if channels > 1:
            samples = samples.reshape(-1, channels).mean(axis=1)
        return samples.astype(np.float32), sample_rate
    return read_wav_mono(source)


def _frames(samples: np.ndarray, size: int, hop: int) -> list[tuple[int, np.ndarray]]:
    if samples.size <= size:
        return [(0, np.pad(samples, (0, size - samples.size)))]
    return [(start, samples[start : start + size]) for start in range(0, samples.size - size + 1, hop)]


def _pitch_from_frame(frame: np.ndarray, sample_rate: int) -> tuple[float, float] | None:
    centered = frame.astype(np.float64) - float(np.mean(frame))
    rms = float(np.sqrt(np.mean(centered * centered)))
    if rms < 0.008:
        return None
    centered *= np.hanning(centered.size)
    fft_size = 1 << ((centered.size * 2 - 1).bit_length())
    spectrum = np.fft.rfft(centered, fft_size)
    autocorrelation = np.fft.irfft(spectrum * np.conj(spectrum), fft_size)[: centered.size]
    autocorrelation /= np.maximum(1, np.arange(centered.size, 0, -1))
    if autocorrelation[0] <= 1e-12:
        return None
    autocorrelation /= autocorrelation[0]
    min_lag = max(1, int(sample_rate / 1200))
    max_lag = min(centered.size - 2, int(sample_rate / 55))
    candidates = autocorrelation[min_lag : max_lag + 1]
    local_peaks = np.where((candidates[1:-1] > candidates[:-2]) & (candidates[1:-1] >= candidates[2:]))[0] + min_lag + 1
    if local_peaks.size == 0:
        return None
    peak_values = autocorrelation[local_peaks]
    best_value = float(np.max(peak_values))
    if best_value < 0.32:
        return None
    # Prefer the earliest strong peak to avoid octave-down errors.
    strong = local_peaks[peak_values >= best_value * 0.92]
    lag = int(strong[0])
    left, middle, right = autocorrelation[lag - 1 : lag + 2]
    denominator = left - 2 * middle + right
    refined = lag if abs(denominator) < 1e-12 else lag + 0.5 * (left - right) / denominator
    return sample_rate / refined, min(1.0, best_value)


def detect_notes(samples: np.ndarray, sample_rate: int) -> tuple[NoteEvent, ...]:
    frame_size = max(2048, 1 << int(math.ceil(math.log2(sample_rate * 0.09))))
    hop = frame_size // 4
    observations: list[tuple[int, int, float, float] | None] = []
    for start, frame in _frames(samples, frame_size, hop):
        pitch = _pitch_from_frame(frame, sample_rate)
        if pitch is None:
            observations.append(None)
            continue
        frequency, confidence = pitch
        midi = int(round(69 + 12 * math.log2(frequency / 440.0)))
        observations.append((start, midi, frequency, confidence) if 21 <= midi <= 108 else None)

    events: list[NoteEvent] = []
    run: list[tuple[int, int, float, float]] = []

    def flush() -> None:
        if len(run) < 2:
            run.clear()
            return
        midis = np.array([item[1] for item in run])
        midi = int(round(float(np.median(midis))))
        filtered = [item for item in run if abs(item[1] - midi) <= 1]
        if len(filtered) < 2:
            run.clear()
            return
        start = filtered[0][0]
        end = filtered[-1][0] + frame_size
        events.append(NoteEvent(
            midi=midi,
            onset_seconds=start / sample_rate,
            duration_seconds=(end - start) / sample_rate,
            frequency_hz=float(np.median([item[2] for item in filtered])),
            confidence=float(np.mean([item[3] for item in filtered])),
        ))
        run.clear()

    for observation in observations:
        if observation is None:
            flush()
        elif not run or abs(observation[1] - int(round(float(np.median([item[1] for item in run]))))) <= 1:
            run.append(observation)
        else:
            flush()
            run.append(observation)
    flush()
    return tuple(events)


def _chord_templates() -> tuple[list[str], np.ndarray]:
    labels: list[str] = []
    templates: list[np.ndarray] = []
    for root in range(12):
        for quality, intervals in (("", (0, 4, 7)), ("m", (0, 3, 7))):
            template = np.zeros(12, dtype=np.float64)
            template[list((root + np.array(intervals)) % 12)] = (1.0, 0.82, 0.88)
            template /= np.linalg.norm(template)
            labels.append(f"{NOTE_NAMES[root]}{quality}")
            templates.append(template)
    return labels, np.stack(templates)


def detect_chords(samples: np.ndarray, sample_rate: int) -> tuple[ChordEvent, ...]:
    window_size = max(4096, 1 << int(math.ceil(math.log2(sample_rate * 0.18))))
    hop = window_size // 2
    labels, templates = _chord_templates()
    frequency_bins = np.fft.rfftfreq(window_size, 1 / sample_rate)
    valid = (frequency_bins >= 65) & (frequency_bins <= 2100)
    midi_bins = np.zeros_like(frequency_bins, dtype=np.int16)
    midi_bins[valid] = np.rint(69 + 12 * np.log2(frequency_bins[valid] / 440)).astype(np.int16)
    observations: list[tuple[int, str, float] | None] = []

    for start, frame in _frames(samples, window_size, hop):
        if float(np.sqrt(np.mean(frame * frame))) < 0.008:
            observations.append(None)
            continue
        magnitudes = np.abs(np.fft.rfft(frame * np.hanning(window_size)))
        chroma = np.zeros(12, dtype=np.float64)
        for pitch_class in range(12):
            chroma[pitch_class] = float(np.sum(magnitudes[valid & (midi_bins % 12 == pitch_class)]))
        norm = np.linalg.norm(chroma)
        if norm <= 1e-10:
            observations.append(None)
            continue
        chroma /= norm
        scores = templates @ chroma
        order = np.argsort(scores)
        best = int(order[-1])
        margin = max(0.0, float(scores[best] - scores[int(order[-2])]))
        confidence = min(1.0, max(0.0, float(scores[best]) * 0.72 + margin * 1.8))
        observations.append((start, labels[best], confidence))

    events: list[ChordEvent] = []
    run: list[tuple[int, str, float]] = []

    def flush() -> None:
        if not run:
            return
        start, label, _ = run[0]
        end = run[-1][0] + window_size
        events.append(ChordEvent(label, start / sample_rate, end / sample_rate, float(np.mean([item[2] for item in run]))))
        run.clear()

    for observation in observations:
        if observation is None:
            flush()
        elif not run or observation[1] == run[-1][1]:
            run.append(observation)
        else:
            flush()
            run.append(observation)
    flush()
    return tuple(events)


def analyze_wav(source: str | Path | bytes | BinaryIO) -> Analysis:
    samples, sample_rate = read_wav_mono(source)
    return Analysis(
        sample_rate=sample_rate,
        duration_seconds=samples.size / sample_rate,
        notes=detect_notes(samples, sample_rate),
        chords=detect_chords(samples, sample_rate),
    )
