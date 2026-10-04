import { copyFile, mkdir, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { slugifyFilePath } from "@quartz-community/utils/path"
import type { QuartzComponent, QuartzComponentProps, QuartzConfig, PluginTypes, FullSlug, FilePath, BuildCtx, ProcessedContent } from "@quartz-community/types"

type Options = {
  repository: string
  branch?: string
  contentDir?: string
  contentRoot?: string
  exclude?: string[]
  template?: string
  imageDir?: string
}

// Uses Quartz 5's existing content layout and resource pipeline. No theme copied.
export function duckposting(config: QuartzConfig, options: Options, assetsDir = dirname(fileURLToPath(import.meta.url))) {
  const plugins = config.plugins as PluginTypes
  if (!plugins.filters?.some(filter => ["RemoveDraft", "RemoveDrafts"].includes(filter.name))) {
    throw new Error("duckposting requires Quartz's RemoveDraft filter so draft posts stay hidden.")
  }
  const assetNames = ["editor.js", "editor.css", "THIRD_PARTY_LICENSES.txt"]
  const assets = assetNames.map(file => {
    try { return readFileSync(join(assetsDir, file)) }
    catch (cause) { throw new Error(`duckposting: missing ${join(assetsDir, file)}. Reinstall the duckposting package or run npm run build in its source checkout.`, { cause }) }
  })
  for (const match of assets[1].toString().matchAll(/url\(["']?(?:\.\/)?(fonts\/[^)"']+)/g)) {
    if (!assetNames.includes(match[1])) { assetNames.push(match[1]); assets.push(readFileSync(join(assetsDir, match[1]))); }
  }
  const version = createHash("sha256").update(assets[0]).update(assets[1]).digest("hex").slice(0, 12)
  const directoryPath = (value: string) => {
    const path = value.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "").replace(/\/$/, "")
    if (!path || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.split("/").some(part => ["", ".", ".."].includes(part))) {
      throw new Error("duckposting: use a repository-relative Quartz content directory, such as content or notes.")
    }
    return path
  }
  const settingsFor = (ctx: BuildCtx) => {
    const sourceRoot = directoryPath(ctx.argv.directory)
    const contentRoot = directoryPath(options.contentRoot ?? sourceRoot)
    if (contentRoot !== sourceRoot) {
      throw new Error(`duckposting: contentRoot "${contentRoot}" must match Quartz's --directory "${sourceRoot}". Remove contentRoot or build with --directory ${contentRoot}.`)
    }
    const contentDir = directoryPath(options.contentDir ?? `${contentRoot}/posts`)
    if (contentDir !== contentRoot && !contentDir.startsWith(`${contentRoot}/`)) {
      throw new Error(`duckposting: contentDir "${contentDir}" must be inside Quartz's content directory "${contentRoot}".`)
    }
    const imageDir = directoryPath(options.imageDir ?? `${contentRoot}/images`)
    if (imageDir !== contentRoot && !imageDir.startsWith(`${contentRoot}/`)) {
      throw new Error(`duckposting: imageDir must be inside Quartz's content directory "${contentRoot}".`)
    }
    const exclude = options.exclude ?? config.configuration.ignorePatterns
    return { branch: "main", template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n', ...options,
      contentRoot, contentDir, imageDir, exclude }
  }
  const assertRouteFree = (content: ProcessedContent[]) => {
    if (content.some(([, file]) => file.data.filePath && /^(?:write|write\/index)\.md$/i.test(String(file.data.relativePath).replace(/\\/g, "/")))) {
      throw new Error("duckposting reserves /write. Move content/write.md or content/write/index.md to another path.")
    }
  }
  const Body: QuartzComponent = ({ cfg, ctx: context }: QuartzComponentProps) => {
    const ctx = context as BuildCtx
    const settings = settingsFor(ctx)
    const base = ctx.argv.serve || !cfg.baseUrl ? "" : new URL(`https://${cfg.baseUrl}`).pathname.replace(/\/$/, "")
    return <>
      <link rel="stylesheet" href={`${base}/duckposting/editor.css?v=${version}`} />
      <div data-duckposting={JSON.stringify({ ...settings, siteBase: `${base}/`, images: (ctx.allFiles || []).filter(path => /\.(png|jpe?g|gif|webp|avif)$/i.test(path)).map(path => ({ path: `${settings.contentRoot}/${path}`, url: `${base}/${slugifyFilePath(path)}` })), index: `${base}/duckposting/content.json` })} data-module={`${base}/duckposting/editor.js?v=${version}`}>
        <p>Loading duckposting…</p>
        <noscript>Enable JavaScript to write. Reading the blog does not require it.</noscript>
      </div>
      <style>{`
        .page[data-frame=full-width] #quartz-body .center.full-width:has([data-duckposting]) { padding-top: 0; }
        [data-duckposting] { margin-top: 2rem; color-scheme: light; }
        :root[saved-theme=dark] [data-duckposting] { color-scheme: dark; }
      `}</style>
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
  plugins.pageTypes ??= []
  plugins.pageTypes.push({
    name: "Duckposting", priority: 100, layout: "duckposting", body: () => Body,
    match: ({ slug }: { slug: string }) => slug === "write/index",
    generate: ({ content, ctx }) => {
      settingsFor(ctx)
      assertRouteFree(content)
      return [{ slug: "write/index" as FullSlug, title: "Write", data: { unlisted: true } }]
    },
  })
  plugins.emitters.push({
    name: "DuckpostingAssets",
    async emit(ctx, content) {
      const { argv } = ctx
      const { contentRoot } = settingsFor(ctx)
      assertRouteFree(content)
      const directory = join(argv.output, "duckposting")
      await mkdir(directory, { recursive: true })
      const files = [...assetNames]
      await Promise.all(files.map(async file => { await mkdir(dirname(join(directory, file)), { recursive: true }); await copyFile(join(assetsDir, file), join(directory, file)); }))
      // Receives Quartz's filtered content: no unpublished titles or text exposed.
      const index = content.filter(([, file]) => file.data.filePath && /\.md$/i.test(file.data.relativePath || "")).map(([, file]) => ({
        path: `${contentRoot}/${directoryPath(file.data.relativePath!)}`,
        title: file.data.frontmatter?.title || file.data.relativePath,
        draft: false,
      }))
      await writeFile(join(directory, "content.json"), JSON.stringify(index))
      files.push("content.json")
      return files.map(file => join(directory, file) as FilePath)
    },
  })
}
