import { createExampleProject, parseProject, type ProjectData } from './workspace'
import { withSymbolDemo } from './symbolDemo'
import { withBandDemo } from './bandDemo'

const LIBRARY_KEY = 'sonora.library.v1'
const LEGACY_KEY = 'sonora.project'

export function loadProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown[]
      const projects = parsed.map((project) => parseProject(JSON.stringify(project))).filter((project): project is ProjectData => Boolean(project))
      if (projects.length) return withBandDemo(withSymbolDemo(projects))
    }
  } catch {
    // Fall through to legacy migration.
  }

  const legacy = parseProject(localStorage.getItem(LEGACY_KEY))
  const example = createExampleProject()
  return withBandDemo(withSymbolDemo(legacy ? [{ ...legacy, title: '迁移的旧草稿' }, example] : [example]))
}

export function saveProjects(projects: ProjectData[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(projects))
}

export function formatProjectDate(value: string): string {
  const date = new Date(value)
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
