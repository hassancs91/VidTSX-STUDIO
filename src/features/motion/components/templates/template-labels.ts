/** `animated-data` → `Animated data`. A category is a slug in the manifest. */
export function categoryLabel(slug: string): string {
  const words = slug.replace(/-/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Other';
}
