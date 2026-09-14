import { describe, expect, it } from 'vitest'
import {
  getDefaultFeatureNames,
  getFeatureNames,
  getInstallationModes,
  stackDefinitions,
} from '../stacks/index.js'

describe('getDefaultFeatureNames', () => {
  it('returns only features whose default flag is true, in config order', () => {
    for (const stack of ['evm', 'canton'] as const) {
      const expected = Object.entries(stackDefinitions[stack].features)
        .filter(([, def]) => def.default)
        .map(([name]) => name)
      expect(getDefaultFeatureNames(stack)).toEqual(expected)
    }
  })

  it('is a subset of all feature names', () => {
    const all = new Set(getFeatureNames('evm'))
    for (const name of getDefaultFeatureNames('evm')) {
      expect(all.has(name)).toBe(true)
    }
  })
})

describe('getInstallationModes', () => {
  it('offers full/custom for evm, where every feature is on by default', () => {
    expect(getInstallationModes('evm')).toEqual(['full', 'custom'])
  })

  it('offers none for canton, which has no features to choose', () => {
    expect(getInstallationModes('canton')).toEqual([])
  })
})

describe('canton stack config', () => {
  it('clones canton-dappbooster at its latest tag with pnpm', () => {
    expect(stackDefinitions.canton.repoUrl).toBe(
      'https://github.com/BootNodeDev/canton-dappbooster.git',
    )
    expect(stackDefinitions.canton).not.toHaveProperty('ref')
    expect(stackDefinitions.canton.packageManager).toBe('pnpm')
  })

  it('copies a single root env file', () => {
    expect(stackDefinitions.canton.envFiles).toEqual([{ from: '.env.example', to: '.env' }])
  })

  it('declares the Node floor the scaffolded project needs', () => {
    expect(stackDefinitions.canton.minNodeVersion).toBe('24.15.0')
  })

  it('deletes the three library folders, so pnpm resolves them from npm', () => {
    for (const library of ['canton-connect', 'canton-dappbooster', 'canton-theme']) {
      expect(stackDefinitions.canton.prepare.paths).toContain(library)
    }
  })
})
