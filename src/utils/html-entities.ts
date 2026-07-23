const NAMED_ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&amp;": "&",
};

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  let decoded = text.replace(/&#(\d+);/g, (_, dec: string) => {
    const code = Number(dec);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });

  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });

  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    if (entity === "&amp;") continue;
    decoded = decoded.split(entity).join(char);
  }
  decoded = decoded.split("&amp;").join("&");

  return decoded;
}

export function decodeHtmlEntitiesNullable(text: string | null): string | null {
  if (text == null) return null;
  return decodeHtmlEntities(text);
}

export function decodeHtmlEntitiesList(values: string[]): string[] {
  return values.map(decodeHtmlEntities);
}

/** Decode entities and strip simple HTML tags from BGG descriptions. */
export function stripHtmlToText(html: string | null | undefined): string | null {
  if (html == null || !html.trim()) return null;
  const decoded = decodeHtmlEntities(html);
  const withoutTags = decoded
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return withoutTags || null;
}
