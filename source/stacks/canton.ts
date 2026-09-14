import type { StackConfig } from '../types/types.js'

/**
 * Scaffolding Canton is deletion. The template's three libraries are on npm as
 * `@bootnodedev/canton-connect`, `@bootnodedev/canton-dappbooster` and `@bootnodedev/canton-theme`;
 * pnpm links the local folder only while its own version satisfies the declared range, so deleting
 * the folders makes the same package.json resolve from the registry. No manifest rewrite, no
 * workspace file edit.
 */
export const canton = {
  label: 'Canton',
  description: 'dAppBooster for Canton (Daml ledger, off-chain services)',
  repoUrl: 'https://github.com/BootNodeDev/canton-dappbooster.git',
  packageManager: 'pnpm',
  minNodeVersion: '24.15.0',
  initialCommit: true,
  prepare: {
    label: 'Removing the template libraries and tooling',
    paths: [
      '.claude',
      '.github',
      'canton-connect',
      'canton-dappbooster',
      'canton-theme',
      'kit',
      'AGENTS.md',
      'CLAUDE.md',
      'architecture.md',
      'renovate.json',
      'vercel.json',
      'dapp/frontend/AGENTS.md',
      'dapp/frontend/CLAUDE.md',
      'dapp/frontend/architecture.md',
      'dapp/frontend/PROVENANCE.md',
      'dapp/daml/PROVENANCE.md',
      'pnpm-lock.yaml',
    ],
    // Scripts that run kit/ go when the folder goes. These two only name the libraries in a
    // filter argument, so nothing links them to a deleted path.
    scripts: ['release', 'release:dry'],
    devDependencies: ['typedoc', 'postcss', '@mermaid-js/mermaid-cli'],
  },
  postInstallComponent: () => import('../components/steps/CantonPostInstall.js'),
  postInstall: [
    'Run every command below from the folder reported in "path"',
    'Docker must be running. On macOS "./scripts/dev-stack.sh docker-up" starts Docker Desktop and waits for it',
    'The DAML SDK must be installed ("dpm" on PATH)',
    'Start the stack with "./scripts/dev-stack.sh up". The script with no argument opens an arrow-key menu and fails without a terminal',
    '"up" prints each step as it runs and fails on its own. The first run pulls about 10 GB, so do not kill it for being slow',
    'Check it with "./scripts/dev-stack.sh status" and stop it with "./scripts/dev-stack.sh down"',
    'The dApp needs a CIP-0103 browser wallet, which runs outside the project: https://github.com/BootNodeDev/carpincho-wallet',
    'Read README.md for how to connect it',
  ],
  envFiles: [{ from: '.env.example', to: '.env' }],
  features: {},
} satisfies StackConfig
