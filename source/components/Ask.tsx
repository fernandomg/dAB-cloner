import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { type FC, type ReactNode, useMemo, useState } from 'react'
import { isAnswerConfirmed } from '../utils/utils.js'

interface Props {
  answer?: string
  errorMessage?: string
  onSubmit: (value: string) => void
  question: string
  tip?: ReactNode
  placeholder?: string
}

const Ask: FC<Props> = ({ question, onSubmit, answer, tip, errorMessage, placeholder }) => {
  const [input, setInput] = useState('')
  const answered = useMemo(() => isAnswerConfirmed(answer, errorMessage), [answer, errorMessage])

  return (
    <Box
      flexDirection={'column'}
      rowGap={1}
    >
      <Box flexDirection={'column'}>
        <Box>
          <Text color={'whiteBright'}>{question}: </Text>
          {answered ? (
            <Text
              bold
              color={'green'}
            >
              {answer}
            </Text>
          ) : (
            <TextInput
              onChange={setInput}
              onSubmit={onSubmit}
              placeholder={placeholder}
              value={input}
            />
          )}
        </Box>
        {tip && <Text color={'gray'}>{tip}</Text>}
      </Box>
      {errorMessage && (
        <Text
          bold
          color={'red'}
        >
          {errorMessage}
        </Text>
      )}
    </Box>
  )
}

export default Ask
