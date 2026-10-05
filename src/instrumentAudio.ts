import * as Tone from 'tone'
import type { InstrumentId, Track } from './workspace'
import { DRUM_PADS, drumInfo } from './instruments'
import { playbackEvents } from './playback'

interface Voice { play: (midi: number, duration: number, time: number, velocity: number) => void; stop: () => void }
const voices = new Map<InstrumentId, Voice>()
const pending = new Map<InstrumentId, Promise<Voice>>()
const sampleUrls: Record<Exclude<InstrumentId, 'drums'>, Record<string, string>> = {
  piano: { A4: 'piano-a4.wav' }, violin: { A4: 'violin-a4.wav' }, cello: { A4: 'cello-a4.wav' }, flute: { A4: 'flute-a4.wav' },
  guitar: { E2: 'guitar-acoustic-E2.mp3', A3: 'guitar-acoustic-A3.mp3', C5: 'guitar-acoustic-C5.mp3' },
  electricGuitar: { E2: 'guitar-electric-E2.mp3', A3: 'guitar-electric-A3.mp3', C5: 'guitar-electric-C5.mp3' },
  bass: { E1: 'bass-electric-E1.mp3', E2: 'bass-electric-E2.mp3', E3: 'bass-electric-E3.mp3' },
}
function melodicVoice(synth: Tone.Sampler | Tone.PolySynth): Voice {
  return { play: (midi, duration, time, velocity) => synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), duration, time, velocity), stop: () => synth.releaseAll() }
}
function fallbackVoice(instrument: InstrumentId): Voice {
  if (instrument === 'drums') {
    const synths = new Map<number, Tone.MembraneSynth | Tone.NoiseSynth>(DRUM_PADS.map((pad) => [pad.midi, !pad.cross && pad.midi !== 38 ? new Tone.MembraneSynth({ volume: -12 }).toDestination() : new Tone.NoiseSynth({ volume: -16, envelope: { attack: .001, decay: .12, sustain: 0, release: .05 } }).toDestination()]))
    return { play(midi, _duration, time, velocity) {
      const pad = drumInfo(midi) ?? DRUM_PADS[1], synth = synths.get(pad.midi)!
      if (synth instanceof Tone.MembraneSynth) synth.triggerAttackRelease(pad.midi === 36 ? 'C1' : 'C2', .1, time, velocity)
      else synth.triggerAttackRelease(pad.midi === 46 ? .4 : .1, time, velocity)
    }, stop() { synths.forEach((synth) => synth.triggerRelease()) } }
  }
  const plucked = ['piano', 'guitar', 'electricGuitar', 'bass'].includes(instrument)
  const synth = plucked ? new Tone.PolySynth(Tone.FMSynth, { harmonicity: instrument === 'bass' ? 1 : 2, modulationIndex: instrument === 'electricGuitar' ? 5 : 2, envelope: { attack: .005, decay: .3, sustain: .15, release: .5 } }) : new Tone.PolySynth(Tone.Synth, { oscillator: { type: instrument === 'flute' ? 'sine' : 'triangle' }, envelope: { attack: .06, decay: .2, sustain: .6, release: .4 } })
  synth.toDestination(); synth.volume.value = -12
  return melodicVoice(synth)
}
function loadVoice(instrument: InstrumentId): Promise<Voice> {
  return new Promise((resolve, reject) => {
    let resource: Tone.Players | Tone.Sampler | undefined
    const timer = setTimeout(() => { resource?.dispose(); reject(new Error('Sample load timed out')) }, 12000)
    const failed = (error: Error) => { clearTimeout(timer); resource?.dispose(); reject(error) }
    const baseUrl = `${import.meta.env.BASE_URL}samples/`
    if (instrument === 'drums') {
      const players = new Tone.Players({ urls: Object.fromEntries(DRUM_PADS.map((pad) => [pad.midi, `drum-${pad.file}.wav`])), baseUrl, volume: -5, fadeOut: .02,
        onerror: failed, onload() {
          clearTimeout(timer)
          resolve({ play(midi, _duration, time, velocity) {
            const pad = drumInfo(midi) ?? DRUM_PADS[1]
            if (pad.midi === 42) players.player('46').stop(time)
            const player = players.player(String(pad.midi))
            player.volume.setValueAtTime(Tone.gainToDb(Math.max(.001, velocity)), time)
            player.start(time)
          }, stop: () => { players.stopAll() } })
        },
      }).toDestination()
      resource = players
    } else {
      const sampler = new Tone.Sampler({ urls: sampleUrls[instrument], baseUrl, attack: ['violin', 'cello', 'flute'].includes(instrument) ? .025 : .001, release: instrument === 'piano' ? .8 : .3, volume: instrument === 'piano' ? -5 : -8,
        onerror: failed, onload() { clearTimeout(timer); resolve(melodicVoice(sampler)) },
      }).toDestination()
      resource = sampler
    }
  })
}
async function getVoice(instrument: InstrumentId): Promise<Voice> {
  if (voices.has(instrument)) return voices.get(instrument)!
  if (!pending.has(instrument)) pending.set(instrument, loadVoice(instrument).catch(() => fallbackVoice(instrument)).then((voice) => { voices.set(instrument, voice); return voice }))
  return pending.get(instrument)!
}
export async function previewNote(instrument: InstrumentId, midi: number) {
  await Tone.start()
  const voice = await getVoice(instrument)
  voice.play(midi, .3, Tone.now(), .7)
}
let scheduleIds: number[] = []
let playbackGeneration = 0
export async function playTracks(tracks: Track[], bpm: number, onStep: (index: number) => void = () => {}, fromBeats = 0, onStart?: () => void) {
  stopPlayback()
  const generation = playbackGeneration
  await Tone.start()
  const events = playbackEvents(tracks, fromBeats)
  await Promise.all([...new Set(events.map((event) => event.instrument))].map(getVoice))
  if (generation !== playbackGeneration) return 0
  const secondsPerBeat = 60 / bpm, transport = Tone.getTransport()
  transport.stop(); transport.seconds = 0
  let endSeconds = 0
  for (const [index, event] of events.entries()) {
    const onset = event.startBeats * secondsPerBeat, duration = event.durationBeats * secondsPerBeat
    endSeconds = Math.max(endSeconds, onset + duration)
    scheduleIds.push(transport.scheduleOnce((time) => {
      voices.get(event.instrument)!.play(event.midi, duration * .98, time, event.velocity)
      Tone.getDraw().schedule(() => onStep(index), time)
    }, onset))
  }
  transport.start('+0.06'); onStart?.()
  return Math.max(endSeconds, .01) * 1000 + 60
}
export function stopPlayback() {
  playbackGeneration++
  const transport = Tone.getTransport()
  transport.stop(); scheduleIds.forEach((id) => transport.clear(id)); scheduleIds = []
  voices.forEach((voice) => voice.stop())
}
