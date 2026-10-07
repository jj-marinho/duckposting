export type JekyllOptions = {
  /** GitHub owner/repository. */
  repository: string;
  branch?: string;
  /** Jekyll source directory relative to the repository root. Default: ".". */
  source?: string;
  /** Existing theme layout for /write/. Default: "default". */
  layout?: string;
  /** Existing theme layout for new posts. Default: "post". */
  postLayout?: string;
  /** Markdown/frontmatter template; only {{date}} is substituted. */
  template?: string;
};
/** Copy prebuilt assets and create a theme-backed writing page and Liquid content index. */
export declare function prepareJekyll(options: JekyllOptions): Promise<{ write: string; directory: string }>;
