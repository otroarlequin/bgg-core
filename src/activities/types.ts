import type { StorageService } from "../storage/index.js";
import type { QueryService } from "../query/index.js";

export type ActivityKind = "interactive" | "generative" | "analytical";

export interface RenderService {
  renderTemplate(templateId: string, data: unknown): Promise<Buffer>;
}

export interface ActivityContext {
  queries: QueryService;
  storage: StorageService;
  render?: RenderService;
  outputDir: string;
}

export interface Activity<TParams, TOutput> {
  id: string;
  name: string;
  kind: ActivityKind;
  description: string;
  run(params: TParams, ctx: ActivityContext): Promise<TOutput>;
}
