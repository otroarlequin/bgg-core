/** Standard BGG language_dependence poll levels (ordered least to most dependent). */
export const BGG_LANGUAGE_DEPENDENCE_LEVELS = [
  "No necessary in-game text",
  "Some necessary text - easily memorized or small crib sheet",
  "Moderate in-game text - needs crib sheet or paste ups",
  "Extensive use of text - massive conversion needed to be playable",
  "Unplayable in another language",
] as const;
