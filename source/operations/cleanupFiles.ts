import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { getFeatureEntries, getStackConfig } from '../stacks/index.js'
import type { FeatureName, InstallationType, Stack } from '../types/types.js'
import { isFeatureSelected } from '../utils/utils.js'

const HOME_FOLDER = 'src/components/pageComponents/home'

type DependencyGroup = Record<string, unknown> | undefined

type PackageJson = {
  scripts?: Record<string, string | undefined>
  dependencies?: DependencyGroup
  devDependencies?: DependencyGroup
}

/**
 * What the deleted paths leave for the package.json pass to apply.
 *
 * @property removedDirs - Directories that were deleted. Scripts that run one of them go too.
 */
type CleanupPlan = {
  scripts: string[]
  devDependencies: string[]
  removedDirs: string[]
}

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
}

/** Removes the given paths and reports which of them were directories. */
async function removePaths(projectFolder: string, relativePaths: string[]): Promise<string[]> {
  const directories = relativePaths.filter((relativePath) =>
    isDirectory(resolve(projectFolder, relativePath)),
  )

  await Promise.all(
    relativePaths.map((relativePath) =>
      rm(resolve(projectFolder, relativePath), { recursive: true, force: true }),
    ),
  )

  return directories
}

/**
 * Deletes the files of every feature the user left out and adds what the package.json pass still
 * has to remove to `plan`. `full` mode keeps everything.
 */
async function removeDeselectedFeatures(
  stack: Stack,
  projectFolder: string,
  mode: InstallationType,
  features: FeatureName[],
  plan: CleanupPlan,
  onProgress?: (step: string) => void,
): Promise<void> {
  if (mode === 'full') {
    return
  }

  for (const [name, definition] of getFeatureEntries(stack)) {
    const { paths = [], scripts = [] } = definition

    if (isFeatureSelected(name, features) || (paths.length === 0 && scripts.length === 0)) {
      continue
    }

    onProgress?.(definition.label)
    plan.removedDirs.push(...(await removePaths(projectFolder, paths)))
    plan.scripts.push(...scripts)
  }
}

async function restoreFile(projectFolder: string, from: string, to: string): Promise<void> {
  const target = resolve(projectFolder, to)

  await mkdir(dirname(target), { recursive: true })
  await copyFile(resolve(projectFolder, from), target)
}

/**
 * Puts back the demo-free home page the template stages in its staging directory. Dropping `demo`
 * replaces the whole page; dropping only `subgraph` replaces the examples index that listed it.
 */
async function restoreStagedHomePage(
  projectFolder: string,
  features: FeatureName[],
): Promise<void> {
  if (!isFeatureSelected('demo', features)) {
    await restoreFile(projectFolder, '.install-files/home/index.tsx', `${HOME_FOLDER}/index.tsx`)
    return
  }

  if (!isFeatureSelected('subgraph', features)) {
    await removePaths(projectFolder, [
      `${HOME_FOLDER}/Examples/demos/subgraphs`,
      `${HOME_FOLDER}/Examples/index.tsx`,
    ])
    await restoreFile(
      projectFolder,
      '.install-files/home/Examples/index.tsx',
      `${HOME_FOLDER}/Examples/index.tsx`,
    )
  }
}

function removeKeys(block: Record<string, unknown> | undefined, keys: string[]): boolean {
  if (!block) {
    return false
  }

  let changed = false

  for (const key of keys) {
    if (key in block) {
      delete block[key]
      changed = true
    }
  }

  return changed
}

/**
 * Names the scripts that run a removed directory, so cleanup tracks the removal even when the
 * template renames its scripts.
 */
function scriptsRunningRemovedDirs(
  scripts: Record<string, string | undefined> | undefined,
  removedDirs: string[],
): string[] {
  if (!scripts) {
    return []
  }

  return Object.entries(scripts)
    .filter(([, command]) =>
      command
        ?.split(/\s+/)
        .some((token) => removedDirs.some((dir) => token === dir || token.startsWith(`${dir}/`))),
    )
    .map(([name]) => name)
}

/**
 * Applies the plan to the project's package.json in a single pass, writing only when something
 * changed. Feature dependencies are left to the package manager, which runs next; the prepare
 * step's dependencies go here instead, because the package manager must never see them.
 */
function patchPackageJson(projectFolder: string, plan: CleanupPlan): void {
  const { scripts, devDependencies, removedDirs } = plan

  if (scripts.length === 0 && devDependencies.length === 0 && removedDirs.length === 0) {
    return
  }

  const packageJsonPath = resolve(projectFolder, 'package.json')

  let packageJson: PackageJson

  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson
  } catch {
    return
  }

  const scriptsRemoved = removeKeys(packageJson.scripts, [
    ...scripts,
    ...scriptsRunningRemovedDirs(packageJson.scripts, removedDirs),
  ])

  const dependenciesRemoved = removeKeys(packageJson.devDependencies, devDependencies)

  if (scriptsRemoved || dependenciesRemoved) {
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
  }
}

/**
 * Removes what the template keeps for itself and what the chosen features leave out, then patches
 * the project's package.json to match. Runs before the install, so the package manager resolves
 * the pruned manifest once and the lockfile it writes needs no repair.
 */
export async function cleanupFiles(
  stack: Stack,
  projectFolder: string,
  mode: InstallationType,
  features: FeatureName[] = [],
  onProgress?: (step: string) => void,
): Promise<void> {
  const { prepare, staging } = getStackConfig(stack)

  const plan: CleanupPlan = {
    scripts: [...(prepare?.scripts ?? [])],
    devDependencies: [...(prepare?.devDependencies ?? [])],
    removedDirs: [],
  }

  if (prepare) {
    onProgress?.(prepare.label)
    plan.removedDirs.push(...(await removePaths(projectFolder, prepare.paths)))
  }

  await removeDeselectedFeatures(stack, projectFolder, mode, features, plan, onProgress)

  // The staged replacements only exist in stacks that ship a staging directory.
  if (staging && mode !== 'full') {
    await restoreStagedHomePage(projectFolder, features)
  }

  patchPackageJson(projectFolder, plan)

  if (staging) {
    onProgress?.(staging.label)
    await removePaths(projectFolder, staging.paths)
  }
}
