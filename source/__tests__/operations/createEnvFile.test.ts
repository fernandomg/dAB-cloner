import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({
  copyFile: vi.fn().mockResolvedValue(undefined),
}))

const { copyFile } = await import('node:fs/promises')
const { createEnvFile } = await import('../../operations/createEnvFile.js')

describe('createEnvFile — evm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('copies .env.example to .env.local in the project folder', async () => {
    await createEnvFile('evm', '/project/my_app')

    expect(copyFile).toHaveBeenCalledWith(
      '/project/my_app/.env.example',
      '/project/my_app/.env.local',
    )
  })

  it('uses the provided project folder for both paths', async () => {
    await createEnvFile('evm', '/other/path')

    expect(copyFile).toHaveBeenCalledWith('/other/path/.env.example', '/other/path/.env.local')
  })

  it('propagates errors from copyFile', async () => {
    vi.mocked(copyFile).mockRejectedValueOnce(new Error('.env.example not found'))

    await expect(createEnvFile('evm', '/project/my_app')).rejects.toThrow('.env.example not found')
  })
})

describe('createEnvFile — canton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('copies the single root .env.example to .env', async () => {
    await createEnvFile('canton', '/project/my_app')

    expect(copyFile).toHaveBeenCalledTimes(1)
    expect(copyFile).toHaveBeenCalledWith('/project/my_app/.env.example', '/project/my_app/.env')
  })
})
