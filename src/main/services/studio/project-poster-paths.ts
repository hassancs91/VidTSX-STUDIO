/** `<project>/cache/poster.jpg` — cache-relative, so the renderer reads it
 *  through STUDIO_CACHE_READ exactly like an asset thumbnail. Its own module
 *  because the store (listing) and the poster writer both need it and the
 *  writer imports the store. */
export const POSTER_REL_PATH = 'poster.jpg';
