import { Text } from 'ink'
import Spinner from 'ink-spinner'
import { type FC, useCallback, useEffect, useState } from 'react'
import { abortInstall } from '../../operations/installGuard.js'
import { deriveStepDisplay } from '../../utils/utils.js'
import Divider from '../Divider.js'

interface Props {
  title: string
  errorLabel: string
  run: (onProgress: (step: string) => void) => Promise<void>
  onCompletion?: () => void
}

/**
 * Runs one phase of the scaffold and reports its progress. Every operation step shares this: it
 * owns the step list, the running/done/error display, and the failure path, so a failed scaffold
 * always removes its partial directory and reports a non-zero exit code.
 */
const StepProgress: FC<Props> = ({ title, errorLabel, run, onCompletion }) => {
  const [steps, setSteps] = useState<string[]>([])
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running')
  const [errorMessage, setErrorMessage] = useState('')

  const handleProgress = useCallback((step: string) => {
    setSteps((prev) => [...prev, step])
  }, [])

  useEffect(() => {
    run(handleProgress)
      .then(() => {
        setStatus('done')
        onCompletion?.()
      })
      .catch((error: unknown) => {
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : String(error))
        abortInstall()
      })
  }, [run, handleProgress, onCompletion])

  const { completedSteps, currentStep, failedStep } = deriveStepDisplay(steps, status)

  return (
    <>
      <Divider title={title} />
      {completedSteps.map((step) => (
        <Text key={step}>
          <Text color={'green'}>{'✔'}</Text> {step}
        </Text>
      ))}
      {currentStep && (
        <Text>
          <Text color={'green'}>
            <Spinner type={'dots'} />
          </Text>{' '}
          {currentStep}
        </Text>
      )}
      {failedStep && (
        <Text>
          <Text color={'red'}>{'✗'}</Text> {failedStep} <Text color={'red'}>Error</Text>
        </Text>
      )}
      {status === 'error' && (
        <Text color={'red'}>
          {errorLabel}: {errorMessage}
        </Text>
      )}
    </>
  )
}

export default StepProgress
