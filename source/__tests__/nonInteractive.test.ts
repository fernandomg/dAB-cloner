import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureNames } from '../stacks/index.js'

vi.mock('../operations/index.js', () => ({
  cloneRepo: vi.fn().mockResolvedValue(undefined),
  createEnvFile: vi.fn().mockResolvedValue(undefined),
  createInitialCommit: vi.fn().mockResolvedValue(undefined),
  installPackages: vi.fn().mockResolvedValue(undefined),
  cleanupFiles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/utils.js')>()
  return {
    ...actual,
    projectDirectoryExists: vi.fn().mockReturnValue(false),
  }
})

const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})

const { runNonInteractive } = await import('../nonInteractive.js')
const { cloneRepo, createEnvFile, createInitialCommit, installPackages, cleanupFiles } =
  await import('../operations/index.js')
const { projectDirectoryExists } = await import('../utils/utils.js')

const evmFeatureNames = getFeatureNames('evm')

function getLastJsonOutput(): Record<string, unknown> {
  const lastCall = mockLog.mock.calls.at(-1)
  if (!lastCall) {
    throw new Error('console.log was never called — no JSON output to read')
  }
  return JSON.parse(lastCall[0] as string)
}

describe('nonInteractive — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('rejects missing --name', async () => {
    await expect(runNonInteractive({ mode: 'full' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toBe('Missing required flag: --name')
    expect(process.exitCode).toBe(1)
  })

  it('rejects missing --mode', async () => {
    await expect(runNonInteractive({ name: 'my_app' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toBe('Missing required flag: --mode')
  })

  it('validates stack before --name', async () => {
    await expect(runNonInteractive({ stack: 'banana' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.error).toMatch(/Invalid stack/)
  })

  it('validates --name before --mode (when stack is valid)', async () => {
    await expect(runNonInteractive({})).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.error).toBe('Missing required flag: --name')
  })

  it('rejects invalid project name', async () => {
    await expect(runNonInteractive({ name: 'bad name!', mode: 'full' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toMatch(/Invalid project name/)
  })

  it('rejects invalid mode', async () => {
    await expect(runNonInteractive({ name: 'my_app', mode: 'banana' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toMatch(/Invalid mode/)
  })

  it('rejects --mode=custom without --features', async () => {
    await expect(runNonInteractive({ name: 'my_app', mode: 'custom' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toMatch(/--mode custom requires --features/)
  })

  it('rejects empty --features string with --mode=custom', async () => {
    await expect(
      runNonInteractive({ name: 'my_app', mode: 'custom', features: '' }),
    ).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.error).toMatch(/--mode custom requires --features/)
  })

  it('rejects comma-only --features with --mode=custom', async () => {
    await expect(
      runNonInteractive({ name: 'my_app', mode: 'custom', features: ',' }),
    ).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.error).toMatch(/--features value is empty/)
  })

  it('rejects unknown feature names for evm', async () => {
    await expect(
      runNonInteractive({ name: 'my_app', mode: 'custom', features: 'banana,apple' }),
    ).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toMatch(/Unknown features for stack 'evm': banana, apple/)
    expect(output.error).toMatch(/Valid features:/)
  })

  it('rejects mix of valid and invalid features', async () => {
    await expect(
      runNonInteractive({ name: 'my_app', mode: 'custom', features: 'demo,banana' }),
    ).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.error).toMatch(/Unknown features for stack 'evm': banana/)
  })

  it('rejects when project directory already exists (full mode)', async () => {
    vi.mocked(projectDirectoryExists).mockReturnValueOnce(true)
    await expect(runNonInteractive({ name: 'my_app', mode: 'full' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toMatch(/already exists/)
  })

  it('rejects when project directory already exists (custom mode)', async () => {
    vi.mocked(projectDirectoryExists).mockReturnValueOnce(true)
    await expect(
      runNonInteractive({ name: 'my_app', mode: 'custom', features: 'demo' }),
    ).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toMatch(/already exists/)
  })
})

describe('nonInteractive — evm full mode execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('cleans up before installing, so the lockfile matches the pruned manifest', async () => {
    const callOrder: string[] = []
    vi.mocked(cloneRepo).mockImplementation(async () => {
      callOrder.push('cloneRepo')
    })
    vi.mocked(createEnvFile).mockImplementation(async () => {
      callOrder.push('createEnvFile')
    })
    vi.mocked(installPackages).mockImplementation(async () => {
      callOrder.push('installPackages')
    })
    vi.mocked(cleanupFiles).mockImplementation(async () => {
      callOrder.push('cleanupFiles')
    })

    await runNonInteractive({ name: 'my_app', mode: 'full' })

    expect(callOrder).toEqual(['cloneRepo', 'cleanupFiles', 'createEnvFile', 'installPackages'])
    expect(createInitialCommit).not.toHaveBeenCalled()
  })

  it('passes stack as first arg to all operations', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'full' })

    expect(cloneRepo).toHaveBeenCalledWith('evm', 'my_app')
    expect(createEnvFile).toHaveBeenCalledWith('evm', expect.stringContaining('my_app'))
    expect(installPackages).toHaveBeenCalledWith(
      'evm',
      expect.stringContaining('my_app'),
      'full',
      evmFeatureNames,
    )
    expect(cleanupFiles).toHaveBeenCalledWith(
      'evm',
      expect.stringContaining('my_app'),
      'full',
      evmFeatureNames,
    )
  })

  it('outputs success JSON with stack=evm and all evm features', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'full' })

    const output = getLastJsonOutput()
    expect(output.success).toBe(true)
    expect(output.stack).toBe('evm')
    expect(output.projectName).toBe('my_app')
    expect(output.mode).toBe('full')
    expect(output.features).toEqual(evmFeatureNames)
    expect(output.path).toEqual(expect.stringContaining('my_app'))
    expect(output.postInstall).toBeInstanceOf(Array)
  })

  it('includes postInstall messages from all features in full mode', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'full' })

    const output = getLastJsonOutput()
    const postInstall = output.postInstall as string[]
    expect(postInstall.length).toBeGreaterThan(0)
    expect(postInstall.some((msg) => msg.includes('subgraph-codegen'))).toBe(true)
  })

  it('ignores --features flag in full mode', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'full', features: 'demo' })

    const output = getLastJsonOutput()
    expect(output.features).toEqual(evmFeatureNames)
  })
})

describe('nonInteractive — canton execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('needs only --name, and reports no features', async () => {
    await runNonInteractive({ stack: 'canton', name: 'my_app' })

    expect(cloneRepo).toHaveBeenCalledWith('canton', 'my_app')

    const output = getLastJsonOutput()
    expect(output.success).toBe(true)
    expect(output.stack).toBe('canton')
    expect(output.mode).toBe('full')
    expect(output.features).toEqual([])
  })

  it('rejects --mode, naming the reason', async () => {
    await expect(
      runNonInteractive({ stack: 'canton', name: 'my_app', mode: 'full' }),
    ).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toBe(
      'The canton stack has no optional features, so --mode is not accepted',
    )
  })

  it('rejects --features, naming the reason', async () => {
    await expect(
      runNonInteractive({ stack: 'canton', name: 'my_app', features: 'llm' }),
    ).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.error).toBe(
      'The canton stack has no optional features, so --features is not accepted',
    )
  })

  it('still rejects an existing project directory', async () => {
    vi.mocked(projectDirectoryExists).mockReturnValueOnce(true)
    await expect(runNonInteractive({ stack: 'canton', name: 'my_app' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.error).toMatch(/already exists/)
  })

  it('commits the finished canton scaffold, after the install wrote the lockfile', async () => {
    const callOrder: string[] = []
    vi.mocked(installPackages).mockImplementation(async () => {
      callOrder.push('installPackages')
    })
    vi.mocked(createInitialCommit).mockImplementation(async () => {
      callOrder.push('createInitialCommit')
    })

    await runNonInteractive({ stack: 'canton', name: 'my_app' })

    expect(callOrder).toEqual(['installPackages', 'createInitialCommit'])
    expect(createInitialCommit).toHaveBeenCalledWith(expect.stringContaining('my_app'))
  })

  it('post-install points at dev-stack.sh and the README', async () => {
    await runNonInteractive({ stack: 'canton', name: 'my_app' })

    const postInstall = getLastJsonOutput().postInstall as string[]
    expect(postInstall.some((msg) => msg.includes('dev-stack.sh up'))).toBe(true)
    expect(postInstall.some((msg) => msg.includes('README.md'))).toBe(true)
  })
})

describe('nonInteractive — default mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('rejects --mode default for the evm stack', async () => {
    await expect(runNonInteractive({ name: 'my_app', mode: 'default' })).rejects.toThrow()
    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toMatch(/'default' is not available for the evm stack/)
  })
})

describe('nonInteractive — custom mode execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('passes selected features to operations', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'custom', features: 'demo,subgraph' })

    expect(installPackages).toHaveBeenCalledWith(
      'evm',
      expect.stringContaining('my_app'),
      'custom',
      ['demo', 'subgraph'],
    )
    expect(cleanupFiles).toHaveBeenCalledWith('evm', expect.stringContaining('my_app'), 'custom', [
      'demo',
      'subgraph',
    ])
  })

  it('outputs success JSON with only selected features', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'custom', features: 'demo,subgraph' })

    const output = getLastJsonOutput()
    expect(output.success).toBe(true)
    expect(output.mode).toBe('custom')
    expect(output.features).toEqual(['demo', 'subgraph'])
  })

  it('includes postInstall only for selected features', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'custom', features: 'demo' })

    const output = getLastJsonOutput()
    const postInstall = output.postInstall as string[]
    expect(postInstall).toEqual([])
  })

  it('includes subgraph postInstall when subgraph selected', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'custom', features: 'subgraph' })

    const output = getLastJsonOutput()
    const postInstall = output.postInstall as string[]
    expect(postInstall.length).toBeGreaterThan(0)
    expect(postInstall.some((msg) => msg.includes('subgraph-codegen'))).toBe(true)
  })

  it('trims whitespace in feature names', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'custom', features: ' demo , subgraph ' })

    const output = getLastJsonOutput()
    expect(output.features).toEqual(['demo', 'subgraph'])
  })

  it('strips trailing commas in features', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'custom', features: 'demo,' })

    const output = getLastJsonOutput()
    expect(output.features).toEqual(['demo'])
  })

  it('deduplicates feature names', async () => {
    await runNonInteractive({
      name: 'my_app',
      mode: 'custom',
      features: 'demo,demo,subgraph,demo',
    })

    const output = getLastJsonOutput()
    expect(output.features).toEqual(['demo', 'subgraph'])
  })
})

describe('nonInteractive — error handling during execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('outputs error JSON when cloneRepo fails', async () => {
    vi.mocked(cloneRepo).mockRejectedValueOnce(new Error('clone failed'))

    await expect(runNonInteractive({ name: 'my_app', mode: 'full' })).rejects.toThrow()

    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toBe('clone failed')
  })

  it('outputs error JSON when installPackages fails', async () => {
    vi.mocked(installPackages).mockRejectedValueOnce(new Error('install failed'))

    await expect(runNonInteractive({ name: 'my_app', mode: 'full' })).rejects.toThrow()

    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toBe('install failed')
  })

  it('outputs error JSON when cleanupFiles fails', async () => {
    vi.mocked(cleanupFiles).mockRejectedValueOnce(new Error('cleanup failed'))

    await expect(runNonInteractive({ name: 'my_app', mode: 'full' })).rejects.toThrow()

    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toBe('cleanup failed')
  })

  it('handles non-Error thrown values', async () => {
    vi.mocked(cloneRepo).mockRejectedValueOnce('string error')

    await expect(runNonInteractive({ name: 'my_app', mode: 'full' })).rejects.toThrow()

    const output = getLastJsonOutput()
    expect(output.success).toBe(false)
    expect(output.error).toBe('string error')
  })
})

describe('nonInteractive — JSON output format', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('success output is valid parseable JSON', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'full' })

    const raw = mockLog.mock.calls.at(-1)?.[0] as string
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('error output is valid parseable JSON', async () => {
    await expect(runNonInteractive({})).rejects.toThrow()

    const raw = mockLog.mock.calls.at(-1)?.[0] as string
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('success output has all required fields', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'full' })

    const output = getLastJsonOutput()
    expect(output).toHaveProperty('success')
    expect(output).toHaveProperty('stack')
    expect(output).toHaveProperty('projectName')
    expect(output).toHaveProperty('mode')
    expect(output).toHaveProperty('features')
    expect(output).toHaveProperty('path')
    expect(output).toHaveProperty('postInstall')
  })

  it('error output has success and error fields', async () => {
    await expect(runNonInteractive({})).rejects.toThrow()

    const output = getLastJsonOutput()
    expect(output).toHaveProperty('success', false)
    expect(output).toHaveProperty('error')
  })

  it('path is an absolute path', async () => {
    await runNonInteractive({ name: 'my_app', mode: 'full' })

    const output = getLastJsonOutput()
    expect(output.path).toMatch(/^\//)
  })
})
