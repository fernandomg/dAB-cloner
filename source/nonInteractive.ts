import process from 'node:process'
import {
  cleanupFiles,
  cloneRepo,
  createEnvFile,
  createInitialCommit,
  installPackages,
} from './operations/index.js'
import { beginInstall, completeInstall } from './operations/installGuard.js'
import {
  getFeatureNames,
  getInstallationModes,
  getStackConfig,
  isFeatureNameValid,
  isStackName,
  stackNames,
} from './stacks/index.js'
import type { FeatureName, InstallationType, Stack } from './types/types.js'
import {
  getPostInstallMessages,
  getProjectFolder,
  isValidName,
  projectDirectoryExists,
  resolveModeFeatures,
} from './utils/utils.js'

type SuccessResult = {
  success: true
  stack: Stack
  projectName: string
  mode: InstallationType
  features: FeatureName[]
  path: string
  postInstall: string[]
}

/** An error already written to stdout as JSON, so the caller must not report it a second time. */
export class ReportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportedError'
  }
}

/** Writes the failure envelope agents and CI parse, then stops the run. */
export function reportFailure(error: string): ReportedError {
  console.log(JSON.stringify({ success: false, error }, null, 2))
  process.exitCode = 1
  return new ReportedError(error)
}

function fail(error: string): never {
  throw reportFailure(error)
}

function parseFeatures(featuresFlag: string | undefined): string[] {
  if (!featuresFlag) {
    return []
  }

  const seen = new Set<string>()

  return featuresFlag
    .split(',')
    .map((f) => f.trim())
    .filter((f) => {
      if (f === '' || seen.has(f)) {
        return false
      }

      seen.add(f)
      return true
    })
}

/** The mode and features the flags ask for, once the stack is known to be valid. */
function resolveModeAndFeatures(
  stack: Stack,
  flags: { mode?: string; features?: string },
): { mode: InstallationType; features: FeatureName[] } {
  const modes = getInstallationModes(stack)

  // A stack with no features has nothing to choose, so both flags are a mistake worth naming.
  if (modes.length === 0) {
    for (const flag of ['mode', 'features'] as const) {
      if (flags[flag]) {
        fail(`The ${stack} stack has no optional features, so --${flag} is not accepted`)
      }
    }

    return { mode: 'full', features: [] }
  }

  if (!flags.mode) {
    fail('Missing required flag: --mode')
  }

  if (flags.mode !== 'full' && flags.mode !== 'default' && flags.mode !== 'custom') {
    fail("Invalid mode: must be 'full', 'default', or 'custom'")
  }

  if (!modes.includes(flags.mode)) {
    fail(
      `Invalid mode: '${flags.mode}' is not available for the ${stack} stack. Valid modes: ${modes.join(', ')}`,
    )
  }

  if (flags.mode !== 'custom') {
    return { mode: flags.mode, features: resolveModeFeatures(stack, flags.mode) }
  }

  if (!flags.features) {
    fail('--mode custom requires --features. Use --info to see available features.')
  }

  const requested = parseFeatures(flags.features)

  if (requested.length === 0) {
    fail('--features value is empty. Use --info to see available features.')
  }

  const features: FeatureName[] = []
  const invalidFeatures: string[] = []

  for (const name of requested) {
    if (isFeatureNameValid(stack, name)) {
      features.push(name)
    } else {
      invalidFeatures.push(name)
    }
  }

  if (invalidFeatures.length > 0) {
    const validNames = getFeatureNames(stack).join(', ')
    fail(
      `Unknown features for stack '${stack}': ${invalidFeatures.join(', ')}. Valid features: ${validNames}`,
    )
  }

  return { mode: 'custom', features: resolveModeFeatures(stack, 'custom', features) }
}

function validate(flags: { stack?: string; name?: string; mode?: string; features?: string }): {
  stack: Stack
  name: string
  mode: InstallationType
  features: FeatureName[]
} {
  const stackFlag = flags.stack ?? 'evm'

  if (!isStackName(stackFlag)) {
    fail(`Invalid stack: '${stackFlag}'. Valid stacks: ${stackNames.join(', ')}`)
  }

  const stack = stackFlag

  if (!flags.name) {
    fail('Missing required flag: --name')
  }

  if (!isValidName(flags.name)) {
    fail(
      'Invalid project name: only letters, numbers, underscores and non-initial dashes are allowed',
    )
  }

  const { mode, features } = resolveModeAndFeatures(stack, flags)

  if (projectDirectoryExists(flags.name)) {
    fail(`Project directory '${flags.name}' already exists`)
  }

  return { stack, name: flags.name, mode, features }
}

export async function runNonInteractive(flags: {
  stack?: string
  name?: string
  mode?: string
  features?: string
}): Promise<void> {
  const { stack, name, mode, features } = validate(flags)

  const projectFolder = getProjectFolder(name)

  try {
    beginInstall(projectFolder)

    await cloneRepo(stack, name)
    await cleanupFiles(stack, projectFolder, mode, features)
    await createEnvFile(stack, projectFolder)
    await installPackages(stack, projectFolder, mode, features)

    if (getStackConfig(stack).initialCommit) {
      await createInitialCommit(projectFolder)
    }

    completeInstall()

    const result: SuccessResult = {
      success: true,
      stack,
      projectName: name,
      mode,
      features,
      path: projectFolder,
      postInstall: getPostInstallMessages(stack, features),
    }

    console.log(JSON.stringify(result, null, 2))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    fail(message)
  }
}
