import { createProject, newNote, newTrack, type ProjectData } from './workspace'

export const BAND_DEMO_ID = 'sonora-band-demo-v1'
export function createBandDemo(): ProjectData {
  const guitar = newTrack('guitar'), electric = newTrack('electricGuitar', [guitar]), bass = newTrack('bass', [guitar, electric]), drums = newTrack('drums', [guitar, electric, bass])
  const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]]
  for (const [bar, chord] of chords.entries()) {
    for (let beat = 0; beat < 4; beat++) {
      guitar.notes.push({ ...newNote(chord[beat % 3], .25), onsetBeats: bar * 4 + beat, velocity: .65 })
      bass.notes.push({ ...newNote(chord[0] - 12, .25), onsetBeats: bar * 4 + beat, velocity: .55 })
      electric.notes.push({ ...newNote(chord[beat % 3] + 12, .125), onsetBeats: bar * 4 + beat + .5, velocity: .4 })
      drums.notes.push({ ...newNote(beat % 2 ? 38 : 36, .125), onsetBeats: bar * 4 + beat, velocity: .65 })
      for (const offset of [0, .5]) drums.notes.push({ ...newNote(42, .125), onsetBeats: bar * 4 + beat + offset, velocity: .35 })
    }
  }
  drums.notes.push({ ...newNote(49, .25), onsetBeats: 0, velocity: .35 })
  return { ...createProject(104, [guitar, electric, bass, drums], 'Sonora 演示：吉他与鼓'), id: BAND_DEMO_ID, example: true }
}
export function withBandDemo(projects: ProjectData[]): ProjectData[] {
  return projects.some((project) => project.id === BAND_DEMO_ID) ? projects : [...projects, createBandDemo()]
}
