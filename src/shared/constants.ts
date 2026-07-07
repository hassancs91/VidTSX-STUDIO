// CDN Configuration for external package loading
export const CDN_CONFIG = {
  BASE_URL: 'https://esm.sh',
  REACT_VERSION: '19.0.0',
} as const;

// Known package versions for deterministic builds
// These are pinned versions that have been tested to work with the app
export const KNOWN_PACKAGE_VERSIONS: Record<string, string> = {
  // 3D graphics
  'three': '0.162.0',
  '@react-three/fiber': '8.15.19',
  '@react-three/drei': '9.96.5',
  '@react-three/postprocessing': '2.16.2',

  // Audio synthesis
  'tone': '15.1.22',

  // Animation
  'gsap': '3.12.5',
  'motion': '11.0.0',
  'framer-motion': '11.0.0',
  'lottie-web': '5.12.2',
  '@lottiefiles/react-lottie-player': '3.5.4',

  // Remotion extras
  '@remotion/animated-emoji': '4.0.435',
  '@remotion/paths': '4.0.435',
  '@remotion/shapes': '4.0.435',
  '@remotion/noise': '4.0.435',
  '@remotion/lottie': '4.0.435',
  '@remotion/gif': '4.0.435',
  '@remotion/three': '4.0.435',
  '@remotion/transitions': '4.0.435',
  '@remotion/google-fonts': '4.0.435',
  '@remotion/media-utils': '4.0.435',

  // Utilities
  'lodash': '4.17.21',
  'lodash-es': '4.17.21',
  'date-fns': '3.3.1',
  'zod': '3.22.4',
  'chroma-js': '2.4.2',

  // Maps
  'react-simple-maps': '3.0.0',
};

// Packages that are handled via virtual modules (not CDN)
export const VIRTUAL_PACKAGES = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'remotion',
]);
