import figures from 'figures'
import { Text } from 'ink'
import SelectInput from 'ink-select-input'
import { type FC, useState } from 'react'
import { getInstallationModes } from '../../stacks/index.js'
import type { InstallationSelectItem, Stack } from '../../types/types.js'
import { MODE_LABELS } from '../../utils/utils.js'
import Divider from '../Divider.js'

interface Props {
  stack: Stack
  onCompletion: () => void
  onSelect: (item: InstallationSelectItem) => void
}

const InstallationMode: FC<Props> = ({ stack, onCompletion, onSelect }) => {
  const [selected, setSelected] = useState<InstallationSelectItem>()

  const installationTypeItems: Array<InstallationSelectItem> = getInstallationModes(stack).map(
    (value) => ({ label: MODE_LABELS[value], value }),
  )

  const handleSelect = (item: InstallationSelectItem) => {
    onSelect(item)
    setSelected(item)
    onCompletion()
  }

  return (
    <>
      <Divider title={'Installation setup'} />
      {selected ? (
        <Text>
          Installation type:{' '}
          <Text
            bold
            color={'green'}
          >
            {selected.label}
          </Text>
        </Text>
      ) : (
        <>
          <Text color={'whiteBright'}>Choose installation type</Text>
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
            items={installationTypeItems}
            onSelect={handleSelect}
          />
        </>
      )}
    </>
  )
}

export default InstallationMode
