import type { FC } from 'react'

export type Stack = 'evm' | 'canton'

export type PackageManager = 'pnpm'

/**
 * Every feature name the stacks define. Only the EVM stack has features; `stacks/evm.ts` fails to
 * compile if its feature map and this list disagree.
 */
export type FeatureName = 'demo' | 'subgraph' | 'typedoc' | 'vocs' | 'husky'

export type InstallationType = 'full' | 'default' | 'custom'

export type MultiSelectItem = { label: string; value: FeatureName }

export type InstallationSelectItem = { label: string; value: InstallationType }

/** One setting on the review step. The step prints the label and highlights the value. */
export type PlanSummaryItem = { label: string; value: string }

/**
 * A single optional feature of a stack.
 *
 * @property packages - Dependencies the package manager removes (`pnpm remove`) when the feature
 * is deselected, so package.json and the lockfile stay in step.
 * @property paths - Relative files and directories deleted when the feature is deselected.
 * Removed directories also drive script stripping in cleanupFiles.
 * @property scripts - package.json script names deleted when the feature is deselected.
 * @property requires - Other features this one depends on. Selecting it pulls these in;
 * deselecting one of these cascades this feature out. Resolved transitively (see utils.ts).
 */
export type FeatureDefinition = {
  description: string
  label: string
  packages: string[]
  default: boolean
  postInstall?: string[]
  paths?: string[]
  scripts?: string[]
  requires?: FeatureName[]
}

export type EnvFile = {
  from: string
  to: string
}

/** A labelled group of paths cleanup removes whatever the user picked. */
export type CleanupGroup = {
  label: string
  paths: string[]
}

/**
 * What every scaffold of a stack drops, whatever the user picked: paths the template keeps for
 * itself, and the package.json keys that point at them. Applied before the package manager runs,
 * so it resolves the pruned manifest once and the lockfile it writes needs no repair.
 */
export type PrepareStep = CleanupGroup & {
  scripts?: string[]
  devDependencies?: string[]
}

export type PostInstallProps = {
  projectName: string
  features: FeatureName[]
}

/**
 * A stack the installer can scaffold.
 *
 * @property ref - Tag or branch to clone. Left out, the stack is cloned at its newest tag. Today
 * only `DAPPBOOSTER_<STACK>_REF` sets it, for forks and pre-release testing.
 * @property minNodeVersion - Node the scaffolded project needs. Checked before cloning, so a too
 * old Node fails with a plain message instead of a confusing install error later.
 * @property postInstall - Guidance shown for every scaffold of this stack, in any mode.
 * @property postInstallComponent - Richer post-install screen for the wizard, as a function that
 * imports it. It stays a function so the terminal UI is only loaded by the wizard: `--info` and
 * the non-interactive path read this same config and must not pull Ink in. Stacks without one get
 * their `postInstall` lines printed.
 * @property staging - The template's staging directory, holding the replacement files a
 * deselected feature restores. Removed once cleanup is finished with it.
 * @property initialCommit - Whether to commit the finished scaffold as the project's baseline.
 */
export type StackConfig = {
  label: string
  description: string
  repoUrl: string
  ref?: string
  packageManager: PackageManager
  minNodeVersion?: string
  prepare?: PrepareStep
  postInstall?: string[]
  postInstallComponent?: () => Promise<{ default: FC<PostInstallProps> }>
  staging?: CleanupGroup
  initialCommit?: boolean
  envFiles: EnvFile[]
  features: Record<string, FeatureDefinition>
}
