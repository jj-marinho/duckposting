import type { PageFrame } from './types'
export const DocsFrame: PageFrame = {
  name: 'docs',
  render({ componentData, beforeBody, pageBody: Content }) {
    const base = componentData.ctx.argv.serve ? '' : '/duckposting'
    return <div class="docs-column">
      <a class="skip-link" href="#main-content">Skip to content</a>
      <header class="docs-nav">
        <a class="docs-brand" href={`${base}/`}>duckposting<span aria-hidden="true">.</span></a>
        <nav aria-label="Main"><a href={`${base}/docs/`}>Docs</a><a href={`${base}/demo/`} data-no-popover data-router-ignore>Try it</a><a href="https://github.com/jj-marinho/duckposting">GitHub ↗</a></nav>
      </header>
      <main id="main-content">
        {componentData.fileData.slug !== 'index' && beforeBody.map(Component => <Component {...componentData} />)}
        <Content {...componentData} />
      </main>
      <footer class="docs-footer"><span>Small software. Your words.</span><a href={`${base}/write/`}>Edit this site</a><a href="https://github.com/jj-marinho/duckposting/blob/main/LICENSE">MIT</a></footer>
    </div>
  },
}
