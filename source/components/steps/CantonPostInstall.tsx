import { Box, Text } from 'ink'
import Link from 'ink-link'
import type { FC } from 'react'
import type { PostInstallProps } from '../../types/types.js'

const REPO_URL = 'https://github.com/BootNodeDev/canton-dappbooster'

const CantonPostInstall: FC<PostInstallProps> = ({ projectName }) => (
  <Box
    flexDirection={'column'}
    rowGap={1}
    paddingBottom={2}
  >
    <Text color={'whiteBright'}>To start development on your project:</Text>
    <Box flexDirection={'column'}>
      <Text>
        - Docker must be running (or start it from the <Text color={'gray'}>dev-stack</Text> script
        below).
      </Text>
      <Text>
        - Move into the project's folder with <Text color={'gray'}>cd {projectName}</Text>
      </Text>
      <Text>
        - Run <Text color={'gray'}>./scripts/dev-stack.sh</Text>, with Docker running choose{' '}
        <Text color={'gray'}>"Stack Up"</Text>.
      </Text>
    </Box>
    <Text
      color={'yellow'}
      bold
    >
      Warning: the first run pulls about 10 GB and can take a few minutes to start.
    </Text>
    <Text color={'whiteBright'}>More info:</Text>
    <Box flexDirection={'column'}>
      <Text>
        - The <Link url={`${REPO_URL}/blob/main/README.md`}>README</Link> has more detailed
        instructions about running the stack.
      </Text>
      <Text>
        - Components documentation is available{' '}
        <Link url={'https://docs.dappbooster.cc/'}>here</Link>.
      </Text>
      <Text>
        - Report issues with dAppBooster in the repo's{' '}
        <Link url={`${REPO_URL}/issues`}>issue tracker</Link>.
      </Text>
    </Box>
  </Box>
)

export default CantonPostInstall
