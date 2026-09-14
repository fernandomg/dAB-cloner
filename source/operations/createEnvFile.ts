import { copyFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getStackConfig } from '../stacks/index.js'
import type { Stack } from '../types/types.js'

export async function createEnvFile(stack: Stack, projectFolder: string): Promise<void> {
  for (const file of getStackConfig(stack).envFiles) {
    await copyFile(join(projectFolder, file.from), join(projectFolder, file.to))
  }
}
