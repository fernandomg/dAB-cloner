import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stackDefinitions } from '../../stacks/index.js'

vi.mock('../../operations/exec.js', () => ({
  exec: vi.fn().mockResolvedValue(undefined),
  execFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs/promises', () => ({
  rm: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/utils.js')>()
  return { ...actual, meetsNodeVersion: vi.fn().mockReturnValue(true) }
})

const { exec, execFile } = await import('../../operations/exec.js')
const { rm } = await import('node:fs/promises')
const { meetsNodeVersion } = await import('../../utils/utils.js')
const { cloneRepo } = await import('../../operations/cloneRepo.js')

const evmRepoUrl = stackDefinitions.evm.repoUrl
const cantonRepoUrl = stackDefinitions.canton.repoUrl

describe('cloneRepo — evm (tag-latest)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(meetsNodeVersion).mockReturnValue(true)
  })

  it('clones with execFile using evm repo url and projectName as arg', async () => {
    await cloneRepo('evm', 'my_app')

    expect(execFile).toHaveBeenCalledWith('git', [
      'clone',
      '--depth',
      '1',
      '--no-checkout',
      evmRepoUrl,
      'my_app',
    ])
  })

  it('fetches tags with execFile', async () => {
    await cloneRepo('evm', 'my_app')

    expect(execFile).toHaveBeenCalledWith('git', ['fetch', '--tags'], {
      cwd: expect.stringContaining('my_app'),
    })
  })

  it('checks out latest tag with exec (needs shell)', async () => {
    await cloneRepo('evm', 'my_app')

    expect(exec).toHaveBeenCalledWith(expect.stringContaining('git checkout $(git describe'), {
      cwd: expect.stringContaining('my_app'),
    })
  })

  it('removes .git with fs.rm', async () => {
    await cloneRepo('evm', 'my_app')

    expect(rm).toHaveBeenCalledWith(expect.stringContaining('my_app/.git'), {
      recursive: true,
      force: true,
    })
  })

  it('initializes fresh git repo with execFile', async () => {
    await cloneRepo('evm', 'my_app')

    expect(execFile).toHaveBeenCalledWith('git', ['init'], {
      cwd: expect.stringContaining('my_app'),
    })
  })

  it('does not interpolate projectName into shell strings', async () => {
    await cloneRepo('evm', 'my_app')

    for (const call of vi.mocked(exec).mock.calls) {
      expect(call[0]).not.toContain('my_app')
    }
  })

  it('reports the canonical 5 progress steps in order', async () => {
    const steps: string[] = []
    await cloneRepo('evm', 'my_app', (step) => steps.push(step))

    expect(steps).toEqual([
      'Cloning EVM in my_app',
      'Fetching tags',
      'Checking out latest tag',
      'Removing .git folder',
      'Initializing Git repository',
    ])
  })

  it('declares no Node floor, so the version is never checked', async () => {
    await cloneRepo('evm', 'my_app')

    expect(meetsNodeVersion).not.toHaveBeenCalled()
  })

  it('checks the package manager is on PATH before cloning', async () => {
    await cloneRepo('evm', 'my_app')

    const calls = vi.mocked(execFile).mock.calls
    expect(calls[0]).toEqual([stackDefinitions.evm.packageManager, ['--version']])
  })

  it('fails with a plain message when the package manager is missing', async () => {
    vi.mocked(execFile).mockRejectedValueOnce(new Error('spawn pnpm ENOENT'))

    await expect(cloneRepo('evm', 'my_app')).rejects.toThrow(/pnpm was not found/)
    expect(execFile).toHaveBeenCalledTimes(1)
  })

  it('works without a callback', async () => {
    await expect(cloneRepo('evm', 'my_app')).resolves.toBeUndefined()
  })
})

describe('cloneRepo — canton (tag-latest)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(meetsNodeVersion).mockReturnValue(true)
  })

  it('clones the canton repo and checks out its latest tag', async () => {
    await cloneRepo('canton', 'my_app')

    expect(execFile).toHaveBeenCalledWith('git', [
      'clone',
      '--depth',
      '1',
      '--no-checkout',
      cantonRepoUrl,
      'my_app',
    ])
    expect(execFile).toHaveBeenCalledWith('git', ['fetch', '--tags'], expect.anything())
  })

  it('reinitializes git with execFile', async () => {
    await cloneRepo('canton', 'my_app')

    expect(execFile).toHaveBeenCalledWith('git', ['init'], {
      cwd: expect.stringContaining('my_app'),
    })
  })

  it('checks the running Node against the stack floor before cloning', async () => {
    await cloneRepo('canton', 'my_app')

    expect(meetsNodeVersion).toHaveBeenCalledWith(stackDefinitions.canton.minNodeVersion)
  })

  it('fails with a plain message on too old a Node, before touching the disk', async () => {
    vi.mocked(meetsNodeVersion).mockReturnValue(false)

    await expect(cloneRepo('canton', 'my_app')).rejects.toThrow(
      /Canton stack needs Node 24\.15\.0 or later/,
    )
    expect(execFile).not.toHaveBeenCalled()
  })
})

describe('cloneRepo — tag-latest stack pinned to one ref', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(meetsNodeVersion).mockReturnValue(true)
    vi.stubEnv('DAPPBOOSTER_EVM_REF', 'v1.2.3')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('fetches that ref shallowly and checks it out instead of the latest tag', async () => {
    await cloneRepo('evm', 'my_app')

    expect(execFile).toHaveBeenCalledWith('git', ['fetch', '--depth', '1', 'origin', 'v1.2.3'], {
      cwd: expect.stringContaining('my_app'),
    })
    expect(execFile).toHaveBeenCalledWith('git', ['checkout', 'FETCH_HEAD'], {
      cwd: expect.stringContaining('my_app'),
    })
    expect(exec).not.toHaveBeenCalled()
  })

  it('names the ref in its progress steps', async () => {
    const steps: string[] = []
    await cloneRepo('evm', 'my_app', (step) => steps.push(step))

    expect(steps).toEqual([
      'Cloning EVM (v1.2.3) in my_app',
      'Checking out v1.2.3',
      'Removing .git folder',
      'Initializing Git repository',
    ])
  })
})
