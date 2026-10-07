import { loadQuartzConfig, loadQuartzLayout } from './quartz/plugins/loader/config-loader'
import { frameRegistry } from './quartz/components/frames'
import { DocsFrame } from './quartz/components/frames/DocsFrame'
frameRegistry.register('docs', DocsFrame, 'duckposting-site')
const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
