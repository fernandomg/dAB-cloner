import { Box, Text } from 'ink'
import { type FC, useEffect, useState } from 'react'
import { getStackConfig } from '../../stacks/index.js'
import type { PostInstallProps, Stack } from '../../types/types.js'
import { getPostInstallMessages } from '../../utils/utils.js'
import Divider from '../Divider.js'

type Props = PostInstallProps & { stack: Stack }

/** The plain list of next steps, shown for a stack that brings no component of its own. */
const DefaultMessage: FC<{ projectName: string; lines: string[] }> = ({ projectName, lines }) => (
  <Box
    flexDirection={'column'}
    rowGap={1}
    paddingBottom={2}
  >
    <Text color={'whiteBright'}>Next steps:</Text>
    <Box flexDirection={'column'}>
      <Text>
        - Move into the project's folder with <Text color={'gray'}>cd {projectName}</Text>
      </Text>
      {lines.map((line) => (
        <Text key={line}>- {line}</Text>
      ))}
    </Box>
  </Box>
)

/**
 * Closing screen. A stack can bring its own component for a richer message; without one, the same
 * lines the non-interactive path reports are printed as they are. The stack's component is imported
 * here rather than from the stack config, so the config stays free of terminal UI for `--info` and
 * the non-interactive path.
 */
const PostInstall: FC<Props> = ({ stack, features, projectName }) => {
  const { postInstallComponent: loadStackMessage } = getStackConfig(stack)
  const [StackMessage, setStackMessage] = useState<FC<PostInstallProps>>()

  useEffect(() => {
    if (!loadStackMessage) {
      return
    }

    let active = true

    loadStackMessage().then((module) => {
      if (active) {
        setStackMessage(() => module.default)
      }
    })

    return () => {
      active = false
    }
  }, [loadStackMessage])

  return (
    <>
      <Divider title={'Post-install instructions'} />
      {StackMessage && (
        <StackMessage
          projectName={projectName}
          features={features}
        />
      )}
      {!loadStackMessage && (
        <DefaultMessage
          projectName={projectName}
          lines={getPostInstallMessages(stack, features)}
        />
      )}
    </>
  )
}

export default PostInstall
