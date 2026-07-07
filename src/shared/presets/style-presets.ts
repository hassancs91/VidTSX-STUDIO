export interface StylePreset {
  id: string;
  label: string;
  promptSuffix: string;
}

export type AspectRatioPreset = '1:1' | '16:9' | '9:16' | '4:3' | '3:2';

export interface ContentPreset {
  id: string;
  label: string;
  aspectRatio: AspectRatioPreset;
  promptSuffix: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  { id: 'zombie', label: 'Zombie', promptSuffix: 'zombie style, undead, decaying flesh, horror aesthetic' },
  { id: 'old-person', label: 'Aged', promptSuffix: 'elderly person, wrinkled skin, gray hair, aged appearance' },
  { id: 'cartoon', label: 'Cartoon', promptSuffix: 'cartoon style, animated, bold outlines, vibrant colors' },
  { id: 'anime', label: 'Anime', promptSuffix: 'anime style, Japanese animation, large eyes, detailed' },
  { id: 'watercolor', label: 'Watercolor', promptSuffix: 'watercolor painting, soft edges, paint strokes, artistic' },
  { id: 'pixel-art', label: 'Pixel Art', promptSuffix: 'pixel art style, 8-bit, retro gaming aesthetic' },
  { id: 'oil-painting', label: 'Oil Paint', promptSuffix: 'oil painting on canvas, thick brushstrokes, classical art' },
  { id: 'pencil-sketch', label: 'Sketch', promptSuffix: 'pencil sketch, hand-drawn, graphite on paper' },
  { id: 'cyberpunk', label: 'Cyberpunk', promptSuffix: 'cyberpunk style, neon lights, futuristic city, dystopian' },
  { id: 'fantasy', label: 'Fantasy', promptSuffix: 'fantasy art, magical, ethereal lighting, epic scene' },
  { id: '3d-render', label: '3D', promptSuffix: '3D render, realistic materials, studio lighting, octane render' },
  { id: 'pop-art', label: 'Pop Art', promptSuffix: 'pop art style, bold colors, halftone dots, Andy Warhol inspired' },
  { id: 'vintage-photo', label: 'Vintage', promptSuffix: 'vintage photograph, sepia tone, film grain, retro' },
];

export const CONTENT_PRESETS: ContentPreset[] = [
  { id: 'youtube-thumb', label: 'YT Thumbnail', aspectRatio: '16:9', promptSuffix: 'cinematic composition, bold text area, vibrant colors, high contrast' },
  { id: 'portrait', label: 'Portrait', aspectRatio: '3:2', promptSuffix: 'subject centered, soft lighting, shallow depth of field, natural tones' },
  { id: 'instagram-post', label: 'IG Post', aspectRatio: '1:1', promptSuffix: 'centered composition, aesthetic framing, balanced negative space' },
  { id: 'instagram-story', label: 'IG Story', aspectRatio: '9:16', promptSuffix: 'vertical layout, text-safe zone at bottom, full-bleed visuals' },
  { id: 'product-shot', label: 'Product', aspectRatio: '1:1', promptSuffix: 'clean white background, studio lighting, sharp details, commercial quality' },
  { id: 'landscape', label: 'Landscape', aspectRatio: '16:9', promptSuffix: 'panoramic, epic scale, detailed environment, immersive atmosphere' },
  { id: 'avatar', label: 'Avatar', aspectRatio: '1:1', promptSuffix: 'face focused, clean background, symmetrical, professional' },
  { id: 'logo', label: 'Logo', aspectRatio: '1:1', promptSuffix: 'centered logo, minimal, transparent background feel, vector-style' },
  { id: 'comic', label: 'Comic', aspectRatio: '4:3', promptSuffix: 'bold outlines, narrative scene, dramatic angle, dynamic composition' },
  { id: 'book-cover', label: 'Book Cover', aspectRatio: '3:2', promptSuffix: 'title space at top, dramatic composition, genre-appropriate mood' },
];
