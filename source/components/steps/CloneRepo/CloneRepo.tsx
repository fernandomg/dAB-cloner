import { type FC, useCallback } from 'react'
import { cloneRepo } from '../../../operations/index.js'
import { beginInstall } from '../../../operations/installGuard.js'
import type { Stack } from '../../../types/types.js'
import { getProjectFolder } from '../../../utils/utils.js'
import StepProgress from '../StepProgress.js'

interface Props {
  stack: Stack
  projectName: string
  onCompletion: () => void
}

const CloneRepo: FC<Props> = ({ stack, projectName, onCompletion }) => {
  const run = useCallback(
    async (onProgress: (step: string) => void) => {
      beginInstall(getProjectFolder(projectName))
      await cloneRepo(stack, projectName, onProgress)
    },
    [stack, projectName],
  )

  return (
    <StepProgress
      title={'Git tasks'}
      errorLabel={'Failed to clone'}
      run={run}
      onCompletion={onCompletion}
    />
  )
}

export default CloneRepo
