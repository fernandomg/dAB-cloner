import process from 'node:process'
import type {
  FeatureDefinition,
  FeatureName,
  InstallationType,
  Stack,
  StackConfig,
} from '../types/types.js'
import { canton } from './canton.js'
import { evm } from './evm.js'

export const stackDefinitions = { evm, canton } satisfies Record<Stack, StackConfig>

export const stackNames = Object.keys(stackDefinitions) as Stack[]

function envOverride(stack: Stack, suffix: 'REPO_URL' | 'REF'): string | undefined {
  const key = `DAPPBOOSTER_${stack.toUpperCase()}_${suffix}`
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

export function getStackConfig(stack: Stack): StackConfig {
  const base: StackConfig = stackDefinitions[stack]
  const repoUrl = envOverride(stack, 'REPO_URL') ?? base.repoUrl
  const ref = envOverride(stack, 'REF') ?? base.ref
  return { ...base, repoUrl, ref }
}

/** A stack's feature map as entries. The keys are feature names by construction. */
export function getFeatureEntries(stack: Stack): Array<[FeatureName, FeatureDefinition]> {
  return Object.entries(stackDefinitions[stack].features) as Array<[FeatureName, FeatureDefinition]>
}

export function getFeatureNames(stack: Stack): FeatureName[] {
  return getFeatureEntries(stack).map(([name]) => name)
}

export function isFeatureNameValid(stack: Stack, name: string): name is FeatureName {
  return name in stackDefinitions[stack].features
}

export function isStackName(name: string): name is Stack {
  return (stackNames as string[]).includes(name)
}

export function getDefaultFeatureNames(stack: Stack): FeatureName[] {
  return getFeatureEntries(stack)
    .filter(([, definition]) => definition.default)
    .map(([name]) => name)
}

/**
 * Installation modes a stack offers. A stack with no features offers none: there is nothing to
 * choose, so the wizard skips both questions and the CLI rejects `--mode` and `--features`.
 * `default` (keep only the `default: true` features) needs at least one opt-out feature, or it
 * would be identical to `full`.
 */
export function getInstallationModes(stack: Stack): InstallationType[] {
  const featureNames = getFeatureNames(stack)

  if (featureNames.length === 0) {
    return []
  }

  const hasOptOutFeature = getDefaultFeatureNames(stack).length < featureNames.length
  return hasOptOutFeature ? ['default', 'full', 'custom'] : ['full', 'custom']
}
