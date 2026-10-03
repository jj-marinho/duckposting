import { build } from "esbuild";
import { mkdir, copyFile, readFile, readdir, writeFile } from "node:fs/promises";
const result = await build({ entryPoints: ["packages/core/index.js"], bundle: true, format: "esm", target: "es2022", minify: true, outfile: "dist/editor.js", legalComments: "inline", metafile: true });
// Preserve the licenses of the packages actually included in the browser bundle.
const packages = new Set(Object.keys(result.metafile.inputs).map(file => file.match(/^node_modules\/(?:@[^/]+\/)?[^/]+/)?.[0]).filter(Boolean));
const notices = [];
for (const directory of [...packages].sort()) {
  const pkg = JSON.parse(await readFile(`${directory}/package.json`, "utf8"));
  const licenses = (await readdir(directory)).filter(file => /^licen[cs]e(?:[.-]|$)/i.test(file));
  if (!licenses.length) throw new Error(`Missing bundled license for ${pkg.name}`);
  notices.push(`${pkg.name}@${pkg.version}\n${await readFile(`${directory}/${licenses[0]}`, "utf8")}`);
}
await writeFile("dist/THIRD_PARTY_LICENSES.txt", notices.join("\n\n-----\n\n"));
await mkdir("write", { recursive: true });
for (const file of ["editor.js", "editor.css", "THIRD_PARTY_LICENSES.txt"]) await copyFile(`dist/${file}`, `write/${file}`);
