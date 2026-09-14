import { describe, expect, it } from 'vitest'
import {
  getDefaultFeatureNames,
  getFeatureEntries,
  getFeatureNames,
  stackDefinitions,
  stackNames,
} from '../stacks/index.js'
import {
  applyFeatureToggle,
  deriveStepDisplay,
  describeInstallPlan,
  getPackagesToRemove,
  getPostInstallMessages,
  isFeatureSelected,
  isValidName,
  meetsNodeVersion,
  resolveModeFeatures,
  resolveSelectedFeatures,
} from '../utils/utils.js'

const evmFeatures = stackDefinitions.evm.features

describe('isValidName', () => {
  it('accepts alphanumeric names', () => {
    expect(isValidName('myApp')).toBe(true)
    expect(isValidName('app123')).toBe(true)
    expect(isValidName('MyDapp')).toBe(true)
  })

  it('accepts underscores', () => {
    expect(isValidName('my_app')).toBe(true)
    expect(isValidName('_leading')).toBe(true)
    expect(isValidName('trailing_')).toBe(true)
  })

  it('rejects spaces', () => {
    expect(isValidName('my app')).toBe(false)
  })

  it('accepts dashes, except to start', () => {
    expect(isValidName('my-app')).toBe(true)
    expect(isValidName('trailing-')).toBe(true)
    expect(isValidName('-leading')).toBe(false)
  })

  it('rejects a name git would read as an option', () => {
    expect(isValidName('--upload-pack=touch_pwned')).toBe(false)
    expect(isValidName('-rf')).toBe(false)
  })

  it('rejects dots', () => {
    expect(isValidName('my.app')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(isValidName('my@app')).toBe(false)
    expect(isValidName('my$app')).toBe(false)
    expect(isValidName('my;app')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidName('')).toBe(false)
  })
})

describe('isFeatureSelected', () => {
  it('returns true when feature is in the list', () => {
    expect(isFeatureSelected('demo', ['demo', 'subgraph'])).toBe(true)
  })

  it('returns false when feature is not in the list', () => {
    expect(isFeatureSelected('demo', ['subgraph', 'vocs'])).toBe(false)
  })

  it('returns false for empty list', () => {
    expect(isFeatureSelected('demo', [])).toBe(false)
  })
})

describe('getPackagesToRemove — evm', () => {
  it('returns empty when all features selected', () => {
    const allFeatures = getFeatureNames('evm')
    expect(getPackagesToRemove('evm', allFeatures)).toEqual([])
  })

  it('returns all packages when no features selected', () => {
    const result = getPackagesToRemove('evm', [])

    const allPackages = Object.values(evmFeatures).flatMap((def) => def.packages)
    expect(result).toEqual(allPackages)
  })

  it('returns packages only for deselected features', () => {
    const result = getPackagesToRemove('evm', ['demo', 'subgraph'])

    for (const pkg of evmFeatures.subgraph.packages) {
      expect(result).not.toContain(pkg)
    }
    for (const pkg of evmFeatures.typedoc.packages) {
      expect(result).toContain(pkg)
    }
  })

  it('handles demo (which has no packages) correctly', () => {
    const withDemo = getPackagesToRemove('evm', ['demo'])
    const withoutDemo = getPackagesToRemove('evm', [])
    expect(withDemo).toEqual(withoutDemo)
  })
})

describe('getPackagesToRemove — canton', () => {
  it('returns empty: the stack has no features, so nothing is optional', () => {
    expect(getPackagesToRemove('canton', [])).toEqual([])
  })
})

describe('meetsNodeVersion', () => {
  it('accepts the exact version', () => {
    expect(meetsNodeVersion('24.15.0', '24.15.0')).toBe(true)
  })

  it('accepts a newer minor or patch', () => {
    expect(meetsNodeVersion('24.15.0', '24.20.0')).toBe(true)
    expect(meetsNodeVersion('24.15.0', '24.15.3')).toBe(true)
  })

  it('accepts a newer major even with a lower minor', () => {
    expect(meetsNodeVersion('24.15.0', '25.0.0')).toBe(true)
  })

  it('rejects an older major, minor, or patch', () => {
    expect(meetsNodeVersion('24.15.0', '22.20.0')).toBe(false)
    expect(meetsNodeVersion('24.15.0', '24.14.9')).toBe(false)
    expect(meetsNodeVersion('24.15.1', '24.15.0')).toBe(false)
  })
})

describe('getPostInstallMessages', () => {
  it('returns every evm message for a scaffold that kept every feature', () => {
    const result = getPostInstallMessages('evm', getFeatureNames('evm'))

    const allMessages = getFeatureEntries('evm').flatMap(([, def]) => def.postInstall ?? [])
    expect(result).toEqual(allMessages)
  })

  it('returns only the kept features messages', () => {
    const result = getPostInstallMessages('evm', ['subgraph'])

    expect(result).toEqual(evmFeatures.subgraph.postInstall)
  })

  it('returns empty when the kept features carry no guidance', () => {
    const result = getPostInstallMessages('evm', ['demo'])

    expect(result).toEqual([])
  })

  it('returns empty when nothing was kept', () => {
    const result = getPostInstallMessages('evm', [])

    expect(result).toEqual([])
  })

  it('returns the canton stack-level guidance, which no feature adds to', () => {
    const result = getPostInstallMessages('canton', [])

    expect(result).toEqual(stackDefinitions.canton.postInstall)
  })
})

describe('resolveSelectedFeatures — evm (no requires)', () => {
  it('returns the selection unchanged, in config order', () => {
    expect(resolveSelectedFeatures('evm', ['subgraph', 'demo'])).toEqual(['demo', 'subgraph'])
  })
})

describe('describeInstallPlan', () => {
  it('returns one labelled setting per line, naming the mode as the selector did', () => {
    expect(describeInstallPlan('evm', 'my_app', 'full', [])).toEqual([
      { label: 'Stack', value: 'EVM' },
      { label: 'Project', value: 'my_app' },
      { label: 'Mode', value: 'Full' },
    ])
  })

  it('names the default mode as the selector did', () => {
    expect(describeInstallPlan('evm', 'my_app', 'default', [])).toEqual([
      { label: 'Stack', value: 'EVM' },
      { label: 'Project', value: 'my_app' },
      { label: 'Mode', value: 'Default (recommended)' },
    ])
  })

  it('lists the selected features for a custom-mode plan', () => {
    expect(describeInstallPlan('evm', 'my_app', 'custom', ['demo', 'subgraph'])).toEqual([
      { label: 'Stack', value: 'EVM' },
      { label: 'Project', value: 'my_app' },
      { label: 'Mode', value: 'Custom' },
      { label: 'Features', value: 'demo, subgraph' },
    ])
  })

  it('shows "none" when a custom plan selects no features', () => {
    expect(describeInstallPlan('evm', 'demo_app', 'custom', [])).toEqual([
      { label: 'Stack', value: 'EVM' },
      { label: 'Project', value: 'demo_app' },
      { label: 'Mode', value: 'Custom' },
      { label: 'Features', value: 'none' },
    ])
  })
})

describe('resolveModeFeatures', () => {
  it('returns all features for full mode', () => {
    expect(resolveModeFeatures('evm', 'full')).toEqual(getFeatureNames('evm'))
  })

  it('returns the default:true set for default mode', () => {
    expect(resolveModeFeatures('evm', 'default')).toEqual(getDefaultFeatureNames('evm'))
  })

  it('resolves requires for default mode too, not only for custom', () => {
    for (const stack of stackNames) {
      expect(resolveModeFeatures(stack, 'default')).toEqual(
        resolveSelectedFeatures(stack, getDefaultFeatureNames(stack)),
      )
    }
  })

  it('returns nothing for a stack with no features, whatever the mode', () => {
    expect(resolveModeFeatures('canton', 'full')).toEqual([])
    expect(resolveModeFeatures('canton', 'custom', [])).toEqual([])
  })
})

describe('applyFeatureToggle — evm (no dependencies)', () => {
  it('selecting a feature adds it in config order', () => {
    expect(applyFeatureToggle('evm', ['subgraph'], 'demo', 'select')).toEqual(['demo', 'subgraph'])
  })

  it('unselecting a feature removes only that feature', () => {
    expect(applyFeatureToggle('evm', ['demo', 'subgraph', 'vocs'], 'subgraph', 'unselect')).toEqual(
      ['demo', 'vocs'],
    )
  })
})

describe('deriveStepDisplay', () => {
  it('shows all steps as completed when done', () => {
    const result = deriveStepDisplay(['Step 1', 'Step 2', 'Step 3'], 'done')

    expect(result.completedSteps).toEqual(['Step 1', 'Step 2', 'Step 3'])
    expect(result.currentStep).toBeUndefined()
    expect(result.failedStep).toBeUndefined()
  })

  it('shows last step as current when running', () => {
    const result = deriveStepDisplay(['Step 1', 'Step 2', 'Step 3'], 'running')

    expect(result.completedSteps).toEqual(['Step 1', 'Step 2'])
    expect(result.currentStep).toBe('Step 3')
    expect(result.failedStep).toBeUndefined()
  })

  it('shows last step as failed when error', () => {
    const result = deriveStepDisplay(['Step 1', 'Step 2', 'Step 3'], 'error')

    expect(result.completedSteps).toEqual(['Step 1', 'Step 2'])
    expect(result.currentStep).toBeUndefined()
    expect(result.failedStep).toBe('Step 3')
  })

  it('handles empty steps on error', () => {
    const result = deriveStepDisplay([], 'error')

    expect(result.completedSteps).toEqual([])
    expect(result.currentStep).toBeUndefined()
    expect(result.failedStep).toBeUndefined()
  })

  it('handles single step running', () => {
    const result = deriveStepDisplay(['Step 1'], 'running')

    expect(result.completedSteps).toEqual([])
    expect(result.currentStep).toBe('Step 1')
    expect(result.failedStep).toBeUndefined()
  })

  it('handles single step error', () => {
    const result = deriveStepDisplay(['Step 1'], 'error')

    expect(result.completedSteps).toEqual([])
    expect(result.currentStep).toBeUndefined()
    expect(result.failedStep).toBe('Step 1')
  })
})
