import * as Tone from 'tone'
import type { InstrumentId, NoteEvent, Track } from './music'
import { durationToBeats, midiToName } from './music'

let instruments: Record<InstrumentId, Tone.PolySynth> | undefined

function getInstruments() {
  if (!instruments) {
    const piano = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 3.5,
      envelope: { attack: 0.005, decay: 0.35, sustain: 0.18, release: 1.1 },
      modulationEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.08, release: 0.7 },
    }).toDestination()
    piano.volume.value = -8

    const violin = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 8 },
      envelope: { attack: 0.12, decay: 0.2, sustain: 0.65, release: 0.8 },
    }).toDestination()
    violin.volume.value = -14
    instruments = { piano, violin }
  }
  return instruments
}

export async function previewNote(instrument: InstrumentId, midi: number) {
  await Tone.start()
  getInstruments()[instrument].triggerAttackRelease(midiToName(midi), '8n')
}

export async function playTracks(tracks: Track[], bpm: number, onStep: (index: number) => void) {
  await Tone.start()
  const synths = getInstruments()
  const secondsPerBeat = 60 / bpm
  const startAt = Tone.now() + 0.08
  let longest = 0

  tracks.filter((track) => !track.muted).forEach((track) => {
    let cursor = 0
    track.notes.forEach((note, index) => {
      const duration = durationToBeats(note.duration) * secondsPerBeat
      synths[track.id].triggerAttackRelease(midiToName(note.midi), duration * 0.86, startAt + cursor, note.velocity)
      window.setTimeout(() => onStep(index), (cursor + 0.08) * 1000)
      cursor += duration
    })
    longest = Math.max(longest, cursor)
  })

  return longest * 1000 + 250
}

export function stopPlayback() {
  if (!instruments) return
  Object.values(instruments).forEach((instrument) => instrument.releaseAll())
}
