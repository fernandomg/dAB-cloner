import { Text } from 'ink'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { getFeatureEntries } from '../../stacks/index.js'
import type { MultiSelectItem, Stack } from '../../types/types.js'
import { applyFeatureToggle, resolveModeFeatures } from '../../utils/utils.js'
import MultiSelect from '../Multiselect/index.js'

interface Props {
  stack: Stack
  onCompletion: () => void
  onSubmit: (selectedItems: Array<MultiSelectItem>) => void
  skip?: boolean
}

const OptionalPackages: FC<Props> = ({ stack, onCompletion, onSubmit, skip = false }) => {
  const [submitted, setSubmitted] = useState<Array<MultiSelectItem>>()

  const customPackages: Array<MultiSelectItem> = useMemo(
    () =>
      getFeatureEntries(stack).map(([name, definition]) => ({
        label: definition.label,
        value: name,
      })),
    [stack],
  )

  const defaultSelected: Array<MultiSelectItem> = useMemo(() => {
    const defaults = resolveModeFeatures(stack, 'default')
    return customPackages.filter((pkg) => defaults.includes(pkg.value))
  }, [stack, customPackages])

  const transformSelection = useCallback(
    (
      nextSelected: Array<MultiSelectItem>,
      toggledItem: MultiSelectItem,
      action: 'select' | 'unselect',
    ): Array<MultiSelectItem> => {
      const resolved = applyFeatureToggle(
        stack,
        nextSelected.map((item) => item.value),
        toggledItem.value,
        action,
      )
      return resolved
        .map((value) => customPackages.find((pkg) => pkg.value === value))
        .filter((pkg): pkg is MultiSelectItem => pkg !== undefined)
    },
    [stack, customPackages],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: Run this only once, no matter what
  useEffect(() => {
    if (skip) {
      onCompletion()
    }
  }, [])

  const onHandleSubmit = (selectedItems: Array<MultiSelectItem>) => {
    onSubmit(selectedItems)
    setSubmitted(selectedItems)
    onCompletion()
  }

  if (skip) {
    return null
  }

  if (submitted) {
    return (
      <Text>
        Optional packages:{' '}
        <Text
          bold
          color={'green'}
        >
          {submitted.length > 0 ? submitted.map((item) => item.label).join(', ') : 'none'}
        </Text>
      </Text>
    )
  }

  return (
    <>
      <Text color={'whiteBright'}>Choose optional packages</Text>
      <MultiSelect
        defaultSelected={defaultSelected}
        focus
        items={customPackages}
        onSubmit={onHandleSubmit}
        transformSelection={transformSelection}
      />
    </>
  )
}

export default OptionalPackages
