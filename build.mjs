import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { mkdir, copyFile, readFile, readdir, writeFile } from "node:fs/promises";
process.chdir(dirname(fileURLToPath(import.meta.url)));
const result = await build({ entryPoints: ["packages/core/index.js"], bundle: true, format: "esm", target: "es2022", minify: true, outfile: "dist/editor.js", legalComments: "inline", metafile: true });
// Preserve the licenses of the packages actually included in the browser bundle.
const packages = new Set(Object.keys(result.metafile.inputs).map(file => file.match(/^(?:.*\/)?node_modules\/(?:@[^/]+\/)?[^/]+/)?.[0]).filter(Boolean));
const notices = [];
for (const directory of [...packages].sort()) {
  const pkg = JSON.parse(await readFile(`${directory}/package.json`, "utf8"));
  const licenses = (await readdir(directory)).filter(file => /^licen[cs]e(?:[.-]|$)/i.test(file));
  if (!licenses.length) throw new Error(`Missing bundled license for ${pkg.name}`);
  notices.push(`${pkg.name}@${pkg.version}\n${(await Promise.all(licenses.sort().map(file => readFile(`${directory}/${file}`, "utf8")))).join("\n\n")}`);
}
await writeFile("dist/THIRD_PARTY_LICENSES.txt", notices.join("\n\n-----\n\n"));
for (const directory of ["write", "demo"]) {
  await mkdir(directory, { recursive: true });
  for (const file of ["editor.js", "editor.css", "THIRD_PARTY_LICENSES.txt"]) await copyFile(`dist/${file}`, `${directory}/${file}`);
}
