import type { LibraryAsset } from '../types';

const VIEW_BOX = '0 0 200 200';

const SHAPES: LibraryAsset[] = [
  {
    id: 'lib-circle',
    name: 'Circle',
    category: 'shapes',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      'M 100 30 A 70 70 0 0 1 100 170 A 70 70 0 0 1 100 30',
    ],
  },
  {
    id: 'lib-square',
    name: 'Square',
    category: 'shapes',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      'M 40 40 L 160 40 L 160 160 L 40 160 Z',
    ],
  },
  {
    id: 'lib-triangle',
    name: 'Triangle',
    category: 'shapes',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      'M 100 30 L 170 170 L 30 170 Z',
    ],
  },
  {
    id: 'lib-star',
    name: 'Star',
    category: 'shapes',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      'M 100 30 L 121 78 L 174 84 L 134 119 L 144 172 L 100 145 L 56 172 L 66 119 L 26 84 L 79 78 Z',
    ],
  },
];

const NATURE: LibraryAsset[] = [
  {
    id: 'lib-tree',
    name: 'Tree',
    category: 'nature',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Trunk
      'M 90 180 L 90 130 L 110 130 L 110 180',
      // Foliage outline
      'M 90 130 C 50 130 30 100 50 80 C 35 60 60 35 90 45 C 100 25 130 30 140 50 C 170 50 175 85 155 100 C 170 120 140 140 110 130',
      // Branch hint
      'M 100 130 L 100 95',
    ],
  },
  {
    id: 'lib-sun',
    name: 'Sun',
    category: 'nature',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Sun body
      'M 100 70 A 30 30 0 0 1 100 130 A 30 30 0 0 1 100 70',
      // Rays (drawn one by one)
      'M 100 50 L 100 30',
      'M 130 100 L 150 100',
      'M 100 130 L 100 150',
      'M 70 100 L 50 100',
      'M 121 79 L 135 65',
      'M 121 121 L 135 135',
      'M 79 121 L 65 135',
      'M 79 79 L 65 65',
    ],
  },
  {
    id: 'lib-cloud',
    name: 'Cloud',
    category: 'nature',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      'M 50 130 C 30 130 25 110 45 100 C 40 80 70 70 80 90 C 90 70 130 70 140 95 C 165 90 175 120 155 130 Z',
    ],
  },
  {
    id: 'lib-mountain',
    name: 'Mountain',
    category: 'nature',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Outline (left peak, dip, right peak, baseline back)
      'M 20 160 L 70 80 L 100 120 L 140 60 L 180 160 Z',
      // Left snow cap
      'M 60 90 L 70 80 L 80 90',
      // Right snow cap
      'M 130 70 L 140 60 L 150 70',
    ],
  },
];

const OBJECTS: LibraryAsset[] = [
  {
    id: 'lib-house',
    name: 'House',
    category: 'objects',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Roof
      'M 30 100 L 100 30 L 170 100',
      // Walls + floor
      'M 30 100 L 30 170 L 170 170 L 170 100',
      // Door
      'M 90 170 L 90 130 L 110 130 L 110 170',
      // Left window
      'M 50 115 L 50 135 L 70 135 L 70 115 Z',
      'M 60 115 L 60 135 M 50 125 L 70 125',
      // Right window
      'M 130 115 L 130 135 L 150 135 L 150 115 Z',
      'M 140 115 L 140 135 M 130 125 L 150 125',
    ],
  },
  {
    id: 'lib-lightbulb',
    name: 'Lightbulb',
    category: 'objects',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Bulb outline
      'M 100 30 C 70 30 50 55 50 80 C 50 105 70 120 80 130 L 80 145 L 120 145 L 120 130 C 130 120 150 105 150 80 C 150 55 130 30 100 30 Z',
      // Filament
      'M 90 100 L 100 80 L 110 100',
      // Base ridges
      'M 80 152 L 120 152',
      'M 85 162 L 115 162',
      'M 90 172 L 110 172',
    ],
  },
  {
    id: 'lib-book',
    name: 'Book',
    category: 'objects',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Spine
      'M 100 50 L 100 160',
      // Left cover
      'M 100 50 C 80 45 50 45 30 60 L 30 160 C 50 145 80 145 100 160',
      // Right cover
      'M 100 50 C 120 45 150 45 170 60 L 170 160 C 150 145 120 145 100 160',
    ],
  },
];

const ARROWS: LibraryAsset[] = [
  {
    id: 'lib-arrow-right',
    name: 'Arrow Right',
    category: 'arrows',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      'M 30 100 L 160 100',
      'M 130 75 L 170 100 L 130 125',
    ],
  },
  {
    id: 'lib-arrow-down',
    name: 'Arrow Down',
    category: 'arrows',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      'M 100 30 L 100 160',
      'M 75 130 L 100 170 L 125 130',
    ],
  },
];

const PEOPLE: LibraryAsset[] = [
  {
    id: 'lib-stick-figure',
    name: 'Stick Figure',
    category: 'people',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Head
      'M 100 30 A 18 18 0 0 1 100 66 A 18 18 0 0 1 100 30',
      // Body
      'M 100 66 L 100 130',
      // Arms
      'M 60 90 L 100 90 L 140 90',
      // Legs
      'M 70 170 L 100 130 L 130 170',
    ],
  },
  {
    id: 'lib-head',
    name: 'Head',
    category: 'people',
    viewBox: VIEW_BOX,
    revealMode: 'draw',
    strokeWidth: 2,
    paths: [
      // Face outline
      'M 100 35 A 60 60 0 0 1 100 155 A 60 60 0 0 1 100 35',
      // Left eye
      'M 80 85 L 80 100',
      // Right eye
      'M 120 85 L 120 100',
      // Smile
      'M 75 115 Q 100 145 125 115',
    ],
  },
];

export const LIBRARY_ASSETS: LibraryAsset[] = [
  ...SHAPES,
  ...NATURE,
  ...OBJECTS,
  ...ARROWS,
  ...PEOPLE,
];

export function findLibraryAsset(id: string): LibraryAsset | undefined {
  return LIBRARY_ASSETS.find((a) => a.id === id);
}
