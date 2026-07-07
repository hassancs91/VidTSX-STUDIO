import * as __EXT_three from "/vendor/three.js";
import * as __EXT__react_three_fiber from "/vendor/react-three-fiber.js";

// node_modules/@remotion/three/dist/esm/index.mjs
import { Canvas, useThree } from "/vendor/react-three-fiber.js";
import {
  useCallback,
  useEffect,
  useLayoutEffect as useLayoutEffect2,
  useRef,
  useState
} from "/virtual/react.js";
import {
  Internals,
  useCurrentFrame,
  useDelayRender as useDelayRender2,
  useRemotionEnvironment
} from "/virtual/remotion.js";
import { Suspense, useLayoutEffect } from "/virtual/react.js";
import { useDelayRender } from "/virtual/remotion.js";
import { jsx } from "/virtual/react.js/jsx-runtime";
import { NoReactInternals } from "/virtual/remotion.js/no-react";
import { jsx as jsx2, jsxs } from "/virtual/react.js/jsx-runtime";
import { useCallback as useCallback2, useLayoutEffect as useLayoutEffect3, useMemo, useState as useState2 } from "/virtual/react.js";
import {
  Internals as Internals2,
  useCurrentFrame as useCurrentFrame2,
  useDelayRender as useDelayRender3,
  useRemotionEnvironment as useRemotionEnvironment2,
  useVideoConfig
} from "/virtual/remotion.js";
import { NoReactInternals as NoReactInternals2 } from "/virtual/remotion.js/no-react";
import React3, { useCallback as useCallback3, useEffect as useEffect2, useState as useState3 } from "/virtual/react.js";
import {
  useCurrentFrame as useCurrentFrame3,
  useDelayRender as useDelayRender4,
  useRemotionEnvironment as useRemotionEnvironment3
} from "/virtual/remotion.js";
var Unblocker = () => {
  const { delayRender, continueRender } = useDelayRender();
  if (typeof document !== "undefined") {
    useLayoutEffect(() => {
      const handle = delayRender(`Waiting for <Suspense /> of <ThreeCanvas /> to resolve`);
      return () => {
        continueRender(handle);
      };
    }, [continueRender, delayRender]);
  }
  return null;
};
var SuspenseLoader = ({ children }) => {
  return /* @__PURE__ */ jsx(Suspense, {
    fallback: /* @__PURE__ */ jsx(Unblocker, {}),
    children
  });
};
var validateDimension = NoReactInternals.validateDimension;
var Scale = ({
  width,
  height
}) => {
  const { set, setSize: threeSetSize } = useThree();
  const [setSize] = useState(() => threeSetSize);
  useLayoutEffect2(() => {
    setSize(width, height);
    set({ setSize: () => null });
    return () => set({ setSize });
  }, [setSize, width, height, set]);
  return null;
};
var ManualFrameRenderer = ({
  onRendered
}) => {
  const { advance } = useThree();
  const frame = useCurrentFrame();
  useEffect(() => {
    advance(performance.now());
    onRendered();
  }, [frame, advance, onRendered]);
  return null;
};
var ThreeCanvas = (props) => {
  const { children, width, height, style, frameloop, onCreated, ...rest } = props;
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender } = useDelayRender2();
  const contexts = Internals.useRemotionContexts();
  const frame = useCurrentFrame();
  const [waitForCreated] = useState(() => delayRender("Waiting for <ThreeCanvas/> to be created"));
  const frameDelayHandle = useRef(null);
  validateDimension(width, "width", "of the <ThreeCanvas /> component");
  validateDimension(height, "height", "of the <ThreeCanvas /> component");
  const actualStyle = {
    width,
    height,
    ...style
  };
  const remotion_onCreated = useCallback((state) => {
    if (isRendering) {
      state.advance(performance.now());
    }
    continueRender(waitForCreated);
    onCreated?.(state);
  }, [onCreated, waitForCreated, continueRender, isRendering]);
  useLayoutEffect2(() => {
    if (!isRendering || frame === 0) {
      return;
    }
    frameDelayHandle.current = delayRender(`Waiting for R3F to render frame ${frame}`);
    return () => {
      if (frameDelayHandle.current !== null) {
        continueRender(frameDelayHandle.current);
      }
    };
  }, [frame, isRendering, delayRender, continueRender]);
  const handleRendered = useCallback(() => {
    if (frameDelayHandle.current !== null) {
      continueRender(frameDelayHandle.current);
      frameDelayHandle.current = null;
    }
  }, [continueRender]);
  return /* @__PURE__ */ jsx2(SuspenseLoader, {
    children: /* @__PURE__ */ jsxs(Canvas, {
      style: actualStyle,
      ...rest,
      frameloop: isRendering ? "never" : frameloop ?? "always",
      onCreated: remotion_onCreated,
      children: [
        /* @__PURE__ */ jsx2(Scale, {
          width,
          height
        }),
        /* @__PURE__ */ jsxs(Internals.RemotionContextProvider, {
          contexts,
          children: [
            isRendering && /* @__PURE__ */ jsx2(ManualFrameRenderer, {
              onRendered: handleRendered
            }),
            children
          ]
        })
      ]
    })
  });
};
var useInnerVideoTexture = ({
  playbackRate,
  src,
  transparent,
  toneMapped,
  delayRenderRetries,
  delayRenderTimeoutInMilliseconds
}) => {
  const frame = useCurrentFrame2();
  const { fps } = useVideoConfig();
  const mediaStartsAt = Internals2.useMediaStartsAt();
  const currentTime = useMemo(() => {
    return NoReactInternals2.getExpectedMediaFrameUncorrected({
      frame,
      playbackRate,
      startFrom: -mediaStartsAt
    }) / fps;
  }, [frame, playbackRate, mediaStartsAt, fps]);
  const offthreadVideoFrameSrc = useMemo(() => {
    return NoReactInternals2.getOffthreadVideoSource({
      currentTime,
      src,
      transparent,
      toneMapped
    });
  }, [toneMapped, currentTime, src, transparent]);
  const [textLoaderPromise] = useState2(() => import("/vendor/three.js"));
  const [imageTexture, setImageTexture] = useState2(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender3();
  const fetchTexture = useCallback2(() => {
    const imageTextureHandle = delayRender("fetch offthread video frame", {
      retries: delayRenderRetries ?? void 0,
      timeoutInMilliseconds: delayRenderTimeoutInMilliseconds ?? void 0
    });
    let textureLoaded = null;
    let cleanedUp = false;
    textLoaderPromise.then((loader) => {
      new loader.TextureLoader().loadAsync(offthreadVideoFrameSrc).then((texture) => {
        textureLoaded = texture;
        if (cleanedUp) {
          return;
        }
        setImageTexture(texture);
        continueRender(imageTextureHandle);
      }).catch((err) => {
        cancelRender(err);
      });
    });
    return () => {
      cleanedUp = true;
      textureLoaded?.dispose();
      continueRender(imageTextureHandle);
    };
  }, [
    offthreadVideoFrameSrc,
    textLoaderPromise,
    delayRenderRetries,
    delayRenderTimeoutInMilliseconds,
    continueRender,
    delayRender,
    cancelRender
  ]);
  useLayoutEffect3(() => {
    const cleanup = fetchTexture();
    return () => {
      cleanup();
    };
  }, [offthreadVideoFrameSrc, fetchTexture]);
  return imageTexture;
};
function useOffthreadVideoTexture({
  src,
  playbackRate = 1,
  transparent = false,
  toneMapped = true,
  delayRenderRetries,
  delayRenderTimeoutInMilliseconds
}) {
  if (!src) {
    throw new Error("src must be provided to useOffthreadVideoTexture");
  }
  const env = useRemotionEnvironment2();
  const { isRendering, isClientSideRendering } = env;
  if (isClientSideRendering) {
    throw new Error("useOffthreadVideoTexture() cannot be used in client-side rendering.");
  }
  if (!isRendering) {
    throw new Error("useOffthreadVideoTexture() can only be used during rendering. Use useRemotionEnvironment().isRendering to render it conditionally.");
  }
  return useInnerVideoTexture({
    playbackRate,
    src,
    transparent,
    toneMapped,
    delayRenderRetries,
    delayRenderTimeoutInMilliseconds
  });
}
var warned = false;
var warnAboutRequestVideoFrameCallback = () => {
  if (warned) {
    return false;
  }
  warned = true;
  console.warn("Browser does not support requestVideoFrameCallback. Cannot display video.");
};
var useVideoTexture = (videoRef) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender4();
  const [loaded] = useState3(() => {
    if (typeof document === "undefined") {
      return 0;
    }
    return delayRender(`Waiting for texture in useVideoTexture() to be loaded`);
  });
  const environment = useRemotionEnvironment3();
  const { isClientSideRendering } = environment;
  if (isClientSideRendering) {
    throw new Error("useVideoTexture() cannot be used in client side rendering.");
  }
  const [videoTexture, setVideoTexture] = useState3(null);
  const [vidText] = useState3(() => import("/vendor/three.js"));
  const frame = useCurrentFrame3();
  const onReady = useCallback3(() => {
    vidText.then(({ VideoTexture }) => {
      if (!videoRef.current) {
        throw new Error("Video not ready");
      }
      const vt = new VideoTexture(videoRef.current);
      videoRef.current.width = videoRef.current.videoWidth;
      videoRef.current.height = videoRef.current.videoHeight;
      setVideoTexture(vt);
      continueRender(loaded);
    }).catch((err) => {
      cancelRender(err);
    });
  }, [loaded, vidText, videoRef, continueRender, cancelRender]);
  React3.useLayoutEffect(() => {
    if (!videoRef.current) {
      return;
    }
    if (videoRef.current.readyState >= 2) {
      onReady();
      return;
    }
    videoRef.current.addEventListener("loadeddata", () => {
      onReady();
    }, { once: true });
  }, [loaded, onReady, videoRef]);
  React3.useEffect(() => {
    const { current } = videoRef;
    if (!current) {
      return;
    }
    if (!current.requestVideoFrameCallback) {
      warnAboutRequestVideoFrameCallback();
      return;
    }
    const ready = () => {
    };
    current.requestVideoFrameCallback(ready);
  }, [frame, loaded, videoRef]);
  useEffect2(() => {
    return () => {
      continueRender(loaded);
    };
  }, [loaded, continueRender]);
  if (typeof HTMLVideoElement === "undefined" || !HTMLVideoElement.prototype.requestVideoFrameCallback) {
    continueRender(loaded);
    return null;
  }
  return videoTexture;
};
var useOffthreadVideoTexture2 = useOffthreadVideoTexture;
var useVideoTexture2 = useVideoTexture;
export {
  ThreeCanvas,
  useOffthreadVideoTexture2 as useOffthreadVideoTexture,
  useVideoTexture2 as useVideoTexture
};
