import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { mkdir, copyFile, readFile, readdir, writeFile } from "node:fs/promises";
process.chdir(dirname(fileURLToPath(import.meta.url)));
const result = await build({ entryPoints: ["packages/core/index.js"], bundle: true, format: "esm", target: "es2022", minify: true, outfile: "dist/editor.js", legalComments: "inline", metafile: true, loader: { ".woff": "file", ".woff2": "file", ".ttf": "file" }, assetNames: "fonts/[name]-[hash]" });
// Preserve the licenses of the packages actually included in the browser bundle.
const packages = new Set(Object.keys(result.metafile.inputs).map(file => file.match(/^(?:.*\/)?node_modules\/(?:@[^/]+\/)?[^/]+/)?.[0]).filter(Boolean));
const notices = [];
for (const directory of [...packages].sort()) {
  const pkg = JSON.parse(await readFile(`${directory}/package.json`, "utf8"));
  const licenses = (await readdir(directory)).filter(file => /^licen[cs]e(?:[.-]|$)/i.test(file));
  // remark-math 6 omits its license from npm; retain the upstream notice.
  if (!licenses.length && pkg.name === "remark-math" && pkg.version === "6.0.0") {
    notices.push(`${pkg.name}@${pkg.version}\n${await readFile("licenses/remark-math.txt", "utf8")}`); continue;
  }
  if (!licenses.length) throw new Error(`Missing bundled license for ${pkg.name}`);
  notices.push(`${pkg.name}@${pkg.version}\n${(await Promise.all(licenses.sort().map(file => readFile(`${directory}/${file}`, "utf8")))).join("\n\n")}`);
}
await writeFile("dist/THIRD_PARTY_LICENSES.txt", notices.join("\n\n-----\n\n"));
for (const directory of ["write", "demo"]) {
  await mkdir(directory, { recursive: true });
  await mkdir(`${directory}/fonts`, { recursive: true });
  for (const file of await readdir("dist/fonts")) await copyFile(`dist/fonts/${file}`, `${directory}/fonts/${file}`);
  for (const file of ["editor.js", "editor.css", "THIRD_PARTY_LICENSES.txt"]) await copyFile(`dist/${file}`, `${directory}/${file}`);
}

// Quartz keeps npm imports external, so assets stay beside this module.
await build({ entryPoints: ["packages/quartz/index.tsx"], format: "esm", platform: "node", target: "node22", jsx: "automatic", jsxImportSource: "preact", outfile: "dist/index.js" });
await copyFile("packages/quartz/index.d.ts", "dist/index.d.ts");

await mkdir("dist/astro", { recursive: true });
for (const file of ["index.js", "index.d.ts", "Duckposting.astro"]) await copyFile(`packages/astro/${file}`, `dist/astro/${file}`);
await copyFile("packages/jekyll/index.js", "dist/jekyll.js");
await copyFile("packages/jekyll/index.d.ts", "dist/jekyll.d.ts");
