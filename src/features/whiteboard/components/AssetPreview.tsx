import type { DrawableAsset } from '../types';

interface Props {
  asset: DrawableAsset;
  size?: number;
  stroke?: string;
}

export function AssetPreview({ asset, size = 64, stroke = '#1a1a1a' }: Props) {
  const resolvedStroke = asset.strokeColor ?? stroke;
  const strokeWidth = asset.strokeWidth ?? 2;
  return (
    <svg
      viewBox={asset.viewBox}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      {asset.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={resolvedStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
