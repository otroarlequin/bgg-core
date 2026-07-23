import type { RenderService } from "../types.js";

/** Placeholder para actividades generativas de imagen (iteración futura). */
export const renderService: RenderService = {
  async renderTemplate(templateId: string): Promise<Buffer> {
    throw new Error(
      `RenderService no implementado aún (template: ${templateId}). Ver roadmap en SETUP.md.`,
    );
  },
};
