import figures from 'figures'
import { Text } from 'ink'
import SelectInput from 'ink-select-input'
import { type FC, useState } from 'react'
import { stackDefinitions, stackNames } from '../../stacks/index.js'
import type { Stack } from '../../types/types.js'
import Divider from '../Divider.js'

interface Props {
  onCompletion: () => void
  onSelect: (stack: Stack) => void
}

const stackItems = stackNames.map((name) => ({
  label: `${stackDefinitions[name].label} — ${stackDefinitions[name].description}`,
  value: name,
}))

const StackSelection: FC<Props> = ({ onCompletion, onSelect }) => {
  const [selectedStack, setSelectedStack] = useState<Stack>()

  const handleSelect = (item: { value: Stack }) => {
    onSelect(item.value)
    setSelectedStack(item.value)
    onCompletion()
  }

  return (
    <>
      <Divider title={'Select stack'} />
      {selectedStack ? (
        <Text>
          Stack:{' '}
          <Text
            bold
            color={'green'}
          >
            {stackDefinitions[selectedStack].label}
          </Text>
        </Text>
      ) : (
        <>
          <Text color={'whiteBright'}>Which stack do you want to scaffold?</Text>
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
            items={stackItems}
            onSelect={handleSelect}
          />
        </>
      )}
    </>
  )
}

export default StackSelection
