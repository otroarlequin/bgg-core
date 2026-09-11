/** Etiquetas en español para Market / wishlist (valores BGG siguen en inglés). */

export const WISHLIST_PRIORITY_LABELS: Record<number, string> = {
  1: "Imprescindible",
  2: "Me encantaría",
  3: "Me gustaría",
  4: "Lo estoy pensando",
  5: "No comprar esto",
};

export function wishlistPriorityLabel(
  priority: number | null | undefined,
): string | null {
  if (priority == null) return null;
  return WISHLIST_PRIORITY_LABELS[priority] ?? `Prioridad ${priority}`;
}

const CONDITION_LABELS: Record<string, string> = {
  new: "Nuevo",
  likenew: "Como nuevo",
  verygood: "Muy bueno",
  good: "Bueno",
  acceptable: "Aceptable",
};

export function marketConditionLabel(condition: string | null | undefined): string {
  if (!condition) return "Condición desconocida";
  const key = condition.trim().toLowerCase().replace(/[\s_-]/g, "");
  return CONDITION_LABELS[key] ?? condition;
}

export function isPlaceholderGameName(name: string | null | undefined): boolean {
  const n = name?.trim();
  if (!n) return true;
  return n.toLowerCase() === "unknown" || /^thing\s+\d+$/i.test(n);
}

export function displayGameName(
  name: string | null | undefined,
  bggId: number,
): string {
  if (isPlaceholderGameName(name)) return `Juego #${bggId}`;
  return name!.trim();
}
