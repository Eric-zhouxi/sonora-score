import {
  addPitchBendsToNoteEvents,
  BasicPitch,
  noteFramesToTime,
  outputToNotesPoly,
} from '@spotify/basic-pitch'

export interface TranscribedNote {
  midi: number
  onsetSeconds: number
  durationSeconds: number
  confidence: number
}

export interface TranscribedChord {
  label: string
  startSeconds: number
  endSeconds: number
  confidence: number
}

export interface BrowserTranscription {
  engine: string
  sampleRate: number
  durationSeconds: number
  notes: TranscribedNote[]
  chords: TranscribedChord[]
  instrument: null
}

const MODEL_SAMPLE_RATE = 22_050
const MODEL_URL = `${import.meta.env.BASE_URL}models/basic-pitch/model.json`
const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

let model: BasicPitch | undefined

async function decodeAndResample(file: File): Promise<AudioBuffer> {
  const decodeContext = new AudioContext()
  try {
    const decoded = await decodeContext.decodeAudioData(await file.arrayBuffer())
    const frameCount = Math.max(1, Math.ceil(decoded.duration * MODEL_SAMPLE_RATE))
    const offline = new OfflineAudioContext(1, frameCount, MODEL_SAMPLE_RATE)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    return await offline.startRendering()
  } finally {
    await decodeContext.close()
  }
}

export function inferChords(notes: TranscribedNote[], durationSeconds: number): TranscribedChord[] {
  const hop = 0.25
  const labels: Array<{ label: string; score: number; time: number }> = []

  for (let time = 0; time < durationSeconds; time += hop) {
    const end = Math.min(durationSeconds, time + hop)
    const energies = Array.from({ length: 12 }, () => 0)
    for (const note of notes) {
      const overlap = Math.min(end, note.onsetSeconds + note.durationSeconds) - Math.max(time, note.onsetSeconds)
      if (overlap > 0) energies[note.midi % 12] += overlap * note.confidence
    }

    const present = energies.filter((energy) => energy > 0.01).length
    const total = energies.reduce((sum, value) => sum + value, 0)
    if (present < 3 || total <= 0) {
      labels.push({ label: 'N', score: 0, time })
      continue
    }

    let best = { label: 'N', score: 0 }
    const chordShapes: Array<[string, readonly number[]]> = [['', [0, 4, 7]], ['m', [0, 3, 7]]]
    for (let root = 0; root < 12; root += 1) {
      for (const [suffix, intervals] of chordShapes) {
        const chordEnergy = intervals.reduce((sum, interval) => sum + energies[(root + interval) % 12], 0)
        const coverage = intervals.filter((interval) => energies[(root + interval) % 12] > 0.01).length / 3
        const score = (chordEnergy / total) * coverage
        if (score > best.score) best = { label: `${PITCH_NAMES[root]}${suffix}`, score }
      }
    }
    labels.push({ ...best, time })
  }

  const segments: TranscribedChord[] = []
  for (const frame of labels) {
    if (frame.label === 'N' || frame.score < 0.52) continue
    const previous = segments.at(-1)
    if (previous?.label === frame.label && frame.time - previous.endSeconds < 0.001) {
      const oldDuration = previous.endSeconds - previous.startSeconds
      previous.endSeconds = Math.min(durationSeconds, frame.time + hop)
      previous.confidence = (previous.confidence * oldDuration + frame.score * hop) / (oldDuration + hop)
    } else {
      segments.push({
        label: frame.label,
        startSeconds: frame.time,
        endSeconds: Math.min(durationSeconds, frame.time + hop),
        confidence: frame.score,
      })
    }
  }
  return segments.filter((segment) => segment.endSeconds - segment.startSeconds >= 0.25)
}

export async function transcribeWithBasicPitch(
  file: File,
  onProgress: (progress: number) => void,
): Promise<BrowserTranscription> {
  onProgress(0.02)
  const audio = await decodeAndResample(file)
  onProgress(0.08)

  model ??= new BasicPitch(MODEL_URL)
  const frames: number[][] = []
  const onsets: number[][] = []
  const contours: number[][] = []

  await model.evaluateModel(
    audio,
    (frameBatch, onsetBatch, contourBatch) => {
      frames.push(...frameBatch)
      onsets.push(...onsetBatch)
      contours.push(...contourBatch)
    },
    (progress) => onProgress(0.08 + progress * 0.84),
  )

  const notes = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.5, 0.3, 5),
    ),
  ).map((note) => ({
    midi: note.pitchMidi,
    onsetSeconds: note.startTimeSeconds,
    durationSeconds: note.durationSeconds,
    confidence: Math.max(0, Math.min(1, note.amplitude)),
  })).sort((left, right) => left.onsetSeconds - right.onsetSeconds || left.midi - right.midi)

  onProgress(0.96)
  const result: BrowserTranscription = {
    engine: 'spotify-basic-pitch-ts-v1.0.1',
    sampleRate: MODEL_SAMPLE_RATE,
    durationSeconds: audio.duration,
    notes,
    chords: inferChords(notes, audio.duration),
    instrument: null,
  }
  onProgress(1)
  return result
}
