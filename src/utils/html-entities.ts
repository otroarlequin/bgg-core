const NAMED_ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&amp;": "&",
};

/** Coerce BGG/XML quirks (objects with `.value`, numbers) into a string. */
function toDecodableString(text: unknown): string {
  if (text == null) return "";
  if (typeof text === "string") return text;
  if (typeof text === "number" || typeof text === "boolean") return String(text);
  if (typeof text === "object" && text !== null && "value" in text) {
    return toDecodableString((text as { value: unknown }).value);
  }
  if (Array.isArray(text)) {
    return text.map((part) => toDecodableString(part)).filter(Boolean).join(" ");
  }
  return String(text);
}

export function decodeHtmlEntities(text: unknown): string {
  const input = toDecodableString(text);
  if (!input) return input;

  let decoded = input.replace(/&#(\d+);/g, (_, dec: string) => {
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

export function decodeHtmlEntitiesNullable(
  text: unknown,
): string | null {
  if (text == null) return null;
  const decoded = decodeHtmlEntities(text);
  return decoded.length > 0 ? decoded : null;
}

export function decodeHtmlEntitiesList(values: unknown[]): string[] {
  return values.map((v) => decodeHtmlEntities(v));
}

/** Decode entities and strip simple HTML tags from BGG descriptions. */
export function stripHtmlToText(html: unknown): string | null {
  if (html == null) return null;
  const asString = toDecodableString(html);
  if (!asString.trim()) return null;
  const decoded = decodeHtmlEntities(asString);
  const withoutTags = decoded
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return withoutTags || null;
}
