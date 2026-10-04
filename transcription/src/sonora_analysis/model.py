from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    exponential = np.exp(shifted)
    return exponential / np.sum(exponential, axis=1, keepdims=True)


def _train_head(features: np.ndarray, labels: np.ndarray, classes: np.ndarray, epochs: int, learning_rate: float, l2: float) -> tuple[np.ndarray, np.ndarray]:
    encoded = np.searchsorted(classes, labels)
    targets = np.eye(classes.size)[encoded]
    weights = np.zeros((features.shape[1], classes.size), dtype=np.float64)
    bias = np.zeros(classes.size, dtype=np.float64)
    for _ in range(epochs):
        probabilities = _softmax(features @ weights + bias)
        error = (probabilities - targets) / features.shape[0]
        weights -= learning_rate * (features.T @ error + l2 * weights)
        bias -= learning_rate * np.sum(error, axis=0)
    return weights, bias


@dataclass(frozen=True)
class TimbrePitchModel:
    mean: np.ndarray
    scale: np.ndarray
    instrument_classes: np.ndarray
    instrument_weights: np.ndarray
    instrument_bias: np.ndarray
    pitch_classes: np.ndarray
    pitch_centroids: np.ndarray

    def _standardize(self, features: np.ndarray) -> np.ndarray:
        return (np.atleast_2d(features) - self.mean) / self.scale

    def predict(self, features: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        normalized = self._standardize(features)
        instrument = self.instrument_classes[np.argmax(normalized @ self.instrument_weights + self.instrument_bias, axis=1)]
        pitch_distance = np.abs(normalized[:, [0]] - self.pitch_centroids[None, :])
        pitch = self.pitch_classes[np.argmin(pitch_distance, axis=1)]
        return instrument, pitch

    def predict_proba(self, features: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        normalized = self._standardize(features)
        return (
            _softmax(normalized @ self.instrument_weights + self.instrument_bias),
            _softmax(-np.abs(normalized[:, [0]] - self.pitch_centroids[None, :]) * 8),
        )

    def save(self, path: str | Path) -> None:
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            destination,
            mean=self.mean,
            scale=self.scale,
            instrument_classes=self.instrument_classes,
            instrument_weights=self.instrument_weights,
            instrument_bias=self.instrument_bias,
            pitch_classes=self.pitch_classes,
            pitch_centroids=self.pitch_centroids,
        )

    @classmethod
    def load(cls, path: str | Path) -> "TimbrePitchModel":
        with np.load(path) as payload:
            return cls(**{field: payload[field] for field in cls.__dataclass_fields__})


def train_model(features: np.ndarray, instruments: np.ndarray, pitches: np.ndarray, *, epochs: int = 320, learning_rate: float = 0.09, l2: float = 0.001) -> TimbrePitchModel:
    mean = np.mean(features, axis=0)
    scale = np.std(features, axis=0)
    scale[scale < 1e-7] = 1
    normalized = (features - mean) / scale
    instrument_classes = np.unique(instruments)
    pitch_classes = np.unique(pitches)
    instrument_weights, instrument_bias = _train_head(normalized, instruments, instrument_classes, epochs, learning_rate, l2)
    # A one-dimensional learned codebook matches the ordered physical structure of pitch
    # better than an unconstrained categorical head for this small-data baseline.
    pitch_centroids = np.array([np.mean(normalized[pitches == label, 0]) for label in pitch_classes])
    return TimbrePitchModel(mean, scale, instrument_classes, instrument_weights, instrument_bias, pitch_classes, pitch_centroids)


def accuracy(expected: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(expected == predicted))


def macro_f1(expected: np.ndarray, predicted: np.ndarray) -> float:
    scores = []
    for label in np.unique(expected):
        true_positive = np.sum((expected == label) & (predicted == label))
        false_positive = np.sum((expected != label) & (predicted == label))
        false_negative = np.sum((expected == label) & (predicted != label))
        precision = true_positive / max(1, true_positive + false_positive)
        recall = true_positive / max(1, true_positive + false_negative)
        scores.append(2 * precision * recall / max(1e-12, precision + recall))
    return float(np.mean(scores))
