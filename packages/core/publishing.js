import { filename } from "./document.js";

export function connectPublishing(root, config, { signal, onReset = () => {}, onBusy = () => {} } = {}) {
  const post = root.querySelector("#post");
  const token = root.querySelector("#token");
  const remember = root.querySelector("#remember");
  const sync = root.querySelector("#sync");
  const status = root.querySelector("#status");
  // Keep the V0 keys so installed users retain their drafts and credentials.
  const namespace = `duck:${config.repository}:${config.branch}:${config.contentDir}:`;

  function storage(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(namespace + key);
      if (value === null) localStorage.removeItem(namespace + key);
      else localStorage.setItem(namespace + key, value);
    } catch {
      root.querySelector("#storage-warning").hidden = false;
    }
  }

  function newPost() {
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map(part => String(part).padStart(2, "0")).join("-");
    return config.template.replaceAll("{{date}}", date);
  }

  function base64(text) {
    let binary = "";
    for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function saveToken() {
    storage("token", remember.checked ? token.value.trim() : null);
  }

  function saved(url, text) {
    if (storage("draft") === text) storage("draft", null);
    post.value = newPost();
    onReset();
    status.textContent = "Saved to GitHub. The blog updates after its build finishes. ";
    const link = document.createElement("a");
    link.href = url;
    link.textContent = "View on GitHub";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    status.append(link);
  }

  post.value = storage("draft") ?? newPost();
  token.value = storage("token") || "";
  remember.checked = Boolean(token.value);
  post.addEventListener("input", () => storage("draft", post.value), { signal });
  token.addEventListener("input", saveToken, { signal });
  remember.addEventListener("change", saveToken, { signal });
  root.querySelector("#forget").addEventListener("click", () => {
    token.value = "";
    remember.checked = false;
    saveToken();
  }, { signal });

  sync.addEventListener("click", async () => {
    if (sync.disabled) return;
    const text = post.value;
    let path;
    try {
      if (config.repository === "YOUR-USERNAME/YOUR-BLOG") {
        throw new Error("Configure the duckposting repository first.");
      }
      const directory = config.contentDir.replace(/^\/+|\/+$/g, "");
      if (directory.split("/").some(part => part === "." || part === "..")) {
        throw new Error("The content directory must be a repository-relative path.");
      }
      path = [directory, filename(text)].filter(Boolean).join("/")
        .split("/").map(encodeURIComponent).join("/");
      if (!token.value.trim()) {
        root.querySelector("#connection").open = true;
        token.focus();
        throw new Error("Enter your GitHub personal access token to sync.");
      }
    } catch (error) {
      status.textContent = error.message;
      return;
    }

    storage("draft", text);
    saveToken();
    sync.disabled = post.disabled = true;
    onBusy(true);
    status.textContent = "Syncing…";
    const url = `https://api.github.com/repos/${config.repository}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${token.value.trim()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    };
    const fileUrl = `https://github.com/${config.repository}/blob/${encodeURIComponent(config.branch)}/${path}`;
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: config.branch,
          message: `Add ${decodeURIComponent(path)}`,
          content: base64(text),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.message || `GitHub returned ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      saved(data.commit?.html_url || fileUrl, text);
    } catch (error) {
      let recovered = false;
      if (!error.status || error.status === 409 || error.status === 422 || error.status >= 500) {
        try {
          const existing = await fetch(`${url}?ref=${encodeURIComponent(config.branch)}`, {
            headers: { ...headers, Accept: "application/vnd.github.raw+json" },
            cache: "no-store",
          });
          if (existing.ok) {
            if (await existing.text() === text) {
              saved(fileUrl, text);
              recovered = true;
            } else {
              error.message = "A different post already uses this filename. Change the frontmatter title and sync again.";
            }
          }
        } catch { /* Keep the draft when GitHub is unreachable. */ }
      }
      if (!recovered) status.textContent = `Not confirmed saved. ${error.message} Your draft is kept.`;
    } finally {
      sync.disabled = post.disabled = false;
      onBusy(false);
    }
  }, { signal });
}
