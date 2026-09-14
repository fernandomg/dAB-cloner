import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import {
  getDefaultFeatureNames,
  getFeatureEntries,
  getFeatureNames,
  getStackConfig,
} from '../stacks/index.js'
import type { FeatureName, InstallationType, PlanSummaryItem, Stack } from '../types/types.js'

export function getProjectFolder(projectName: string) {
  return join(process.cwd(), projectName)
}

export function isValidName(name: string) {
  return /^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(name)
}

export function isAnswerConfirmed(answer?: string, errorMessage?: string): boolean {
  return (
    answer !== '' && answer !== undefined && (errorMessage === '' || errorMessage === undefined)
  )
}

export function canShowStep(currentStep: number, stepToShow: number) {
  return currentStep > stepToShow - 1
}

export function isFeatureSelected(feature: FeatureName, selectedFeatures: FeatureName[]): boolean {
  return selectedFeatures.includes(feature)
}

/** Whether the running Node is at least `required`, both written as dotted numbers. */
export function meetsNodeVersion(required: string, current = process.versions.node): boolean {
  const numbers = (version: string) => version.split('.').map((part) => Number.parseInt(part, 10))
  const wanted = numbers(required)
  const running = numbers(current)

  for (const [index, want] of wanted.entries()) {
    const have = running[index] ?? 0
    if (have !== want) {
      return have > want
    }
  }

  return true
}

type FeatureToggleAction = 'select' | 'unselect'

/** Walks a feature's `requires` chain, adding every transitive requirement to `accumulator`. */
function collectRequiredFeatures(
  stack: Stack,
  feature: FeatureName,
  accumulator: Set<FeatureName>,
): void {
  const definition = getStackConfig(stack).features[feature]
  if (!definition?.requires) {
    return
  }

  for (const required of definition.requires) {
    if (accumulator.has(required)) {
      continue
    }

    accumulator.add(required)
    collectRequiredFeatures(stack, required, accumulator)
  }
}

/** Features that depend on `target`, directly or through another one. They go when it goes. */
function getDependentFeatures(stack: Stack, target: FeatureName): Set<FeatureName> {
  const dependents = new Set<FeatureName>()

  for (const name of getFeatureNames(stack)) {
    const required = new Set<FeatureName>()
    collectRequiredFeatures(stack, name, required)
    if (required.has(target)) {
      dependents.add(name)
    }
  }

  return dependents
}

/** Expands a selection to include every transitive requirement, returned in config order. */
export function resolveSelectedFeatures(
  stack: Stack,
  selectedFeatures: FeatureName[],
): FeatureName[] {
  const resolved = new Set<FeatureName>(selectedFeatures)
  for (const feature of selectedFeatures) {
    collectRequiredFeatures(stack, feature, resolved)
  }

  return getFeatureNames(stack).filter((name) => resolved.has(name))
}

/**
 * Interactive toggle that keeps the selection consistent: selecting a feature pulls its
 * requirements in, unselecting one drops its dependents. Result is in config order.
 */
export function applyFeatureToggle(
  stack: Stack,
  selectedFeatures: FeatureName[],
  toggledFeature: FeatureName,
  action: FeatureToggleAction,
): FeatureName[] {
  if (action === 'select') {
    return resolveSelectedFeatures(stack, [...selectedFeatures, toggledFeature])
  }

  const toRemove = getDependentFeatures(stack, toggledFeature)
  toRemove.add(toggledFeature)

  return getFeatureNames(stack).filter(
    (name) => selectedFeatures.includes(name) && !toRemove.has(name),
  )
}

/** How each mode is named on screen, in the selector and in the review that follows it. */
export const MODE_LABELS: Record<InstallationType, string> = {
  default: 'Default (recommended)',
  full: 'Full',
  custom: 'Custom',
}

/**
 * The plan as one item per setting, shown on the confirmation step before any disk work begins.
 * Only stacks that ask a question reach that step.
 */
export function describeInstallPlan(
  stack: Stack,
  projectName: string,
  mode: InstallationType,
  selectedFeatures: FeatureName[],
): PlanSummaryItem[] {
  const items: PlanSummaryItem[] = [
    { label: 'Stack', value: getStackConfig(stack).label },
    { label: 'Project', value: projectName },
    { label: 'Mode', value: MODE_LABELS[mode] },
  ]

  if (mode !== 'custom') {
    return items
  }

  const features = selectedFeatures.length > 0 ? selectedFeatures.join(', ') : 'none'
  return [...items, { label: 'Features', value: features }]
}

export function getPackagesToRemove(stack: Stack, selectedFeatures: FeatureName[]): string[] {
  return getFeatureEntries(stack)
    .filter(([name]) => !selectedFeatures.includes(name))
    .flatMap(([, definition]) => definition.packages)
}

/** Post-install guidance for a scaffold: the stack's own, then that of each feature it kept. */
export function getPostInstallMessages(stack: Stack, features: FeatureName[]): string[] {
  const config = getStackConfig(stack)

  return [
    ...(config.postInstall ?? []),
    ...features.flatMap((name) => config.features[name]?.postInstall ?? []),
  ]
}

/**
 * The features a mode keeps: full → all of them, default → the ones on by default, custom → the
 * user's own selection. Both selections come back with their `requires` resolved. Shared by the
 * non-interactive path and the interactive steps.
 */
export function resolveModeFeatures(
  stack: Stack,
  mode: InstallationType,
  customSelection: FeatureName[] = [],
): FeatureName[] {
  if (mode === 'full') {
    return getFeatureNames(stack)
  }

  if (mode === 'default') {
    return resolveSelectedFeatures(stack, getDefaultFeatureNames(stack))
  }

  return resolveSelectedFeatures(stack, customSelection)
}

export function projectDirectoryExists(projectName: string): boolean {
  return existsSync(getProjectFolder(projectName))
}

type StepStatus = 'running' | 'done' | 'error'

type StepDisplay = {
  completedSteps: string[]
  currentStep: string | undefined
  failedStep: string | undefined
}

export function deriveStepDisplay(steps: string[], status: StepStatus): StepDisplay {
  return {
    completedSteps: status === 'done' ? steps : steps.slice(0, -1),
    currentStep: status === 'running' ? steps.at(-1) : undefined,
    failedStep: status === 'error' ? steps.at(-1) : undefined,
  }
}
