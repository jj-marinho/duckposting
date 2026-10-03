import { copyFile, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { QuartzComponent, QuartzComponentProps, QuartzConfig, PluginTypes, FullSlug, FilePath } from "@quartz-community/types"

type Options = {
  repository: string
  branch?: string
  contentDir?: string
  contentRoot?: string
  exclude?: string[]
  template?: string
}

// Uses Quartz 5's existing content layout and resource pipeline. No theme copied.
export function duckpostingQuartz(config: QuartzConfig, options: Options, assetsDir = "duckposting") {
  const settings = { contentRoot: "content", exclude: ["private", "templates", ".obsidian"], branch: "main", contentDir: "content/posts", template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n', ...options }
  const Body: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
    const base = new URL(`https://${cfg.baseUrl || "example.com"}`).pathname.replace(/\/$/, "")
    return <>
      <link rel="stylesheet" href={`${base}/duckposting/editor.css`} />
      <div data-duckposting={JSON.stringify({ ...settings, index: `${base}/duckposting/content.json` })} data-module={`${base}/duckposting/editor.js`}>
        <p>Loading duckposting…</p>
        <noscript>Enable JavaScript to write. Reading the blog does not require it.</noscript>
      </div>
    </>
  }
  Body.afterDOMLoaded = `
    let currentRoot, dispose, generation = 0
    const mountDuck = async () => {
      const root = document.querySelector('[data-duckposting]')
      if (root === currentRoot) return
      currentRoot = root
      const ticket = ++generation
      await dispose?.()
      dispose = undefined
      if (!root) return
      try {
        const { mountDuckposting } = await import(root.dataset.module)
        if (ticket !== generation || !root.isConnected) return
        const cleanup = await mountDuckposting(root, JSON.parse(root.dataset.duckposting))
        if (ticket !== generation || !root.isConnected) await cleanup()
        else dispose = cleanup
      } catch {
        root.textContent = 'Could not load the editor. Reload to try again.'
      }
    }
    document.addEventListener('nav', mountDuck)
    mountDuck()
  `
  const plugins = config.plugins as PluginTypes
  plugins.pageTypes ??= []
  plugins.pageTypes.push({
    name: "Duckposting", priority: 100, layout: "duckposting", body: () => Body,
    match: ({ slug }: { slug: string }) => slug === "write/index",
    generate: () => [{ slug: "write/index" as FullSlug, title: "Write", data: {} }],
  })
  plugins.emitters.push({
    name: "DuckpostingAssets",
    async emit({ argv }, content) {
      const directory = join(argv.output, "duckposting")
      await mkdir(directory, { recursive: true })
      const files = ["editor.js", "editor.css", "THIRD_PARTY_LICENSES.txt"]
      await Promise.all(files.map(file => copyFile(join(assetsDir, file), join(directory, file))))
      // Receives Quartz's filtered content: no unpublished titles or text exposed.
      const index = content.filter(([, file]) => file.data.filePath && /\.md$/i.test(file.data.relativePath || "")).map(([, file]) => ({
        path: `${argv.directory}/${file.data.relativePath}`,
        title: file.data.frontmatter?.title || file.data.relativePath,
        draft: false,
      }))
      await writeFile(join(directory, "content.json"), JSON.stringify(index))
      files.push("content.json")
      return files.map(file => join(directory, file) as FilePath)
    },
  })
}
