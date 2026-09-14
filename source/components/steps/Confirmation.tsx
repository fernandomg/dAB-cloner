import figures from 'figures'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { type FC, useState } from 'react'
import type { PlanSummaryItem } from '../../types/types.js'
import Divider from '../Divider.js'

interface Props {
  summary: PlanSummaryItem[]
  onConfirm: () => void
  onCancel: () => void
}

type ConfirmItem = { label: string; value: 'yes' | 'no' }

const confirmItems: Array<ConfirmItem> = [
  { label: 'Yes.', value: 'yes' },
  { label: 'No, start over.', value: 'no' },
]

/**
 * Last step before anything touches the disk. Confirming starts the operations; cancelling loops
 * back to the questions.
 */
const Confirmation: FC<Props> = ({ summary, onConfirm, onCancel }) => {
  const [confirmed, setConfirmed] = useState(false)

  const handleSelect = (item: ConfirmItem) => {
    if (item.value === 'yes') {
      setConfirmed(true)
      onConfirm()
    } else {
      onCancel()
    }
  }

  return (
    <>
      <Divider title={'Review'} />
      <Box flexDirection={'column'}>
        {summary.map(({ label, value }) => (
          <Text key={label}>
            {label}:{' '}
            <Text
              bold
              color={'green'}
            >
              {value}
            </Text>
          </Text>
        ))}
      </Box>
      {confirmed ? (
        <Text>
          <Text color={'green'}>{figures.tick}</Text> Scaffolding…
        </Text>
      ) : (
        <>
          <Text color={'whiteBright'}>Proceed with these settings?</Text>
          <SelectInput
            indicatorComponent={({ isSelected }) => (
              <Text color="green">{isSelected ? `${figures.pointer} ` : '  '}</Text>
            )}
            itemComponent={({ label, isSelected }) => (
              <Text
                color={isSelected ? 'green' : 'white'}
                bold={isSelected}
              >
                {label}
              </Text>
            )}
            items={confirmItems}
            onSelect={handleSelect}
          />
        </>
      )}
    </>
  )
}

export default Confirmation
