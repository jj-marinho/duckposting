export function filename(text) {
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    let title = frontmatter?.match(/^title:[ \t]*(.*)$/m)?.[1].trim() || "";
    try {
      if (title.startsWith('"')) {
        const quoted = title.match(/^("(?:[^"\\]|\\.)*")[ \t]*(?:#.*)?$/)?.[1];
        title = JSON.parse(quoted);
      } else if (title.startsWith("'")) {
        const quoted = title.match(/^'((?:[^']|'')*)'[ \t]*(?:#.*)?$/);
        if (!quoted) throw new Error();
        title = quoted[1].replace(/''/g, "'");
      } else {
        title = title.replace(/[ \t]+#.*/, "");
        if (/^[!&*|>\[\]{}%@`]|:[ \t]|^(?:null|~)$/i.test(title)) throw new Error();
      }
    } catch {
      throw new Error('Use a single-line frontmatter title, such as title: "Your title".');
    }
    const slug = title.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
      .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new Error('Add a frontmatter title: "Your title" containing letters or numbers.');
    return slug + ".md";
  }


export function splitDocument(text) {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  return { frontmatter: match?.[0] || "", body: text.slice(match?.[0].length || 0) };
}

export function readTitle(text) {
  const raw = splitDocument(text).frontmatter.match(/^title:[ \t]*(.*)$/m)?.[1].trim() || "";
  if (raw.startsWith('"')) return JSON.parse(raw.match(/^("(?:[^"\\]|\\.)*")/)?.[1]);
  if (raw.startsWith("'")) return raw.match(/^'((?:[^']|'')*)'/)?.[1].replace(/''/g, "'") || "";
  return raw.replace(/[ \t]+#.*/, "");
}

export function setTitle(text, title) {
  const { frontmatter, body } = splitDocument(text);
  const line = `title: ${JSON.stringify(title.replace(/\r?\n/g, " "))}`;
  if (!frontmatter) return `---\n${line}\n---\n\n${body}`;
  return (/^title:/m.test(frontmatter)
    ? frontmatter.replace(/^title:.*$/m, () => line)
    : frontmatter.replace(/^(---\r?\n)/, `$1${line}\n`)) + body;
}
