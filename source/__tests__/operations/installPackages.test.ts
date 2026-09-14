import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureNames, stackDefinitions } from '../../stacks/index.js'

vi.mock('../../operations/exec.js', () => ({
  exec: vi.fn().mockResolvedValue(undefined),
  execFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }))

const { execFile } = await import('../../operations/exec.js')
const { readFileSync } = await import('node:fs')
const { installPackages } = await import('../../operations/installPackages.js')

/** The EVM template ships a postinstall script; the Canton one does not. */
function mockPackageJson(scripts: Record<string, string> = { postinstall: 'wagmi generate' }) {
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ scripts }))
}

const evmFeatures = stackDefinitions.evm.features

describe('installPackages — evm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPackageJson()
  })

  describe('full mode', () => {
    it('runs pnpm install via execFile', async () => {
      await installPackages('evm', '/project/my_app', 'full')

      expect(execFile).toHaveBeenCalledWith('pnpm', ['install'], { cwd: '/project/my_app' })
    })

    it('runs only one command', async () => {
      await installPackages('evm', '/project/my_app', 'full')

      expect(execFile).toHaveBeenCalledTimes(1)
    })

    it('ignores features argument', async () => {
      await installPackages('evm', '/project/my_app', 'full', ['demo', 'subgraph'])

      expect(execFile).toHaveBeenCalledTimes(1)
      expect(execFile).toHaveBeenCalledWith('pnpm', ['install'], { cwd: '/project/my_app' })
    })
  })

  describe('custom mode — all features selected', () => {
    it('runs pnpm install when no packages to remove', async () => {
      const allFeatures = getFeatureNames('evm')
      await installPackages('evm', '/project/my_app', 'custom', allFeatures)

      expect(execFile).toHaveBeenCalledTimes(1)
      expect(execFile).toHaveBeenCalledWith('pnpm', ['install'], { cwd: '/project/my_app' })
    })
  })

  describe('custom mode — some features deselected', () => {
    it('runs pnpm remove with deselected feature packages', async () => {
      await installPackages('evm', '/project/my_app', 'custom', ['demo'])

      const removeCall = vi
        .mocked(execFile)
        .mock.calls.find((call) => call[0] === 'pnpm' && call[1][0] === 'remove')
      expect(removeCall).toBeDefined()

      const removeArgs = removeCall?.[1] as string[]
      for (const pkg of evmFeatures.subgraph.packages) {
        expect(removeArgs).toContain(pkg)
      }
      for (const pkg of evmFeatures.typedoc.packages) {
        expect(removeArgs).toContain(pkg)
      }
    })

    it('runs postinstall after pnpm remove', async () => {
      const callOrder: string[] = []
      vi.mocked(execFile).mockImplementation(async (_file, args) => {
        if (args[0] === 'remove') {
          callOrder.push('remove')
        }
        if (args[0] === 'run' && args[1] === 'postinstall') {
          callOrder.push('postinstall')
        }
      })

      await installPackages('evm', '/project/my_app', 'custom', ['demo'])

      expect(callOrder).toEqual(['remove', 'postinstall'])
    })

    it('does not include selected feature packages in remove command', async () => {
      await installPackages('evm', '/project/my_app', 'custom', ['demo', 'subgraph'])

      const removeCall = vi
        .mocked(execFile)
        .mock.calls.find((call) => call[0] === 'pnpm' && call[1][0] === 'remove')
      expect(removeCall).toBeDefined()

      const removeArgs = removeCall?.[1] as string[]
      for (const pkg of evmFeatures.subgraph.packages) {
        expect(removeArgs).not.toContain(pkg)
      }
    })

    it('uses execFile for pnpm remove to avoid shell interpolation', async () => {
      await installPackages('evm', '/project/my_app', 'custom', ['demo'])

      expect(execFile).toHaveBeenCalledWith('pnpm', expect.arrayContaining(['remove']), {
        cwd: '/project/my_app',
      })
    })

    it('passes each package as a separate arg to execFile', async () => {
      await installPackages('evm', '/project/my_app', 'custom', ['demo'])

      const removeCall = vi
        .mocked(execFile)
        .mock.calls.find((call) => call[0] === 'pnpm' && call[1][0] === 'remove')
      expect(removeCall).toBeDefined()

      const removeArgs = removeCall?.[1] as string[]
      expect(removeArgs[0]).toBe('remove')
      for (const pkg of evmFeatures.subgraph.packages) {
        expect(removeArgs).toContain(pkg)
      }
    })

    it('runs postinstall via execFile', async () => {
      await installPackages('evm', '/project/my_app', 'custom', ['demo'])

      expect(execFile).toHaveBeenCalledWith('pnpm', ['run', 'postinstall'], {
        cwd: '/project/my_app',
      })
    })
  })

  it('never uses exec (shell) for any command', async () => {
    const { exec } = await import('../../operations/exec.js')

    await installPackages('evm', '/project/my_app', 'custom', ['demo'])

    expect(exec).not.toHaveBeenCalled()
  })

  describe('onProgress callback', () => {
    it('reports one step for full mode', async () => {
      const steps: string[] = []
      await installPackages('evm', '/project/my_app', 'full', [], (step) => steps.push(step))

      expect(steps).toEqual(['Installing packages'])
    })

    it('reports two steps for custom mode with packages to remove', async () => {
      const steps: string[] = []
      await installPackages('evm', '/project/my_app', 'custom', ['demo'], (step) =>
        steps.push(step),
      )

      expect(steps).toEqual(['Installing packages', 'Executing post-install scripts'])
    })

    it('reports one step for custom mode with all features selected', async () => {
      const allFeatures = getFeatureNames('evm')
      const steps: string[] = []
      await installPackages('evm', '/project/my_app', 'custom', allFeatures, (step) =>
        steps.push(step),
      )

      expect(steps).toEqual(['Installing packages'])
    })

    it('works without a callback', async () => {
      await expect(installPackages('evm', '/project/my_app', 'full')).resolves.toBeUndefined()
    })
  })
})

describe('installPackages — canton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPackageJson({})
  })

  it('runs a single pnpm install: the stack has no packages to remove', async () => {
    await installPackages('canton', '/project/my_app', 'full')

    expect(execFile).toHaveBeenCalledTimes(1)
    expect(execFile).toHaveBeenCalledWith('pnpm', ['install'], { cwd: '/project/my_app' })
  })

  it('installs the same way whatever the mode, since nothing is optional', async () => {
    await installPackages('canton', '/project/my_app', 'custom', [])

    expect(execFile).toHaveBeenCalledTimes(1)
    expect(execFile).toHaveBeenCalledWith('pnpm', ['install'], { cwd: '/project/my_app' })
  })

  it('skips the postinstall script the canton template does not have', async () => {
    await installPackages('canton', '/project/my_app', 'custom', [])

    expect(execFile).not.toHaveBeenCalledWith('pnpm', ['run', 'postinstall'], expect.anything())
  })
})
