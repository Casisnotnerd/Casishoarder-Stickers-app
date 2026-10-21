/** Title guess for bulk add: the first readable line that looks like a name (2+ letters, not a handle or price). */
export function guessTitle(text: string): string {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('@')) continue;
    if (/^[\d\s.,$₩S]+$/.test(line)) continue;
    if ((line.match(/\p{L}/gu) ?? []).length < 2) continue;
    return line.length > 60 ? line.slice(0, 60) : line;
  }
  return '';
}
