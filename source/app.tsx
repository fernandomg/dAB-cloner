import { Box } from 'ink'
import { type FC, type ReactNode, useCallback, useMemo, useState } from 'react'
import MainTitle from './components/MainTitle.js'
import CloneRepo from './components/steps/CloneRepo/CloneRepo.js'
import Confirmation from './components/steps/Confirmation.js'
import FileCleanup from './components/steps/FileCleanup.js'
import Install from './components/steps/Install/Install.js'
import InstallationMode from './components/steps/InstallationMode.js'
import OptionalPackages from './components/steps/OptionalPackages.js'
import PostInstall from './components/steps/PostInstall.js'
import ProjectName from './components/steps/ProjectName.js'
import StackSelection from './components/steps/StackSelection.js'
import { getInstallationModes } from './stacks/index.js'
import type { FeatureName, InstallationSelectItem, MultiSelectItem, Stack } from './types/types.js'
import { canShowStep, describeInstallPlan, resolveModeFeatures } from './utils/utils.js'

interface Props {
  preselectedStack?: Stack
}

const App: FC<Props> = ({ preselectedStack }) => {
  const [stack, setStack] = useState<Stack | undefined>(preselectedStack)
  const [projectName, setProjectName] = useState<string>('')
  const [currentStep, setCurrentStep] = useState(1)
  const [setupType, setSetupType] = useState<InstallationSelectItem | undefined>()
  const [selectedFeatures, setSelectedFeatures] = useState<Array<MultiSelectItem> | undefined>()
  const [attempt, setAttempt] = useState(0)

  const finishStep = useCallback(() => setCurrentStep((prevStep) => prevStep + 1), [])
  const onSelectStack = useCallback((value: Stack) => setStack(value), [])
  const onSelectSetupType = useCallback((item: InstallationSelectItem) => setSetupType(item), [])
  const onSelectSelectedFeatures = useCallback(
    (selectedItems: Array<MultiSelectItem>) => setSelectedFeatures([...selectedItems]),
    [],
  )

  const restart = useCallback(() => {
    setProjectName('')
    setSetupType(undefined)
    setSelectedFeatures(undefined)
    setStack(preselectedStack)
    setCurrentStep(1)
    setAttempt((prev) => prev + 1)
  }, [preselectedStack])

  const skipFeatures = setupType?.value === 'full' || setupType?.value === 'default'

  const mode = setupType?.value ?? 'full'

  const features = useMemo(() => {
    if (stack === undefined) {
      return []
    }

    const selectedNames = selectedFeatures?.map((item) => item.value as FeatureName) ?? []
    return resolveModeFeatures(stack, mode, selectedNames)
  }, [stack, mode, selectedFeatures])

  // Memoised because it feeds the step list below, which would otherwise rebuild on every render.
  const planSummary = useMemo(
    () => (stack === undefined ? [] : describeInstallPlan(stack, projectName, mode, features)),
    [stack, projectName, mode, features],
  )

  const steps: Array<ReactNode> = useMemo(() => {
    const orderedSteps: Array<ReactNode> = [
      <ProjectName
        onCompletion={finishStep}
        onSubmit={setProjectName}
        key={`project-name-${attempt}`}
      />,
    ]

    if (!preselectedStack) {
      orderedSteps.push(
        <StackSelection
          onCompletion={finishStep}
          onSelect={onSelectStack}
          key={`stack-selection-${attempt}`}
        />,
      )
    }

    if (stack === undefined) {
      return orderedSteps
    }

    // A stack with no features has nothing to choose and so nothing to review: the project name
    // is the whole conversation.
    if (getInstallationModes(stack).length > 0) {
      orderedSteps.push(
        <InstallationMode
          stack={stack}
          onCompletion={finishStep}
          onSelect={onSelectSetupType}
          key={`installation-mode-${attempt}`}
        />,
        <OptionalPackages
          stack={stack}
          onCompletion={finishStep}
          onSubmit={onSelectSelectedFeatures}
          skip={skipFeatures}
          key={`optional-packages-${attempt}`}
        />,
        <Confirmation
          summary={planSummary}
          onConfirm={finishStep}
          onCancel={restart}
          key={`confirmation-${attempt}`}
        />,
      )
    }

    orderedSteps.push(
      <CloneRepo
        stack={stack}
        onCompletion={finishStep}
        projectName={projectName}
        key={`clone-repo-${attempt}`}
      />,
    )

    orderedSteps.push(
      <FileCleanup
        stack={stack}
        mode={mode}
        features={features}
        onCompletion={finishStep}
        projectName={projectName}
        key={`file-cleanup-${attempt}`}
      />,
    )

    orderedSteps.push(
      <Install
        stack={stack}
        mode={mode}
        features={features}
        onCompletion={finishStep}
        projectName={projectName}
        key={`install-${attempt}`}
      />,
    )

    orderedSteps.push(
      <PostInstall
        stack={stack}
        features={features}
        projectName={projectName}
        key={`post-install-${attempt}`}
      />,
    )

    return orderedSteps
  }, [
    finishStep,
    onSelectStack,
    onSelectSelectedFeatures,
    onSelectSetupType,
    mode,
    features,
    projectName,
    skipFeatures,
    stack,
    preselectedStack,
    attempt,
    planSummary,
    restart,
  ])

  return (
    <Box
      flexDirection={'column'}
      rowGap={1}
      width={80}
    >
      <MainTitle stack={stack} />
      {steps.map((item, index) => canShowStep(currentStep, index + 1) && item)}
    </Box>
  )
}

export default App
