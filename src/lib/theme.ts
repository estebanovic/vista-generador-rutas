/** Color real de un token CSS, para lo que no acepta `var()` (Leaflet). */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
