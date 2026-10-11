import { describe, expect, it } from 'vitest'
import curriculum from '../../../../content/curriculum.json'
import { MODULES_WITH_ART } from './ModuleArt'

describe('ModuleArt', () => {
  it('has a topic drawing for every module in the curriculum', () => {
    const modules = curriculum.levels.flatMap((l) => l.modules.map((m) => m.slug))
    expect(modules.filter((m) => !MODULES_WITH_ART.includes(m))).toEqual([])
  })
})
