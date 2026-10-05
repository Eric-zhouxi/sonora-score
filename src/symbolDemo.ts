import { createProject, newNote, newTrack, type Duration, type NoteEvent, type ProjectData, type Track } from './workspace'

export const SYMBOL_DEMO_ID = 'sonora-symbol-demo-v1'
export const SYMBOL_DEMO_SECTIONS = [
  { beat: 0, title: '基本时值', detail: '全、二分、四分、八分与十六分音符；钢琴双谱表' },
  { beat: 8, title: '升降还原', detail: '♯、♭、♮：听相邻半音的变化' },
  { beat: 16, title: '延音与附点', detail: '同音延音线、跨小节附点拆分，以及短休止' },
  { beat: 24, title: '降号声部', detail: '两支小提琴与大提琴；B♭ 调号、3/4 与 6/8 拍' },
  { beat: 36, title: '收束延长', detail: '钢琴 𝄐 延音记号，尾音延长至约 26.25 秒' },
]

/** A short original etude, with explicit timing so it also demonstrates rests. */
export function createSymbolDemo(): ProjectData {
  const tracks: Track[] = []
  function part(instrument: Track['instrument'], name: string, keySignature: Track['keySignature'], timeSignature: Track['timeSignature']) {
    const track = { ...newTrack(instrument, tracks), name, keySignature, timeSignature, clips: [], notes: [] } as Track
    tracks.push(track)
    return track
  }
  function phrase(track: Track, name: string, startBeats: number) {
    const clipId = `${track.id}-clip-${track.clips!.length}`
    track.clips!.push({ id: clipId, name, startBeats })
    return (midi: number, onsetBeats: number, duration: Duration, marks: Partial<NoteEvent> = {}) => {
      track.notes.push({ ...newNote(midi, duration), velocity: track.instrument === 'piano' ? 0.65 : 0.45, onsetBeats, clipId, ...marks })
    }
  }
  const piano = part('piano', '钢琴 · 时值与记号', 'D', '4/4')
  let note = phrase(piano, '01 基本时值', 0)
  ;[[62, 0, .25], [64, 1, .125], [66, 1.5, .125], [67, 2, .0625], [69, 2.25, .0625], [71, 2.5, .0625], [73, 2.75, .0625], [69, 3, .25], [74, 4, 1]].forEach(([midi, onset, duration]) => note(midi, onset, duration as Duration, { staff: 'treble' }))
  note(50, 0, .5, { staff: 'bass', velocity: .4 }); note(45, 2, .5, { staff: 'bass', velocity: .4 }); note(50, 4, 1, { staff: 'bass', velocity: .4 })
  note = phrase(piano, '02 升号·降号·还原号', 8)
  note(65, 8, .25, { staff: 'treble' }); note(66, 9, .25, { staff: 'treble', spelling: 'sharp' })
  note(63, 10, .25, { staff: 'treble', spelling: 'flat' }); note(64, 11, .25, { staff: 'treble' })
  note(73, 12, .5, { staff: 'treble' }); note(72, 14, .25, { staff: 'treble' }); note(71, 15, .25, { staff: 'treble' })
  note(50, 8, 1, { staff: 'bass', velocity: .35 }); note(45, 12, 1, { staff: 'bass', velocity: .35 })
  note = phrase(piano, '03 延音线·附点·短休止', 16)
  note(69, 16, .25, { staff: 'treble', tieToNext: true }); note(69, 17, .25, { staff: 'treble' })
  note(74, 18.5, .5, { staff: 'treble' })
  note(76, 21, .125, { staff: 'treble' }); note(78, 21.75, .0625, { staff: 'treble' }); note(79, 22, .25, { staff: 'treble' })
  note(50, 16, 1, { staff: 'bass', velocity: .4 }); note(55, 20, .5, { staff: 'bass', velocity: .4 }); note(45, 22, .5, { staff: 'bass', velocity: .4 })
  note = phrase(piano, '05 收束·延长记号', 36)
  note(74, 36, 1, { staff: 'treble', fermata: true }); note(50, 36, 1, { staff: 'bass', fermata: true, velocity: .4 })

  const violin = part('violin', '第一小提琴 · 降号与还原', 'B♭', '3/4')
  note = phrase(violin, '04 降号调·三拍子', 24)
  ;[[70, 24, .25], [72, 25, .125], [74, 25.5, .125], [75, 26, .25], [77, 27, .5], [79, 29, .25], [81, 30, .125], [82, 30.5, .125], [83, 31, .25], [82, 32, .25]].forEach(([midi, onset, duration]) => note(midi, onset, duration as Duration))
  const violin2 = part('violin', '第二小提琴 · 六八拍', 'B♭', '6/8')
  note = phrase(violin2, '04 中声部·六八拍', 24)
  ;[[62, 24, .5], [65, 26, .25], [63, 27, .5], [62, 29, .25], [65, 30, .5], [62, 32, .25]].forEach(([midi, onset, duration]) => note(midi, onset, duration as Duration, { velocity: .3 }))
  const cello = part('cello', '大提琴 · 低音与长休止', 'B♭', '4/4')
  note = phrase(cello, '04 低音支撑', 24)
  note(46, 24, 1, { velocity: .4 }); note(51, 28, 1, { velocity: .4 }); note(53, 32, 1, { velocity: .4 })
  const flute = part('flute', '长笛 · 尾声回应', 'G', '6/8')
  note = phrase(flute, '04 尾声回应', 33)
  note(69, 33, .125); note(78, 34, .25); note(76, 35, .25)

  for (const track of tracks) track.notes.sort((a, b) => a.onsetBeats! - b.onsetBeats!)
  return { ...createProject(96, tracks, 'Sonora 演示：全符号试奏'), id: SYMBOL_DEMO_ID, example: true, keySignature: 'D' }
}

export function withSymbolDemo(projects: ProjectData[]): ProjectData[] {
  return projects.some((project) => project.id === SYMBOL_DEMO_ID) ? projects : [createSymbolDemo(), ...projects]
}
