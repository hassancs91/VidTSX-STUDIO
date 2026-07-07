import { useCurrentFrame, spring, useVideoConfig } from "remotion";

export const compositionConfig = {
  id: 'TestComposition',
  durationInSeconds: 5,
  fps: 30,
  width: 1920,
  height: 1080,
};

export default function TestComposition() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 10 },
  });

  const opacity = spring({
    frame,
    fps,
    config: { damping: 20 },
    delay: 10,
  });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1a1a1e",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          width: 200,
          height: 200,
          backgroundColor: "#7F77DD",
          borderRadius: 20,
          transform: `scale(${scale})`,
          opacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 20px 60px rgba(127, 119, 221, 0.3)",
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: 24,
            fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          VidTSX
        </span>
      </div>
    </div>
  );
}
