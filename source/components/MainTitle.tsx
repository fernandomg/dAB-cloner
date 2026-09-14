import { Box, Text } from 'ink'
import BigText from 'ink-big-text'
import Gradient from 'ink-gradient'
import type { FC } from 'react'
import { getStackConfig } from '../stacks/index.js'
import type { Stack } from '../types/types.js'

interface Props {
  stack?: Stack
}

const MainTitle: FC<Props> = ({ stack }) => (
  <Box
    flexDirection={'row'}
    alignItems={'flex-end'}
  >
    <Gradient colors={['#ff438c', '#bb1d79', '#8b46a4', '#6a2581']}>
      <BigText
        lineHeight={1}
        font={'chrome'}
        text="dAppBooster"
      />
    </Gradient>
    {stack && (
      <Box
        marginLeft={2}
        marginBottom={2}
      >
        <Text
          backgroundColor={'#bb1d79'}
          bold
          color={'whiteBright'}
        >
          {` ${getStackConfig(stack).label} `}
        </Text>
      </Box>
    )}
  </Box>
)

export default MainTitle
