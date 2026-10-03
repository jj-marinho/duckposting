import type { QuartzConfig } from "@quartz-community/types";
export type Options = {
  repository: string;
  branch?: string;
  contentDir?: string;
  contentRoot?: string;
  exclude?: string[];
  template?: string;
};
/** Add the writing route, assets and published content index to Quartz 5. */
export declare function duckposting(config: QuartzConfig, options: Options): void;
