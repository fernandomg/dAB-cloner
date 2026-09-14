import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureNames, stackDefinitions } from '../../stacks/index.js'

vi.mock('node:fs/promises', () => ({
  rm: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../operations/exec.js', () => ({
  execFile: vi.fn().mockResolvedValue(undefined),
}))

/**
 * Directories in the two templates. Everything else the installer removes is a file, and only
 * removed directories drive script stripping.
 */
const TEMPLATE_DIRECTORIES = [
  '.claude',
  '.github',
  '.husky',
  '.install-files',
  'docs',
  'src/subgraphs',
  'src/components/pageComponents/home',
  'canton-connect',
  'canton-dappbooster',
  'canton-theme',
  'kit',
]

function isTemplateDirectory(target: string): boolean {
  return TEMPLATE_DIRECTORIES.some((dir) => target.endsWith(`/${dir}`))
}

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn((target: string) => ({ isDirectory: () => isTemplateDirectory(target) })),
}))

const { rm, mkdir, copyFile } = await import('node:fs/promises')
const { readFileSync, writeFileSync } = await import('node:fs')
const { execFile } = await import('../../operations/exec.js')
const { cleanupFiles } = await import('../../operations/cleanupFiles.js')

function getRmPaths(): string[] {
  return vi.mocked(rm).mock.calls.map((call) => call[0] as string)
}

function getMkdirPaths(): string[] {
  return vi.mocked(mkdir).mock.calls.map((call) => call[0] as string)
}

function getCopyFileCalls(): Array<{ src: string; dst: string }> {
  return vi.mocked(copyFile).mock.calls.map((call) => ({
    src: call[0] as string,
    dst: call[1] as string,
  }))
}

function getWrittenPackageJson(): Record<string, unknown> {
  const lastCall = vi.mocked(writeFileSync).mock.calls.at(-1)
  if (!lastCall) {
    throw new Error('writeFileSync was never called — no package.json to read')
  }
  return JSON.parse(lastCall[1] as string)
}

const ALL_EVM_FEATURES = getFeatureNames('evm')

const EVM_DEV_DEPS = {
  husky: '^9.1.7',
  'lint-staged': '^17.0.4',
  '@commitlint/cli': '^21.0.1',
  '@commitlint/config-conventional': '^21.0.1',
  vocs: '^1.0.0',
}

function mockEvmPackageJson() {
  vi.mocked(readFileSync).mockReturnValue(
    JSON.stringify({
      scripts: {
        dev: 'next dev',
        build: 'next build',
        'subgraph-codegen': 'graphql-codegen',
        'typedoc:build': 'typedoc',
        'docs:build': 'vocs build',
        'docs:dev': 'vocs dev',
        'docs:preview': 'vocs preview',
        prepare: 'husky install',
        commitlint: 'commitlint --edit',
      },
      devDependencies: EVM_DEV_DEPS,
    }),
  )
}

/** Mirrors the root package.json of the canton-dappbooster tag the installer clones. */
const CANTON_SCRIPTS = {
  'app:dev': 'pnpm -C dapp/frontend run dev',
  build: 'pnpm -r run --if-present build',
  'check:anatomy': 'node kit/check-anatomy.mjs',
  'check:versions': 'node kit/check-versions.mjs',
  'docs:build': 'typedoc --options kit/typedoc.json',
  'docs:check': 'typedoc --options kit/typedoc.json --emit none && node kit/docs-check.mjs',
  knip: 'knip',
  lint: 'biome check --error-on-warnings',
  prepare: 'husky',
  release: "pnpm -r --filter './canton-*' publish --no-git-checks",
  'release:dry': "pnpm -r --filter './canton-*' publish --dry-run --no-git-checks",
  'release:version': 'node kit/release-version.mjs',
  test: 'pnpm -r run --if-present test',
  typecheck: 'pnpm -r run --if-present typecheck',
}

const CANTON_DEV_DEPS = {
  '@biomejs/biome': '2.5.11',
  '@mermaid-js/mermaid-cli': '^11.15.0',
  husky: '^9.1.7',
  knip: '6.33.0',
  'lint-staged': '^17.0.4',
  postcss: '^8.5.26',
  typedoc: '^0.28.20',
  typescript: '^5.9.3',
}

function mockCantonPackageJson() {
  vi.mocked(readFileSync).mockReturnValue(
    JSON.stringify({ scripts: CANTON_SCRIPTS, devDependencies: CANTON_DEV_DEPS }),
  )
}

describe('cleanupFiles — evm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEvmPackageJson()
  })

  describe('full mode', () => {
    it('removes repository metadata and .install-files', async () => {
      await cleanupFiles('evm', '/project/my_app', 'full')

      const paths = getRmPaths()
      expect(paths).toContain(resolve('/project/my_app', '.install-files'))
      expect(paths).toContain(resolve('/project/my_app', '.github'))
      expect(paths).toContain(resolve('/project/my_app', '.claude'))
    })

    it('keeps every feature, so package.json is left untouched', async () => {
      await cleanupFiles('evm', '/project/my_app', 'full')

      expect(getRmPaths()).not.toContain(resolve('/project/my_app', '.husky'))
      expect(writeFileSync).not.toHaveBeenCalled()
      expect(execFile).not.toHaveBeenCalled()
    })
  })

  describe('custom mode — all features selected', () => {
    it('removes the repository metadata plus .install-files', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ALL_EVM_FEATURES)

      const paths = getRmPaths()
      expect(paths).toContain(resolve('/project/my_app', '.install-files'))
      expect(paths).toContain(resolve('/project/my_app', '.github'))
    })

    it('leaves package.json alone when there is nothing to strip', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ALL_EVM_FEATURES)

      expect(writeFileSync).not.toHaveBeenCalled()
    })
  })

  describe('custom mode — demo deselected', () => {
    it('removes home folder, recreates it, copies replacement', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [
        'subgraph',
        'typedoc',
        'vocs',
        'husky',
      ])

      const homeFolder = resolve('/project/my_app', 'src/components/pageComponents/home')
      expect(getRmPaths()).toContain(homeFolder)
      expect(getMkdirPaths()).toContain(homeFolder)

      const copies = getCopyFileCalls()
      expect(copies).toContainEqual({
        src: resolve('/project/my_app', '.install-files/home/index.tsx'),
        dst: resolve(homeFolder, 'index.tsx'),
      })
    })
  })

  describe('custom mode — subgraph deselected', () => {
    it('removes src/subgraphs', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ['demo', 'typedoc', 'vocs', 'husky'])

      expect(getRmPaths()).toContain(resolve('/project/my_app', 'src/subgraphs'))
    })

    it('cleans up subgraph demos when demo IS selected', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ['demo', 'typedoc', 'vocs', 'husky'])

      const homeFolder = resolve('/project/my_app', 'src/components/pageComponents/home')
      expect(getRmPaths()).toContain(resolve(homeFolder, 'Examples/demos/subgraphs'))
      expect(getRmPaths()).toContain(resolve(homeFolder, 'Examples/index.tsx'))

      const copies = getCopyFileCalls()
      expect(copies).toContainEqual({
        src: resolve('/project/my_app', '.install-files/home/Examples/index.tsx'),
        dst: resolve(homeFolder, 'Examples/index.tsx'),
      })
    })

    it('does NOT clean up subgraph demos when demo is also deselected', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ['typedoc', 'vocs', 'husky'])

      const subgraphDemosPath = resolve(
        '/project/my_app',
        'src/components/pageComponents/home/Examples/demos/subgraphs',
      )
      expect(getRmPaths()).not.toContain(subgraphDemosPath)
    })

    it('removes subgraph-codegen from package.json scripts', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ['demo', 'typedoc', 'vocs', 'husky'])

      const pkg = getWrittenPackageJson()
      const scripts = pkg.scripts as Record<string, unknown>
      expect(scripts['subgraph-codegen']).toBeUndefined()
    })
  })

  describe('custom mode — typedoc deselected', () => {
    it('removes typedoc.json', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ['demo', 'subgraph', 'vocs', 'husky'])

      expect(getRmPaths()).toContain(resolve('/project/my_app', 'typedoc.json'))
    })

    it('removes typedoc:build from package.json scripts', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ['demo', 'subgraph', 'vocs', 'husky'])

      const pkg = getWrittenPackageJson()
      const scripts = pkg.scripts as Record<string, unknown>
      expect(scripts['typedoc:build']).toBeUndefined()
    })
  })

  describe('custom mode — vocs deselected', () => {
    it('removes vocs.config.ts and docs folder', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [
        'demo',
        'subgraph',
        'typedoc',
        'husky',
      ])

      expect(getRmPaths()).toContain(resolve('/project/my_app', 'vocs.config.ts'))
      expect(getRmPaths()).toContain(resolve('/project/my_app', 'docs'))
    })

    it('removes docs scripts from package.json', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [
        'demo',
        'subgraph',
        'typedoc',
        'husky',
      ])

      const pkg = getWrittenPackageJson()
      const scripts = pkg.scripts as Record<string, unknown>
      expect(scripts['docs:build']).toBeUndefined()
      expect(scripts['docs:dev']).toBeUndefined()
      expect(scripts['docs:preview']).toBeUndefined()
    })
  })

  describe('custom mode — husky deselected', () => {
    it('removes husky folder and config files', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [
        'demo',
        'subgraph',
        'typedoc',
        'vocs',
      ])

      expect(getRmPaths()).toContain(resolve('/project/my_app', '.husky'))
      expect(getRmPaths()).toContain(resolve('/project/my_app', '.lintstagedrc.mjs'))
      expect(getRmPaths()).toContain(resolve('/project/my_app', 'commitlint.config.js'))
    })

    it('removes the tooling scripts from package.json', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [
        'demo',
        'subgraph',
        'typedoc',
        'vocs',
      ])

      const pkg = getWrittenPackageJson()
      const scripts = pkg.scripts as Record<string, unknown>
      expect(scripts.prepare).toBeUndefined()
      expect(scripts.commitlint).toBeUndefined()
    })

    it('leaves the dependencies to the package manager', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [
        'demo',
        'subgraph',
        'typedoc',
        'vocs',
      ])

      const devDeps = getWrittenPackageJson().devDependencies as Record<string, unknown>
      expect(devDeps.husky).toBe('^9.1.7')
      expect(execFile).not.toHaveBeenCalled()
    })
  })

  describe('custom mode — husky selected', () => {
    it('keeps the husky files, scripts, and dependencies', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', ALL_EVM_FEATURES)

      const paths = getRmPaths()
      expect(paths).not.toContain(resolve('/project/my_app', '.husky'))
      expect(paths).not.toContain(resolve('/project/my_app', '.lintstagedrc.mjs'))
      expect(paths).not.toContain(resolve('/project/my_app', 'commitlint.config.js'))
      expect(writeFileSync).not.toHaveBeenCalled()
    })
  })

  describe('custom mode — no features selected', () => {
    it('runs all cleanup operations', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [])

      const paths = getRmPaths()
      expect(paths).toContain(resolve('/project/my_app', 'src/components/pageComponents/home'))
      expect(paths).toContain(resolve('/project/my_app', 'src/subgraphs'))
      expect(paths).toContain(resolve('/project/my_app', 'typedoc.json'))
      expect(paths).toContain(resolve('/project/my_app', 'vocs.config.ts'))
      expect(paths).toContain(resolve('/project/my_app', '.husky'))
      expect(paths).toContain(resolve('/project/my_app', '.install-files'))
    })

    it('removes all optional scripts from package.json', async () => {
      await cleanupFiles('evm', '/project/my_app', 'custom', [])

      const pkg = getWrittenPackageJson()
      const scripts = pkg.scripts as Record<string, unknown>
      expect(scripts['subgraph-codegen']).toBeUndefined()
      expect(scripts['typedoc:build']).toBeUndefined()
      expect(scripts['docs:build']).toBeUndefined()
      expect(scripts['docs:dev']).toBeUndefined()
      expect(scripts['docs:preview']).toBeUndefined()
      expect(scripts.prepare).toBeUndefined()
      expect(scripts.dev).toBe('next dev')
      expect(scripts.build).toBe('next build')
    })
  })

  it('always removes .install-files as the last rm call', async () => {
    await cleanupFiles('evm', '/project/my_app', 'custom', ['demo'])

    const paths = getRmPaths()
    expect(paths.at(-1)).toBe(resolve('/project/my_app', '.install-files'))
  })

  it('uses force option on all rm calls', async () => {
    await cleanupFiles('evm', '/project/my_app', 'custom', [])

    for (const call of vi.mocked(rm).mock.calls) {
      const options = call[1] as { force?: boolean }
      expect(options.force).toBe(true)
    }
  })

  describe('onProgress callback', () => {
    it('reports the prepare and install-script steps for full mode', async () => {
      const steps: string[] = []
      await cleanupFiles('evm', '/project/my_app', 'full', [], (step) => steps.push(step))

      expect(steps).toEqual(['Repository metadata', 'Install script'])
    })

    it('reports all feature cleanups when no features selected', async () => {
      const steps: string[] = []
      await cleanupFiles('evm', '/project/my_app', 'custom', [], (step) => steps.push(step))

      expect(steps).toEqual([
        'Repository metadata',
        'Component Demos',
        'Subgraph support',
        'Typedoc documentation support',
        'Vocs documentation support',
        'Husky Git hooks support',
        'Install script',
      ])
    })

    it('skips steps for selected features', async () => {
      const steps: string[] = []
      await cleanupFiles('evm', '/project/my_app', 'custom', ['demo', 'subgraph'], (step) =>
        steps.push(step),
      )

      expect(steps).not.toContain('Component Demos')
      expect(steps).not.toContain('Subgraph support')
      expect(steps).toContain('Typedoc documentation support')
      expect(steps).toContain('Install script')
    })

    it('works without a callback', async () => {
      await expect(cleanupFiles('evm', '/project/my_app', 'full')).resolves.toBeUndefined()
    })
  })
})

describe('cleanupFiles — canton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCantonPackageJson()
  })

  it('removes every path the stack lists, libraries and repo tooling alike', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    const paths = getRmPaths()
    for (const relativePath of stackDefinitions.canton.prepare.paths) {
      expect(paths).toContain(resolve('/project/my_app', relativePath))
    }
  })

  it('deletes the lockfile, so the install resolves the libraries from npm', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    expect(getRmPaths()).toContain(resolve('/project/my_app', 'pnpm-lock.yaml'))
  })

  it('keeps the hygiene tooling and the deployment example the project still wants', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    const paths = getRmPaths()
    for (const kept of [
      'biome.json',
      'knip.json',
      'commitlint.config.js',
      '.husky',
      'README.md',
      'scripts',
      'dapp/daml',
      'dapp/frontend/vercel.json',
    ]) {
      expect(paths).not.toContain(resolve('/project/my_app', kept))
    }
  })

  it('removes the scripts that run the deleted kit folder', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    const scripts = getWrittenPackageJson().scripts as Record<string, unknown>
    for (const name of [
      'check:anatomy',
      'check:versions',
      'docs:build',
      'docs:check',
      'release:version',
    ]) {
      expect(scripts[name]).toBeUndefined()
    }
  })

  it('removes the declared scripts that no deleted path names', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    const scripts = getWrittenPackageJson().scripts as Record<string, unknown>
    for (const name of stackDefinitions.canton.prepare.scripts) {
      expect(scripts[name]).toBeUndefined()
    }
  })

  it('keeps the scripts the project still needs', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    const scripts = getWrittenPackageJson().scripts as Record<string, unknown>
    expect(scripts.lint).toBe('biome check --error-on-warnings')
    expect(scripts.knip).toBe('knip')
    expect(scripts.prepare).toBe('husky')
    expect(scripts['app:dev']).toBe('pnpm -C dapp/frontend run dev')
  })

  it('removes the dev-dependencies that only served the deleted tooling', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    const devDeps = getWrittenPackageJson().devDependencies as Record<string, unknown>
    for (const name of stackDefinitions.canton.prepare.devDependencies) {
      expect(devDeps[name]).toBeUndefined()
    }
    expect(devDeps.knip).toBe('6.33.0')
    expect(devDeps.husky).toBe('^9.1.7')
  })

  it('never restores a staged file: the stack ships no staging directory', async () => {
    await cleanupFiles('canton', '/project/my_app', 'full')

    expect(copyFile).not.toHaveBeenCalled()
    expect(mkdir).not.toHaveBeenCalled()
  })

  it('has no features, so the mode changes nothing', async () => {
    await cleanupFiles('canton', '/project/my_app', 'custom', [])
    const custom = getRmPaths()

    vi.clearAllMocks()
    mockCantonPackageJson()

    await cleanupFiles('canton', '/project/my_app', 'full')
    expect(getRmPaths()).toEqual(custom)
  })

  it('reports one progress step, since there are no features to report', async () => {
    const steps: string[] = []
    await cleanupFiles('canton', '/project/my_app', 'full', [], (step) => steps.push(step))

    expect(steps).toEqual([stackDefinitions.canton.prepare.label])
  })
})
