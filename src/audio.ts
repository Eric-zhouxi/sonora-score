import * as Tone from 'tone'
import type { InstrumentId, Track } from './workspace'
import { midiToName } from './workspace'
import { playbackEvents } from './playback'

type Voice = Tone.PolySynth | Tone.Sampler
let instruments: Record<InstrumentId, Voice> | undefined
let instrumentsPromise: Promise<Record<InstrumentId, Voice>> | undefined

function syntheticInstruments(): Record<InstrumentId, Tone.PolySynth> {
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
    const cello = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 5 },
      envelope: { attack: 0.08, decay: 0.25, sustain: 0.72, release: 1.1 },
    }).toDestination()
    const flute = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.12, sustain: 0.78, release: 0.45 },
    }).toDestination()
    violin.volume.value = -14
    cello.volume.value = -12
    flute.volume.value = -10
    return { piano, violin, cello, flute }
}

async function getInstruments() {
  if (instruments) return instruments
  if (!instrumentsPromise) {
    instrumentsPromise = (async () => {
      try {
        const sampleBaseUrl = `${import.meta.env.BASE_URL}samples/`
        const piano = new Tone.Sampler({ urls: { A4: 'piano-a4.wav' }, baseUrl: sampleBaseUrl }).toDestination()
        const violin = new Tone.Sampler({ urls: { A4: 'violin-a4.wav' }, baseUrl: sampleBaseUrl, attack: 0.04, release: 0.55 }).toDestination()
        const cello = new Tone.Sampler({ urls: { A4: 'cello-a4.wav' }, baseUrl: sampleBaseUrl, attack: 0.04, release: 0.8 }).toDestination()
        const flute = new Tone.Sampler({ urls: { A4: 'flute-a4.wav' }, baseUrl: sampleBaseUrl, attack: 0.025, release: 0.35 }).toDestination()
        piano.volume.value = -5
        violin.volume.value = -8
        cello.volume.value = -7
        flute.volume.value = -7
        await Tone.loaded()
        instruments = { piano, violin, cello, flute }
      } catch {
        instruments = syntheticInstruments()
      }
      return instruments
    })()
  }
  return instrumentsPromise
}

export async function previewNote(instrument: InstrumentId, midi: number) {
  await Tone.start()
  const voices = await getInstruments()
  voices[instrument].triggerAttackRelease(midiToName(midi), '8n')
}

let scheduleIds: number[] = []
let playbackGeneration = 0

export async function playTracks(
  tracks: Track[],
  bpm: number,
  onStep: (index: number) => void = () => {},
  fromBeats = 0,
  onStart?: () => void,
) {
  stopPlayback()
  const generation = playbackGeneration
  await Tone.start()
  const voices = await getInstruments()
  if (generation !== playbackGeneration) return 0
  const events = playbackEvents(tracks, fromBeats)
  const secondsPerBeat = 60 / bpm
  const transport = Tone.getTransport()
  transport.stop()
  transport.seconds = 0
  let endSeconds = 0
  for (const [index, event] of events.entries()) {
    const onset = event.startBeats * secondsPerBeat
    const duration = event.durationBeats * secondsPerBeat
    endSeconds = Math.max(endSeconds, onset + duration)
    scheduleIds.push(transport.scheduleOnce((time) => {
      voices[event.instrument].triggerAttackRelease(midiToName(event.midi), duration * 0.98, time, event.velocity)
      Tone.getDraw().schedule(() => onStep(index), time)
    }, onset))
  }
  transport.start('+0.06')
  onStart?.()
  return Math.max(endSeconds, 0.01) * 1000 + 60
}

export function stopPlayback() {
  playbackGeneration++
  const transport = Tone.getTransport()
  transport.stop()
  scheduleIds.forEach((id) => transport.clear(id))
  scheduleIds = []
  if (instruments) Object.values(instruments).forEach((instrument) => instrument.releaseAll())
}
