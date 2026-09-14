import { type FC, useCallback, useMemo } from 'react'
import { createEnvFile, createInitialCommit, installPackages } from '../../../operations/index.js'
import { completeInstall } from '../../../operations/installGuard.js'
import { getStackConfig } from '../../../stacks/index.js'
import type { FeatureName, InstallationType, Stack } from '../../../types/types.js'
import { getProjectFolder } from '../../../utils/utils.js'
import StepProgress from '../StepProgress.js'

interface Props {
  stack: Stack
  mode: InstallationType
  features: FeatureName[]
  projectName: string
  onCompletion: () => void
}

const Install: FC<Props> = ({ stack, mode, features, projectName, onCompletion }) => {
  const projectFolder = useMemo(() => getProjectFolder(projectName), [projectName])

  const run = useCallback(
    async (onProgress: (step: string) => void) => {
      onProgress('Creating env files')
      await createEnvFile(stack, projectFolder)
      await installPackages(stack, projectFolder, mode, features, onProgress)

      if (getStackConfig(stack).initialCommit) {
        onProgress('Initial commit')
        await createInitialCommit(projectFolder)
      }

      completeInstall()
    },
    [stack, projectFolder, mode, features],
  )

  return (
    <StepProgress
      title={'Installation'}
      errorLabel={'Installation failed'}
      run={run}
      onCompletion={onCompletion}
    />
  )
}

export default Install
