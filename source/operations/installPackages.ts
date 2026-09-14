import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getStackConfig } from '../stacks/index.js'
import type { FeatureName, InstallationType, Stack } from '../types/types.js'
import { getPackagesToRemove } from '../utils/utils.js'
import { execFile } from './exec.js'

/** Whether the scaffolded project defines the named script. */
function hasScript(projectFolder: string, name: string): boolean {
  try {
    const packageJson = JSON.parse(readFileSync(resolve(projectFolder, 'package.json'), 'utf8'))
    return packageJson.scripts?.[name] !== undefined
  } catch {
    return false
  }
}

/**
 * Installs the project's dependencies, minus the packages of every feature the user left out.
 * Removing through the package manager keeps package.json and the lockfile in step.
 */
export async function installPackages(
  stack: Stack,
  projectFolder: string,
  mode: InstallationType,
  features: FeatureName[] = [],
  onProgress?: (step: string) => void,
): Promise<void> {
  const { packageManager } = getStackConfig(stack)
  const packagesToRemove = mode === 'full' ? [] : getPackagesToRemove(stack, features)

  onProgress?.('Installing packages')

  if (packagesToRemove.length === 0) {
    await execFile(packageManager, ['install'], { cwd: projectFolder })
    return
  }

  await execFile(packageManager, ['remove', ...packagesToRemove], { cwd: projectFolder })

  if (hasScript(projectFolder, 'postinstall')) {
    onProgress?.('Executing post-install scripts')
    await execFile(packageManager, ['run', 'postinstall'], { cwd: projectFolder })
  }
}
