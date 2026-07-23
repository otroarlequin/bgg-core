export function sqlNull<T>(value: T | null | undefined): T | null {
  return value ?? null;
}
