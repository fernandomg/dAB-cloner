import { describe, expect, it } from 'vitest'
import { getInfoOutput } from '../info.js'
import {
  getFeatureEntries,
  getInstallationModes,
  stackDefinitions,
  stackNames,
} from '../stacks/index.js'

describe('getInfoOutput — no filter', () => {
  it('returns valid JSON', () => {
    expect(() => JSON.parse(getInfoOutput())).not.toThrow()
  })

  it('has stacks and modes top-level keys', () => {
    const output = JSON.parse(getInfoOutput())
    expect(output).toHaveProperty('stacks')
    expect(output).toHaveProperty('modes')
  })

  it('includes every defined stack', () => {
    const output = JSON.parse(getInfoOutput())
    expect(Object.keys(output.stacks)).toEqual(stackNames)
  })

  it('each stack lists its features', () => {
    const output = JSON.parse(getInfoOutput())

    for (const stack of stackNames) {
      const expected = Object.keys(stackDefinitions[stack].features)
      expect(Object.keys(output.stacks[stack].features)).toEqual(expected)
    }
  })

  it('each stack reports its package manager and label', () => {
    const output = JSON.parse(getInfoOutput())

    for (const stack of stackNames) {
      expect(output.stacks[stack].label).toBe(stackDefinitions[stack].label)
      expect(output.stacks[stack].packageManager).toBe(stackDefinitions[stack].packageManager)
    }
  })

  it('each feature has description and default', () => {
    const output = JSON.parse(getInfoOutput())

    for (const stack of stackNames) {
      for (const name of Object.keys(stackDefinitions[stack].features)) {
        const feature = output.stacks[stack].features[name]
        expect(feature).toHaveProperty('description')
        expect(feature).toHaveProperty('default')
        expect(typeof feature.description).toBe('string')
        expect(typeof feature.default).toBe('boolean')
      }
    }
  })

  it('includes postInstall only for features that declare it', () => {
    const output = JSON.parse(getInfoOutput())

    for (const stack of stackNames) {
      for (const [name, def] of getFeatureEntries(stack)) {
        const feature = output.stacks[stack].features[name]
        if (def.postInstall) {
          expect(feature.postInstall).toEqual(def.postInstall)
        } else {
          expect(feature).not.toHaveProperty('postInstall')
        }
      }
    }
  })

  it('surfaces requires only for features that declare a dependency', () => {
    const output = JSON.parse(getInfoOutput())

    for (const stack of stackNames) {
      for (const [name, def] of getFeatureEntries(stack)) {
        const feature = output.stacks[stack].features[name]
        if (def.requires) {
          expect(feature.requires).toEqual(def.requires)
        } else {
          expect(feature).not.toHaveProperty('requires')
        }
      }
    }
  })

  it('does not leak label, packages, or paths into feature output', () => {
    const output = JSON.parse(getInfoOutput())

    for (const stack of stackNames) {
      for (const name of Object.keys(stackDefinitions[stack].features)) {
        const feature = output.stacks[stack].features[name]
        expect(feature).not.toHaveProperty('label')
        expect(feature).not.toHaveProperty('packages')
        expect(feature).not.toHaveProperty('paths')
      }
    }
  })

  it('modes contains full and custom', () => {
    const output = JSON.parse(getInfoOutput())
    expect(output.modes).toHaveProperty('full')
    expect(output.modes).toHaveProperty('custom')
  })

  it('modes documents the default mode', () => {
    const output = JSON.parse(getInfoOutput())
    expect(output.modes).toHaveProperty('default')
  })

  it('lists the modes each stack accepts, so agents never send a rejected one', () => {
    const output = JSON.parse(getInfoOutput())

    for (const stack of stackNames) {
      expect(output.stacks[stack].modes).toEqual(getInstallationModes(stack))
    }

    expect(output.stacks.evm.modes).not.toContain('default')
  })

  it('reports canton as a stack with no features and no modes', () => {
    const output = JSON.parse(getInfoOutput())

    expect(output.stacks.canton.features).toEqual({})
    expect(output.stacks.canton.modes).toEqual([])
  })
})

describe('getInfoOutput — filter by stack', () => {
  it('returns only the requested stack', () => {
    const output = JSON.parse(getInfoOutput('canton'))
    expect(Object.keys(output.stacks)).toEqual(['canton'])
  })

  it('throws on unknown stack filter', () => {
    expect(() => getInfoOutput('does-not-exist')).toThrow(/Unknown stack 'does-not-exist'/)
  })

  it('filtering by evm hides canton', () => {
    const output = JSON.parse(getInfoOutput('evm'))
    expect(Object.keys(output.stacks)).toEqual(['evm'])
  })
})
