import { loadQuartzConfig, loadQuartzLayout } from './quartz/plugins/loader/config-loader'
import { frameRegistry } from './quartz/components/frames'
import { DocsFrame } from './quartz/components/frames/DocsFrame'
import { duckposting } from 'duckposting'
frameRegistry.register('docs', DocsFrame, 'duckposting-site')
const config = await loadQuartzConfig()
duckposting(config, {
  repository: 'jj-marinho/duckposting', contentDir: 'site/content/notes',
})
export default config
export const layout = await loadQuartzLayout()
