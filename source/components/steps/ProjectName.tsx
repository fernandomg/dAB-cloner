import { Text } from 'ink'
import { type FC, useCallback, useMemo, useState } from 'react'
import { isValidName, projectDirectoryExists } from '../../utils/utils.js'
import Ask from '../Ask.js'

interface Props {
  onCompletion: () => void
  onSubmit: (value: string) => void
}

type ProjectNameValidation = {
  status: 'idle' | 'invalid' | 'valid'
  value: string
  error: string
}

const initialValidation: ProjectNameValidation = {
  status: 'idle',
  value: '',
  error: '',
}

const ProjectName: FC<Props> = ({ onSubmit, onCompletion }) => {
  const [validation, setValidation] = useState<ProjectNameValidation>(initialValidation)

  const validateName = useCallback((name: string): ProjectNameValidation => {
    if (name.length === 0) {
      return {
        status: 'idle',
        value: '',
        error: '',
      }
    }

    if (!isValidName(name)) {
      return {
        status: 'invalid',
        value: name,
        error: 'Not a valid name!',
      }
    }

    if (projectDirectoryExists(name)) {
      return {
        status: 'invalid',
        value: name,
        error: `A directory named "${name}" already exists. Choose another name.`,
      }
    }

    return {
      status: 'valid',
      value: name,
      error: '',
    }
  }, [])

  const errorMessage = useMemo(
    () => (validation.status === 'invalid' ? validation.error : ''),
    [validation.error, validation.status],
  )

  const confirmedName = useMemo(
    () => (validation.status === 'valid' ? validation.value : undefined),
    [validation.status, validation.value],
  )

  const handleSubmit = useCallback(
    (name: string) => {
      const nextValidation = validateName(name)
      setValidation(nextValidation)

      if (nextValidation.status === 'valid') {
        onSubmit(nextValidation.value)
        onCompletion()
      }
    },
    [onSubmit, onCompletion, validateName],
  )

  return (
    <Ask
      answer={confirmedName}
      errorMessage={errorMessage}
      onSubmit={handleSubmit}
      question={'Project name'}
      tip={
        <>
          Letters, numbers, underscores and <Text bold>non-initial</Text> dashes are allowed.
        </>
      }
    />
  )
}

export default ProjectName
