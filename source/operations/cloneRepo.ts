import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { getStackConfig } from '../stacks/index.js'
import type { Stack } from '../types/types.js'
import { getProjectFolder, meetsNodeVersion } from '../utils/utils.js'
import { exec, execFile } from './exec.js'

/**
 * Clones the stack's repository into `projectName`, then hands the user a fresh repository: the
 * template's `.git` goes and `git init` runs in its place. A stack is cloned at its newest tag
 * unless `ref` names one, which today only `DAPPBOOSTER_<STACK>_REF` does. Picking the newest tag
 * is the one place a shell is used, because it needs `$()` command substitution.
 */
export async function cloneRepo(
  stack: Stack,
  projectName: string,
  onProgress?: (step: string) => void,
): Promise<void> {
  const config = getStackConfig(stack)
  const projectFolder = getProjectFolder(projectName)

  if (config.minNodeVersion && !meetsNodeVersion(config.minNodeVersion)) {
    throw new Error(
      `The ${config.label} stack needs Node ${config.minNodeVersion} or later. You are running ${process.versions.node}.`,
    )
  }

  // The installer runs this a few steps later. Checking now saves a clone that cannot be used.
  try {
    await execFile(config.packageManager, ['--version'])
  } catch {
    throw new Error(
      `${config.packageManager} was not found. Install it, then run the installer again.`,
    )
  }

  if (config.ref) {
    // Fetching the ref by name keeps the clone shallow. It works for a tag or a branch.
    onProgress?.(`Cloning ${config.label} (${config.ref}) in ${projectName}`)
    await execFile('git', ['clone', '--depth', '1', '--no-checkout', config.repoUrl, projectName])

    onProgress?.(`Checking out ${config.ref}`)
    await execFile('git', ['fetch', '--depth', '1', 'origin', config.ref], { cwd: projectFolder })
    await execFile('git', ['checkout', 'FETCH_HEAD'], { cwd: projectFolder })
  } else {
    onProgress?.(`Cloning ${config.label} in ${projectName}`)
    await execFile('git', ['clone', '--depth', '1', '--no-checkout', config.repoUrl, projectName])

    onProgress?.('Fetching tags')
    await execFile('git', ['fetch', '--tags'], { cwd: projectFolder })

    onProgress?.('Checking out latest tag')
    await exec('git checkout $(git describe --tags $(git rev-list --tags --max-count=1))', {
      cwd: projectFolder,
    })
  }

  onProgress?.('Removing .git folder')
  await rm(resolve(projectFolder, '.git'), { recursive: true, force: true })

  onProgress?.('Initializing Git repository')
  await execFile('git', ['init'], { cwd: projectFolder })
}
