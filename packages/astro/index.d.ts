import type { AstroIntegration } from 'astro';
export type Page = { path: string; title: string; url: string };
export type Options = {
  repository: string;
  /** Repository-relative directory containing new Markdown posts. */
  contentDir: string;
  /** Defaults to contentDir. Only .md files beneath this root are editable. */
  contentRoot?: string;
  branch?: string;
  exclude?: string[];
  template?: string;
  /** For sites that use published: false instead of draft: true. */
  draftField?: string;
  draftValue?: boolean;
  filenameFormat?: 'title' | 'date-title';
  /** Repository-relative upload directory, normally inside public/. */
  imageDir?: string;
  /** Public URL corresponding to imageDir, including Astro's base. */
  imageBase?: string;
  /** Published entries only, with actual public URLs from your route function. */
  pages: Page[];
  images?: { path: string; url: string }[];
};
export default function duckposting(): AstroIntegration;
export declare function browserSettings(options: Options, base?: string): Record<string, unknown>;
