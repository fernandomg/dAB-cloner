import {
  getFeatureEntries,
  getInstallationModes,
  stackDefinitions,
  stackNames,
} from './stacks/index.js'
import type { InstallationType, Stack } from './types/types.js'

type FeatureInfo = {
  description: string
  default: boolean
  postInstall?: string[]
  requires?: string[]
}

type StackInfo = {
  label: string
  description: string
  packageManager: string
  modes: InstallationType[]
  features: Record<string, FeatureInfo>
}

function buildStackInfo(stack: Stack): StackInfo {
  const config = stackDefinitions[stack]

  return {
    label: config.label,
    description: config.description,
    packageManager: config.packageManager,
    modes: getInstallationModes(stack),
    features: Object.fromEntries(
      getFeatureEntries(stack).map(([name, definition]) => [
        name,
        {
          description: definition.description,
          default: definition.default,
          ...(definition.postInstall ? { postInstall: definition.postInstall } : {}),
          ...(definition.requires ? { requires: definition.requires } : {}),
        },
      ]),
    ),
  }
}

export class InvalidStackFilterError extends Error {
  constructor(filter: string) {
    super(`Unknown stack '${filter}'. Valid stacks: ${stackNames.join(', ')}`)
    this.name = 'InvalidStackFilterError'
  }
}

export function getInfoOutput(stackFilter?: string): string {
  if (stackFilter !== undefined && !(stackNames as string[]).includes(stackFilter)) {
    throw new InvalidStackFilterError(stackFilter)
  }

  const stacks: Record<string, StackInfo> = {}

  for (const name of stackNames) {
    if (stackFilter !== undefined && stackFilter !== name) {
      continue
    }
    stacks[name] = buildStackInfo(name)
  }

  return JSON.stringify(
    {
      stacks,
      modes: {
        full: 'Install all features',
        default:
          'Install the recommended set. Only for stacks that list it in their own "modes" — every other stack rejects it',
        custom: 'Choose features individually',
      },
      notes:
        'A stack whose "modes" list is empty has no optional features. Send neither --mode nor --features',
    },
    null,
    2,
  )
}
