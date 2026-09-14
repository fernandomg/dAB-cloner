import { execFile } from './exec.js'

/**
 * Commits the finished scaffold as the project's baseline, so the user can see what they changed
 * afterwards. The commit uses the user's own git identity. `--no-verify` keeps the project's own
 * hooks from linting a tree they have not touched yet; their later commits run the hooks normally.
 */
export async function createInitialCommit(projectFolder: string): Promise<void> {
  await execFile('git', ['add', '.'], { cwd: projectFolder })
  await execFile(
    'git',
    ['-c', 'commit.gpgsign=false', 'commit', '--no-verify', '-m', 'chore: initial commit'],
    { cwd: projectFolder },
  )
}
