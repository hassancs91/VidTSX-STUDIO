export const TEMPLATE_TAGS = [
  // Format / structure
  'intro',
  'outro',
  'transition',
  'lower-third',
  'logo-reveal',
  // Medium
  '2d',
  '3d',
  // Style
  'cartoon',
  'minimal',
  'bold',
  'retro',
  'neon',
  'cinematic',
  'whiteboard',
  'sketch',
  // Content / format
  'tutorial',
  'explainer',
  'ad',
  'meme',
  'podcast',
  'news',
  'product-demo',
  'trailer',
  'announcement',
  // Niche / use case
  'coding',
  'gaming',
  'social-media',
  'marketing',
  'education',
  'finance',
  'fitness',
  'real-estate',
  'ai-tech',
  'saas',
  'ecommerce',
] as const;

export type TemplateTag = (typeof TEMPLATE_TAGS)[number];
