/** Minimal class name joiner. Avoids a dependency for a five-line utility. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
