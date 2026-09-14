import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../operations/exec.js', () => ({
  exec: vi.fn().mockResolvedValue(undefined),
  execFile: vi.fn().mockResolvedValue(undefined),
}))

const { exec, execFile } = await import('../../operations/exec.js')
const { createInitialCommit } = await import('../../operations/createInitialCommit.js')

describe('createInitialCommit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stages everything, then commits, in that order', async () => {
    await createInitialCommit('/project/my_app')

    const commands = vi.mocked(execFile).mock.calls.map((call) => (call[1] as string[]).join(' '))
    expect(commands[0]).toBe('add .')
    expect(commands[1]).toContain('commit')
  })

  it('runs in the project folder', async () => {
    await createInitialCommit('/project/my_app')

    for (const call of vi.mocked(execFile).mock.calls) {
      expect(call[2]).toEqual({ cwd: '/project/my_app' })
    }
  })

  it('skips the project hooks, which would lint a tree the user has not touched', async () => {
    await createInitialCommit('/project/my_app')

    const commitCall = vi
      .mocked(execFile)
      .mock.calls.find((call) => (call[1] as string[]).includes('commit'))
    expect(commitCall?.[1]).toContain('--no-verify')
  })

  it("commits with the user's own git identity, without signing", async () => {
    await createInitialCommit('/project/my_app')

    const commitArgs = vi
      .mocked(execFile)
      .mock.calls.find((call) => (call[1] as string[]).includes('commit'))?.[1] as string[]

    expect(commitArgs.join(' ')).not.toContain('user.name')
    expect(commitArgs.join(' ')).not.toContain('user.email')
    expect(commitArgs).toContain('commit.gpgsign=false')
    expect(commitArgs).toContain('chore: initial commit')
  })

  it('never uses a shell', async () => {
    await createInitialCommit('/project/my_app')

    expect(exec).not.toHaveBeenCalled()
  })
})
