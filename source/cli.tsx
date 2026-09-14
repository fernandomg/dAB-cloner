#!/usr/bin/env node
import process from 'node:process'
import meow from 'meow'
import { getInfoOutput } from './info.js'
import { ReportedError, reportFailure, runNonInteractive } from './nonInteractive.js'
import { isStackName, stackNames } from './stacks/index.js'
import type { Stack } from './types/types.js'

const cli = meow(
  `
  Usage
    $ dappbooster [options]

  Stack selection (mutually exclusive)
    --canton                 Use the Canton stack (Daml ledger, off-chain services)
    --evm                    Use the EVM stack (Ethereum, Polygon, Base, …) [default]
    --stack <evm|canton>     Explicit stack name (alternative to --canton/--evm)

  Common options
    --name <string>          Project name (alphanumeric, underscores, dashes)
    --mode <full|custom>     Installation mode (EVM only; Canton takes neither
                             --mode nor --features)
    --features <list>        Comma-separated features (with --mode=custom)
                               EVM:
                                 demo       Component demos and example pages
                                 subgraph   TheGraph subgraph integration
                                 typedoc    TypeDoc API documentation
                                 vocs       Vocs documentation site
                                 husky      Git hooks (Husky, lint-staged, commitlint)
    --non-interactive, --ni  Run without prompts (auto-enabled when not a TTY)
    --info                   Output feature metadata as JSON (filter with --stack)
    --help                   Show this help
    --version                Show version

  Non-interactive mode
    Requires --name, and --mode for a stack that has features.
    Outputs JSON to stdout. Activates automatically when stdout is not a TTY.
    Use --ni to force non-interactive mode in a TTY environment.

    AI agents: non-interactive mode activates automatically. Run --info
    to discover available stacks and features (including each feature's
    "requires"), then pass --canton or --evm plus --name, and --mode when
    the stack lists modes. Feature dependencies are resolved automatically,
    so the returned "features" list may include extras pulled in by your
    selection. Output is JSON for easy parsing.

  Examples
    Interactive (prompts for stack and options):
      $ dappbooster

    Canton stack (non-interactive):
      $ dappbooster --canton --ni --name my_dapp

    EVM stack, custom install:
      $ dappbooster --evm --ni --name my_dapp --mode custom --features demo,subgraph

    Discover canton features:
      $ dappbooster --info --stack canton
`,
  {
    importMeta: import.meta,
    flags: {
      stack: {
        type: 'string',
      },
      canton: {
        type: 'boolean',
        default: false,
      },
      evm: {
        type: 'boolean',
        default: false,
      },
      name: {
        type: 'string',
      },
      mode: {
        type: 'string',
      },
      features: {
        type: 'string',
      },
      nonInteractive: {
        type: 'boolean',
        default: false,
      },
      ni: {
        type: 'boolean',
        default: false,
      },
      info: {
        type: 'boolean',
        default: false,
      },
    },
  },
)

/** Either the stack the flags name, no stack at all, or the reason the flags make no sense. */
type StackFlagResult = { stack?: Stack; error?: string }

function resolveStackFlag(flags: {
  stack?: string
  canton: boolean
  evm: boolean
}): StackFlagResult {
  const explicit: string[] = []
  if (flags.canton) {
    explicit.push('canton')
  }
  if (flags.evm) {
    explicit.push('evm')
  }
  if (flags.stack) {
    explicit.push(flags.stack)
  }

  const unique = Array.from(new Set(explicit))

  if (unique.length > 1) {
    return {
      error: `Conflicting stack flags: ${unique.join(', ')}. Pick exactly one of --canton, --evm, or --stack.`,
    }
  }

  const candidate = unique[0]
  if (candidate === undefined) {
    return {}
  }

  if (!isStackName(candidate)) {
    return { error: `Invalid stack: '${candidate}'. Valid stacks: ${stackNames.join(', ')}` }
  }

  return { stack: candidate }
}

const { stack: resolvedStack, error: stackFlagError } = resolveStackFlag(cli.flags)

if (stackFlagError) {
  reportFailure(stackFlagError)
} else if (cli.flags.info) {
  console.log(getInfoOutput(resolvedStack))
} else if (cli.flags.nonInteractive || cli.flags.ni || !process.stdout.isTTY) {
  runNonInteractive({
    stack: resolvedStack,
    name: cli.flags.name,
    mode: cli.flags.mode,
    features: cli.flags.features,
  }).catch((error: unknown) => {
    if (error instanceof ReportedError) {
      return
    }
    reportFailure(error instanceof Error ? error.message : String(error))
  })
} else {
  const run = async () => {
    console.clear()
    const { render } = await import('ink')
    const { default: App } = await import('./app.js')

    render(<App preselectedStack={resolvedStack} />)
  }

  run().catch(console.error)
}
