import type { FeatureDefinition, FeatureName, StackConfig } from '../types/types.js'

export const evm = {
  label: 'EVM',
  description: 'dAppBooster for EVM chains (Ethereum, Polygon, Base, …)',
  repoUrl: 'https://github.com/BootNodeDev/dAppBooster.git',
  packageManager: 'pnpm',
  prepare: {
    label: 'Repository metadata',
    paths: ['.claude', 'AGENTS.md', 'CLAUDE.md', 'architecture.md', '.github'],
  },
  staging: {
    label: 'Install script',
    paths: ['.install-files'],
  },
  postInstallComponent: () => import('../components/steps/EvmPostInstall.js'),
  envFiles: [{ from: '.env.example', to: '.env.local' }],
  features: {
    demo: {
      description: 'Component demos and example pages',
      label: 'Component Demos',
      packages: [],
      default: true,
      paths: ['src/components/pageComponents/home'],
    },
    subgraph: {
      description: 'TheGraph subgraph integration',
      label: 'Subgraph support',
      packages: [
        '@bootnodedev/db-subgraph',
        'graphql',
        'graphql-request',
        '@graphql-codegen/cli',
        '@graphql-typed-document-node/core',
      ],
      default: true,
      paths: ['src/subgraphs'],
      scripts: ['subgraph-codegen'],
      postInstall: [
        'Provide your own API key for PUBLIC_SUBGRAPHS_API_KEY in .env.local',
        'Run pnpm subgraph-codegen from the project folder',
      ],
    },
    typedoc: {
      description: 'TypeDoc API documentation generation',
      label: 'Typedoc documentation support',
      packages: [
        'typedoc',
        'typedoc-github-theme',
        'typedoc-plugin-inline-sources',
        'typedoc-plugin-missing-exports',
        'typedoc-plugin-rename-defaults',
      ],
      default: true,
      paths: ['typedoc.json'],
      scripts: ['typedoc:build'],
    },
    vocs: {
      description: 'Vocs documentation site',
      label: 'Vocs documentation support',
      packages: ['vocs'],
      default: true,
      paths: ['vocs.config.ts', 'docs'],
      scripts: ['docs:build', 'docs:dev', 'docs:preview'],
    },
    husky: {
      description: 'Git hooks with Husky, lint-staged, and commitlint',
      label: 'Husky Git hooks support',
      packages: ['husky', 'lint-staged', '@commitlint/cli', '@commitlint/config-conventional'],
      default: true,
      paths: ['.husky', '.lintstagedrc.mjs', 'commitlint.config.js'],
      scripts: ['prepare', 'commitlint', 'commitlint:check', 'commitlint:ci'],
    },
  },
} satisfies StackConfig & { features: Record<FeatureName, FeatureDefinition> }
