// The multilingual-e5 input prefixes (S1 report §9 / §14): a query is embedded as "query: <text>", a library item as
// "passage: <item text>". Bump PREFIX_VERSION when this changes — the vector file's header carries it, and a
// mismatch rebuilds every vector (LIBRARY_SEARCH_DESIGN.md §5).

export const PREFIX_VERSION = 1;

export function queryText(query: string): string {
  return `query: ${query}`;
}

export function passageText(itemText: string): string {
  return `passage: ${itemText}`;
}
