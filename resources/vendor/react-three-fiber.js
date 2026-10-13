import * as __EXT_three from "/vendor/three.js";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = (id) => {
  switch (id) {
    case "react": return window.__VIDTSX_REACT__;
    case "react-dom": return window.__VIDTSX_REACT_DOM__;
    case "remotion": return window.__VIDTSX_REMOTION__;
    case "three": return __EXT_three;
  }
  throw new Error('Dynamic require of "' + id + '" is not supported');
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
var require_use_sync_external_store_shim_production = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js"(exports) {
    "use strict";
    var React4 = __require("react");
    function is2(x2, y) {
      return x2 === y && (0 !== x2 || 1 / x2 === 1 / y) || x2 !== x2 && y !== y;
    }
    var objectIs = "function" === typeof Object.is ? Object.is : is2;
    var useState4 = React4.useState;
    var useEffect4 = React4.useEffect;
    var useLayoutEffect3 = React4.useLayoutEffect;
    var useDebugValue = React4.useDebugValue;
    function useSyncExternalStore$2(subscribe, getSnapshot) {
      var value = getSnapshot(), _useState = useState4({ inst: { value, getSnapshot } }), inst = _useState[0].inst, forceUpdate = _useState[1];
      useLayoutEffect3(
        function() {
          inst.value = value;
          inst.getSnapshot = getSnapshot;
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
        },
        [subscribe, value, getSnapshot]
      );
      useEffect4(
        function() {
          checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          return subscribe(function() {
            checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          });
        },
        [subscribe]
      );
      useDebugValue(value);
      return value;
    }
    function checkIfSnapshotChanged(inst) {
      var latestGetSnapshot = inst.getSnapshot;
      inst = inst.value;
      try {
        var nextValue = latestGetSnapshot();
        return !objectIs(inst, nextValue);
      } catch (error) {
        return true;
      }
    }
    function useSyncExternalStore$1(subscribe, getSnapshot) {
      return getSnapshot();
    }
    var shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
    exports.useSyncExternalStore = void 0 !== React4.useSyncExternalStore ? React4.useSyncExternalStore : shim;
  }
});

// node_modules/use-sync-external-store/shim/index.js
var require_shim = __commonJS({
  "node_modules/use-sync-external-store/shim/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_use_sync_external_store_shim_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
var require_with_selector_production = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js"(exports) {
    "use strict";
    var React4 = __require("react");
    var shim = require_shim();
    function is2(x2, y) {
      return x2 === y && (0 !== x2 || 1 / x2 === 1 / y) || x2 !== x2 && y !== y;
    }
    var objectIs = "function" === typeof Object.is ? Object.is : is2;
    var useSyncExternalStore = shim.useSyncExternalStore;
    var useRef4 = React4.useRef;
    var useEffect4 = React4.useEffect;
    var useMemo4 = React4.useMemo;
    var useDebugValue = React4.useDebugValue;
    exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
      var instRef = useRef4(null);
      if (null === instRef.current) {
        var inst = { hasValue: false, value: null };
        instRef.current = inst;
      } else inst = instRef.current;
      instRef = useMemo4(
        function() {
          function memoizedSelector(nextSnapshot) {
            if (!hasMemo) {
              hasMemo = true;
              memoizedSnapshot = nextSnapshot;
              nextSnapshot = selector(nextSnapshot);
              if (void 0 !== isEqual && inst.hasValue) {
                var currentSelection = inst.value;
                if (isEqual(currentSelection, nextSnapshot))
                  return memoizedSelection = currentSelection;
              }
              return memoizedSelection = nextSnapshot;
            }
            currentSelection = memoizedSelection;
            if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
            var nextSelection = selector(nextSnapshot);
            if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
              return memoizedSnapshot = nextSnapshot, currentSelection;
            memoizedSnapshot = nextSnapshot;
            return memoizedSelection = nextSelection;
          }
          var hasMemo = false, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
          return [
            function() {
              return memoizedSelector(getSnapshot());
            },
            null === maybeGetServerSnapshot ? void 0 : function() {
              return memoizedSelector(maybeGetServerSnapshot());
            }
          ];
        },
        [getSnapshot, getServerSnapshot, selector, isEqual]
      );
      var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
      useEffect4(
        function() {
          inst.hasValue = true;
          inst.value = value;
        },
        [value]
      );
      useDebugValue(value);
      return value;
    };
  }
});

// node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = __commonJS({
  "node_modules/use-sync-external-store/shim/with-selector.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_with_selector_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/scheduler/cjs/scheduler.production.js
var require_scheduler_production = __commonJS({
  "node_modules/scheduler/cjs/scheduler.production.js"(exports) {
    "use strict";
    function push(heap, node) {
      var index = heap.length;
      heap.push(node);
      a: for (; 0 < index; ) {
        var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
        if (0 < compare(parent, node))
          heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
        else break a;
      }
    }
    function peek(heap) {
      return 0 === heap.length ? null : heap[0];
    }
    function pop(heap) {
      if (0 === heap.length) return null;
      var first = heap[0], last = heap.pop();
      if (last !== first) {
        heap[0] = last;
        a: for (var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength; ) {
          var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
          if (0 > compare(left, last))
            rightIndex < length && 0 > compare(right, left) ? (heap[index] = right, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left, heap[leftIndex] = last, index = leftIndex);
          else if (rightIndex < length && 0 > compare(right, last))
            heap[index] = right, heap[rightIndex] = last, index = rightIndex;
          else break a;
        }
      }
      return first;
    }
    function compare(a2, b2) {
      var diff = a2.sortIndex - b2.sortIndex;
      return 0 !== diff ? diff : a2.id - b2.id;
    }
    exports.unstable_now = void 0;
    if ("object" === typeof performance && "function" === typeof performance.now) {
      localPerformance = performance;
      exports.unstable_now = function() {
        return localPerformance.now();
      };
    } else {
      localDate = Date, initialTime = localDate.now();
      exports.unstable_now = function() {
        return localDate.now() - initialTime;
      };
    }
    var localPerformance;
    var localDate;
    var initialTime;
    var taskQueue = [];
    var timerQueue = [];
    var taskIdCounter = 1;
    var currentTask = null;
    var currentPriorityLevel = 3;
    var isPerformingWork = false;
    var isHostCallbackScheduled = false;
    var isHostTimeoutScheduled = false;
    var needsPaint = false;
    var localSetTimeout = "function" === typeof setTimeout ? setTimeout : null;
    var localClearTimeout = "function" === typeof clearTimeout ? clearTimeout : null;
    var localSetImmediate = "undefined" !== typeof setImmediate ? setImmediate : null;
    function advanceTimers(currentTime) {
      for (var timer = peek(timerQueue); null !== timer; ) {
        if (null === timer.callback) pop(timerQueue);
        else if (timer.startTime <= currentTime)
          pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
        else break;
        timer = peek(timerQueue);
      }
    }
    function handleTimeout(currentTime) {
      isHostTimeoutScheduled = false;
      advanceTimers(currentTime);
      if (!isHostCallbackScheduled)
        if (null !== peek(taskQueue))
          isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline());
        else {
          var firstTimer = peek(timerQueue);
          null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
        }
    }
    var isMessageLoopRunning = false;
    var taskTimeoutID = -1;
    var frameInterval = 5;
    var startTime = -1;
    function shouldYieldToHost() {
      return needsPaint ? true : exports.unstable_now() - startTime < frameInterval ? false : true;
    }
    function performWorkUntilDeadline() {
      needsPaint = false;
      if (isMessageLoopRunning) {
        var currentTime = exports.unstable_now();
        startTime = currentTime;
        var hasMoreWork = true;
        try {
          a: {
            isHostCallbackScheduled = false;
            isHostTimeoutScheduled && (isHostTimeoutScheduled = false, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
            isPerformingWork = true;
            var previousPriorityLevel = currentPriorityLevel;
            try {
              b: {
                advanceTimers(currentTime);
                for (currentTask = peek(taskQueue); null !== currentTask && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
                  var callback = currentTask.callback;
                  if ("function" === typeof callback) {
                    currentTask.callback = null;
                    currentPriorityLevel = currentTask.priorityLevel;
                    var continuationCallback = callback(
                      currentTask.expirationTime <= currentTime
                    );
                    currentTime = exports.unstable_now();
                    if ("function" === typeof continuationCallback) {
                      currentTask.callback = continuationCallback;
                      advanceTimers(currentTime);
                      hasMoreWork = true;
                      break b;
                    }
                    currentTask === peek(taskQueue) && pop(taskQueue);
                    advanceTimers(currentTime);
                  } else pop(taskQueue);
                  currentTask = peek(taskQueue);
                }
                if (null !== currentTask) hasMoreWork = true;
                else {
                  var firstTimer = peek(timerQueue);
                  null !== firstTimer && requestHostTimeout(
                    handleTimeout,
                    firstTimer.startTime - currentTime
                  );
                  hasMoreWork = false;
                }
              }
              break a;
            } finally {
              currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = false;
            }
            hasMoreWork = void 0;
          }
        } finally {
          hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = false;
        }
      }
    }
    var schedulePerformWorkUntilDeadline;
    if ("function" === typeof localSetImmediate)
      schedulePerformWorkUntilDeadline = function() {
        localSetImmediate(performWorkUntilDeadline);
      };
    else if ("undefined" !== typeof MessageChannel) {
      channel = new MessageChannel(), port = channel.port2;
      channel.port1.onmessage = performWorkUntilDeadline;
      schedulePerformWorkUntilDeadline = function() {
        port.postMessage(null);
      };
    } else
      schedulePerformWorkUntilDeadline = function() {
        localSetTimeout(performWorkUntilDeadline, 0);
      };
    var channel;
    var port;
    function requestHostTimeout(callback, ms) {
      taskTimeoutID = localSetTimeout(function() {
        callback(exports.unstable_now());
      }, ms);
    }
    exports.unstable_IdlePriority = 5;
    exports.unstable_ImmediatePriority = 1;
    exports.unstable_LowPriority = 4;
    exports.unstable_NormalPriority = 3;
    exports.unstable_Profiling = null;
    exports.unstable_UserBlockingPriority = 2;
    exports.unstable_cancelCallback = function(task) {
      task.callback = null;
    };
    exports.unstable_forceFrameRate = function(fps) {
      0 > fps || 125 < fps ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5;
    };
    exports.unstable_getCurrentPriorityLevel = function() {
      return currentPriorityLevel;
    };
    exports.unstable_next = function(eventHandler) {
      switch (currentPriorityLevel) {
        case 1:
        case 2:
        case 3:
          var priorityLevel = 3;
          break;
        default:
          priorityLevel = currentPriorityLevel;
      }
      var previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = priorityLevel;
      try {
        return eventHandler();
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    };
    exports.unstable_requestPaint = function() {
      needsPaint = true;
    };
    exports.unstable_runWithPriority = function(priorityLevel, eventHandler) {
      switch (priorityLevel) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          priorityLevel = 3;
      }
      var previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = priorityLevel;
      try {
        return eventHandler();
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    };
    exports.unstable_scheduleCallback = function(priorityLevel, callback, options) {
      var currentTime = exports.unstable_now();
      "object" === typeof options && null !== options ? (options = options.delay, options = "number" === typeof options && 0 < options ? currentTime + options : currentTime) : options = currentTime;
      switch (priorityLevel) {
        case 1:
          var timeout = -1;
          break;
        case 2:
          timeout = 250;
          break;
        case 5:
          timeout = 1073741823;
          break;
        case 4:
          timeout = 1e4;
          break;
        default:
          timeout = 5e3;
      }
      timeout = options + timeout;
      priorityLevel = {
        id: taskIdCounter++,
        callback,
        priorityLevel,
        startTime: options,
        expirationTime: timeout,
        sortIndex: -1
      };
      options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), null === peek(taskQueue) && priorityLevel === peek(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = true, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline())));
      return priorityLevel;
    };
    exports.unstable_shouldYield = shouldYieldToHost;
    exports.unstable_wrapCallback = function(callback) {
      var parentPriorityLevel = currentPriorityLevel;
      return function() {
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = parentPriorityLevel;
        try {
          return callback.apply(this, arguments);
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
    };
  }
});

// node_modules/scheduler/index.js
var require_scheduler = __commonJS({
  "node_modules/scheduler/index.js"(exports, module) {
    "use strict";
    if (true) {
      module.exports = require_scheduler_production();
    } else {
      module.exports = null;
    }
  }
});

// node_modules/@react-three/fiber/dist/events-5a94e5eb.esm.js
import * as React2 from "/virtual/react.js";
import React__default from "/virtual/react.js";
import * as THREE from "/vendor/three.js";

// node_modules/zustand/esm/traditional.mjs
var import_with_selector = __toESM(require_with_selector(), 1);
import React from "/virtual/react.js";

// node_modules/zustand/esm/vanilla.mjs
var createStoreImpl = (createState) => {
  let state2;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state2) : partial;
    if (!Object.is(nextState, state2)) {
      const previousState = state2;
      state2 = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state2, nextState);
      listeners.forEach((listener) => listener(state2, previousState));
    }
  };
  const getState = () => state2;
  const getInitialState = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const api = { setState, getState, getInitialState, subscribe };
  const initialState = state2 = createState(setState, getState, api);
  return api;
};
var createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;

// node_modules/zustand/esm/traditional.mjs
var { useSyncExternalStoreWithSelector } = import_with_selector.default;
var identity = (arg) => arg;
function useStoreWithEqualityFn(api, selector = identity, equalityFn) {
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getInitialState,
    selector,
    equalityFn
  );
  React.useDebugValue(slice);
  return slice;
}
var createWithEqualityFnImpl = (createState, defaultEqualityFn) => {
  const api = createStore(createState);
  const useBoundStoreWithEqualityFn = (selector, equalityFn = defaultEqualityFn) => useStoreWithEqualityFn(api, selector, equalityFn);
  Object.assign(useBoundStoreWithEqualityFn, api);
  return useBoundStoreWithEqualityFn;
};
var createWithEqualityFn = (createState, defaultEqualityFn) => createState ? createWithEqualityFnImpl(createState, defaultEqualityFn) : createWithEqualityFnImpl;

// node_modules/suspend-react/index.js
var isPromise = (promise) => typeof promise === "object" && typeof promise.then === "function";
var globalCache = [];
function shallowEqualArrays(arrA, arrB, equal = (a2, b2) => a2 === b2) {
  if (arrA === arrB) return true;
  if (!arrA || !arrB) return false;
  const len = arrA.length;
  if (arrB.length !== len) return false;
  for (let i3 = 0; i3 < len; i3++) if (!equal(arrA[i3], arrB[i3])) return false;
  return true;
}
function query(fn, keys = null, preload2 = false, config = {}) {
  if (keys === null) keys = [fn];
  for (const entry2 of globalCache) {
    if (shallowEqualArrays(keys, entry2.keys, entry2.equal)) {
      if (preload2) return void 0;
      if (Object.prototype.hasOwnProperty.call(entry2, "error")) throw entry2.error;
      if (Object.prototype.hasOwnProperty.call(entry2, "response")) {
        if (config.lifespan && config.lifespan > 0) {
          if (entry2.timeout) clearTimeout(entry2.timeout);
          entry2.timeout = setTimeout(entry2.remove, config.lifespan);
        }
        return entry2.response;
      }
      if (!preload2) throw entry2.promise;
    }
  }
  const entry = {
    keys,
    equal: config.equal,
    remove: () => {
      const index = globalCache.indexOf(entry);
      if (index !== -1) globalCache.splice(index, 1);
    },
    promise: (
      // Execute the promise
      (isPromise(fn) ? fn : fn(...keys)).then((response) => {
        entry.response = response;
        if (config.lifespan && config.lifespan > 0) {
          entry.timeout = setTimeout(entry.remove, config.lifespan);
        }
      }).catch((error) => entry.error = error)
    )
  };
  globalCache.push(entry);
  if (!preload2) throw entry.promise;
  return void 0;
}
var suspend = (fn, keys, config) => query(fn, keys, false, config);
var preload = (fn, keys, config) => void query(fn, keys, true, config);
var clear = (keys) => {
  if (keys === void 0 || keys.length === 0) globalCache.splice(0, globalCache.length);
  else {
    const entry = globalCache.find((entry2) => shallowEqualArrays(keys, entry2.keys, entry2.equal));
    if (entry) entry.remove();
  }
};

// node_modules/@react-three/fiber/dist/events-5a94e5eb.esm.js
var import_scheduler = __toESM(require_scheduler());
import { jsx, Fragment as Fragment2 } from "/virtual/react.js/jsx-runtime";

// node_modules/its-fine/dist/index.js
import * as o from "/virtual/react.js";
function i(e2, t2, r2) {
  if (!e2) return;
  if (r2(e2) === true) return e2;
  let n = t2 ? e2.return : e2.child;
  for (; n; ) {
    const u2 = i(n, t2, r2);
    if (u2) return u2;
    n = t2 ? null : n.sibling;
  }
}
function l(e2) {
  try {
    return Object.defineProperties(e2, {
      _currentRenderer: {
        get() {
          return null;
        },
        set() {
        }
      },
      _currentRenderer2: {
        get() {
          return null;
        },
        set() {
        }
      }
    });
  } catch (t2) {
    return e2;
  }
}
var a = /* @__PURE__ */ l(/* @__PURE__ */ o.createContext(null));
var m = class extends o.Component {
  render() {
    return /* @__PURE__ */ o.createElement(a.Provider, { value: this._reactInternals }, this.props.children);
  }
};
function c() {
  const e2 = o.useContext(a);
  if (e2 === null) throw new Error("its-fine: useFiber must be called within a <FiberProvider />!");
  const t2 = o.useId();
  return o.useMemo(() => {
    for (const n of [e2, e2 == null ? void 0 : e2.alternate]) {
      if (!n) continue;
      const u2 = i(n, false, (d) => {
        let s = d.memoizedState;
        for (; s; ) {
          if (s.memoizedState === t2) return true;
          s = s.next;
        }
      });
      if (u2) return u2;
    }
  }, [e2, t2]);
}
var p = Symbol.for("react.context");
var b = (e2) => e2 !== null && typeof e2 == "object" && "$$typeof" in e2 && e2.$$typeof === p;
function h() {
  const e2 = c(), [t2] = o.useState(() => /* @__PURE__ */ new Map());
  t2.clear();
  let r2 = e2;
  for (; r2; ) {
    const n = r2.type;
    b(n) && n !== a && !t2.has(n) && t2.set(n, o.use(l(n))), r2 = r2.return;
  }
  return t2;
}
function x() {
  const e2 = h();
  return o.useMemo(
    () => Array.from(e2.keys()).reduce(
      (t2, r2) => (n) => /* @__PURE__ */ o.createElement(t2, null, /* @__PURE__ */ o.createElement(r2.Provider, { ...n, value: e2.get(r2) })),
      (t2) => /* @__PURE__ */ o.createElement(m, { ...t2 })
    ),
    [e2]
  );
}

// node_modules/@react-three/fiber/dist/events-5a94e5eb.esm.js
var threeTypes = /* @__PURE__ */ Object.freeze({
  __proto__: null
});
function findInitialRoot(instance) {
  let root = instance.root;
  while (root.getState().previousRoot) root = root.getState().previousRoot;
  return root;
}
var act2 = React2["act"];
var isOrthographicCamera = (def) => def && def.isOrthographicCamera;
var isRef = (obj) => obj && obj.hasOwnProperty("current");
var isColorRepresentation = (value) => value != null && (typeof value === "string" || typeof value === "number" || value.isColor);
var useIsomorphicLayoutEffect = /* @__PURE__ */ ((_window$document, _window$navigator) => typeof window !== "undefined" && (((_window$document = window.document) == null ? void 0 : _window$document.createElement) || ((_window$navigator = window.navigator) == null ? void 0 : _window$navigator.product) === "ReactNative"))() ? React2.useLayoutEffect : React2.useEffect;
function useMutableCallback(fn) {
  const ref = React2.useRef(fn);
  useIsomorphicLayoutEffect(() => void (ref.current = fn), [fn]);
  return ref;
}
function useBridge() {
  const fiber = c();
  const ContextBridge = x();
  return React2.useMemo(() => ({
    children
  }) => {
    const strict = !!i(fiber, true, (node) => node.type === React2.StrictMode);
    const Root = strict ? React2.StrictMode : React2.Fragment;
    return /* @__PURE__ */ jsx(Root, {
      children: /* @__PURE__ */ jsx(ContextBridge, {
        children
      })
    });
  }, [fiber, ContextBridge]);
}
function Block({
  set
}) {
  useIsomorphicLayoutEffect(() => {
    set(new Promise(() => null));
    return () => set(false);
  }, [set]);
  return null;
}
var ErrorBoundary = /* @__PURE__ */ ((_ErrorBoundary) => (_ErrorBoundary = class ErrorBoundary extends React2.Component {
  constructor(...args) {
    super(...args);
    this.state = {
      error: false
    };
  }
  componentDidCatch(err) {
    this.props.set(err);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}, _ErrorBoundary.getDerivedStateFromError = () => ({
  error: true
}), _ErrorBoundary))();
function calculateDpr(dpr) {
  var _window$devicePixelRa;
  const target = typeof window !== "undefined" ? (_window$devicePixelRa = window.devicePixelRatio) != null ? _window$devicePixelRa : 2 : 1;
  return Array.isArray(dpr) ? Math.min(Math.max(dpr[0], target), dpr[1]) : dpr;
}
function getRootState(obj) {
  var _r3f;
  return (_r3f = obj.__r3f) == null ? void 0 : _r3f.root.getState();
}
var is = {
  obj: (a2) => a2 === Object(a2) && !is.arr(a2) && typeof a2 !== "function",
  fun: (a2) => typeof a2 === "function",
  str: (a2) => typeof a2 === "string",
  num: (a2) => typeof a2 === "number",
  boo: (a2) => typeof a2 === "boolean",
  und: (a2) => a2 === void 0,
  nul: (a2) => a2 === null,
  arr: (a2) => Array.isArray(a2),
  equ(a2, b2, {
    arrays = "shallow",
    objects = "reference",
    strict = true
  } = {}) {
    if (typeof a2 !== typeof b2 || !!a2 !== !!b2) return false;
    if (is.str(a2) || is.num(a2) || is.boo(a2)) return a2 === b2;
    const isObj = is.obj(a2);
    if (isObj && objects === "reference") return a2 === b2;
    const isArr = is.arr(a2);
    if (isArr && arrays === "reference") return a2 === b2;
    if ((isArr || isObj) && a2 === b2) return true;
    let i3;
    for (i3 in a2) if (!(i3 in b2)) return false;
    if (isObj && arrays === "shallow" && objects === "shallow") {
      for (i3 in strict ? b2 : a2) if (!is.equ(a2[i3], b2[i3], {
        strict,
        objects: "reference"
      })) return false;
    } else {
      for (i3 in strict ? b2 : a2) if (a2[i3] !== b2[i3]) return false;
    }
    if (is.und(i3)) {
      if (isArr && a2.length === 0 && b2.length === 0) return true;
      if (isObj && Object.keys(a2).length === 0 && Object.keys(b2).length === 0) return true;
      if (a2 !== b2) return false;
    }
    return true;
  }
};
function buildGraph(object) {
  const data = {
    nodes: {},
    materials: {},
    meshes: {}
  };
  if (object) {
    object.traverse((obj) => {
      if (obj.name) data.nodes[obj.name] = obj;
      if (obj.material && !data.materials[obj.material.name]) data.materials[obj.material.name] = obj.material;
      if (obj.isMesh && !data.meshes[obj.name]) data.meshes[obj.name] = obj;
    });
  }
  return data;
}
function dispose(obj) {
  if (obj.type !== "Scene") obj.dispose == null ? void 0 : obj.dispose();
  for (const p3 in obj) {
    const prop = obj[p3];
    if ((prop == null ? void 0 : prop.type) !== "Scene") prop == null ? void 0 : prop.dispose == null ? void 0 : prop.dispose();
  }
}
var REACT_INTERNAL_PROPS = ["children", "key", "ref"];
function getInstanceProps(pendingProps) {
  const props = {};
  for (const key in pendingProps) {
    if (!REACT_INTERNAL_PROPS.includes(key)) props[key] = pendingProps[key];
  }
  return props;
}
function prepare(target, root, type, props) {
  const object = target;
  let instance = object == null ? void 0 : object.__r3f;
  if (!instance) {
    instance = {
      root,
      type,
      parent: null,
      children: [],
      props: getInstanceProps(props),
      object,
      eventCount: 0,
      handlers: {},
      isHidden: false
    };
    if (object) object.__r3f = instance;
  }
  return instance;
}
function resolve(root, key) {
  if (!key.includes("-")) return {
    root,
    key,
    target: root[key]
  };
  if (key in root) {
    return {
      root,
      key,
      target: root[key]
    };
  }
  let target = root;
  const parts = key.split("-");
  for (const part of parts) {
    if (typeof target !== "object" || target === null) {
      if (target !== void 0) {
        const remaining = parts.slice(parts.indexOf(part)).join("-");
        return {
          root: target,
          key: remaining,
          target: void 0
        };
      }
      return {
        root,
        key,
        target: void 0
      };
    }
    key = part;
    root = target;
    target = target[key];
  }
  return {
    root,
    key,
    target
  };
}
var INDEX_REGEX = /-\d+$/;
function attach(parent, child) {
  if (is.str(child.props.attach)) {
    if (INDEX_REGEX.test(child.props.attach)) {
      const index = child.props.attach.replace(INDEX_REGEX, "");
      const {
        root: root2,
        key: key2
      } = resolve(parent.object, index);
      if (!Array.isArray(root2[key2])) root2[key2] = [];
    }
    const {
      root,
      key
    } = resolve(parent.object, child.props.attach);
    child.previousAttach = root[key];
    root[key] = child.object;
  } else if (is.fun(child.props.attach)) {
    child.previousAttach = child.props.attach(parent.object, child.object);
  }
}
function detach(parent, child) {
  if (is.str(child.props.attach)) {
    const {
      root,
      key
    } = resolve(parent.object, child.props.attach);
    const previous = child.previousAttach;
    if (previous === void 0) delete root[key];
    else root[key] = previous;
  } else {
    child.previousAttach == null ? void 0 : child.previousAttach(parent.object, child.object);
  }
  delete child.previousAttach;
}
var RESERVED_PROPS = [
  ...REACT_INTERNAL_PROPS,
  // Instance props
  "args",
  "dispose",
  "attach",
  "object",
  "onUpdate",
  // Behavior flags
  "dispose"
];
var MEMOIZED_PROTOTYPES = /* @__PURE__ */ new Map();
function getMemoizedPrototype(root) {
  let ctor = MEMOIZED_PROTOTYPES.get(root.constructor);
  try {
    if (!ctor) {
      ctor = new root.constructor();
      MEMOIZED_PROTOTYPES.set(root.constructor, ctor);
    }
  } catch (e2) {
  }
  return ctor;
}
function diffProps(instance, newProps) {
  const changedProps = {};
  for (const prop in newProps) {
    if (RESERVED_PROPS.includes(prop)) continue;
    if (is.equ(newProps[prop], instance.props[prop])) continue;
    changedProps[prop] = newProps[prop];
    for (const other in newProps) {
      if (other.startsWith(`${prop}-`)) changedProps[other] = newProps[other];
    }
  }
  for (const prop in instance.props) {
    if (RESERVED_PROPS.includes(prop) || newProps.hasOwnProperty(prop)) continue;
    const {
      root,
      key
    } = resolve(instance.object, prop);
    if (root.constructor && root.constructor.length === 0) {
      const ctor = getMemoizedPrototype(root);
      if (!is.und(ctor)) changedProps[key] = ctor[key];
    } else {
      changedProps[key] = 0;
    }
  }
  return changedProps;
}
var colorMaps = ["map", "emissiveMap", "sheenColorMap", "specularColorMap", "envMap"];
var EVENT_REGEX = /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/;
function applyProps(object, props) {
  var _instance$object;
  const instance = object.__r3f;
  const rootState = instance && findInitialRoot(instance).getState();
  const prevHandlers = instance == null ? void 0 : instance.eventCount;
  for (const prop in props) {
    let value = props[prop];
    if (RESERVED_PROPS.includes(prop)) continue;
    if (instance && EVENT_REGEX.test(prop)) {
      if (typeof value === "function") instance.handlers[prop] = value;
      else delete instance.handlers[prop];
      instance.eventCount = Object.keys(instance.handlers).length;
      continue;
    }
    if (value === void 0) continue;
    let {
      root,
      key,
      target
    } = resolve(object, prop);
    if (target === void 0 && (typeof root !== "object" || root === null)) {
      throw Error(`R3F: Cannot set "${prop}". Ensure it is an object before setting "${key}".`);
    }
    if (target instanceof THREE.Layers && value instanceof THREE.Layers) {
      target.mask = value.mask;
    } else if (target instanceof THREE.Color && isColorRepresentation(value)) {
      target.set(value);
    } else if (target !== null && typeof target === "object" && typeof target.set === "function" && typeof target.copy === "function" && value != null && value.constructor && target.constructor === value.constructor) {
      target.copy(value);
    } else if (target !== null && typeof target === "object" && typeof target.set === "function" && Array.isArray(value)) {
      if (typeof target.fromArray === "function") target.fromArray(value);
      else target.set(...value);
    } else if (target !== null && typeof target === "object" && typeof target.set === "function" && typeof value === "number") {
      if (typeof target.setScalar === "function") target.setScalar(value);
      else target.set(value);
    } else {
      var _root$key;
      root[key] = value;
      if (rootState && !rootState.linear && colorMaps.includes(key) && (_root$key = root[key]) != null && _root$key.isTexture && // sRGB textures must be RGBA8 since r137 https://github.com/mrdoob/three.js/pull/23129
      root[key].format === THREE.RGBAFormat && root[key].type === THREE.UnsignedByteType) {
        root[key].colorSpace = THREE.SRGBColorSpace;
      }
    }
  }
  if (instance != null && instance.parent && rootState != null && rootState.internal && (_instance$object = instance.object) != null && _instance$object.isObject3D && prevHandlers !== instance.eventCount) {
    const object2 = instance.object;
    const index = rootState.internal.interaction.indexOf(object2);
    if (index > -1) rootState.internal.interaction.splice(index, 1);
    if (instance.eventCount && object2.raycast !== null) {
      rootState.internal.interaction.push(object2);
    }
  }
  if (instance && instance.props.attach === void 0) {
    if (instance.object.isBufferGeometry) instance.props.attach = "geometry";
    else if (instance.object.isMaterial) instance.props.attach = "material";
  }
  if (instance) invalidateInstance(instance);
  return object;
}
function invalidateInstance(instance) {
  var _instance$root;
  if (!instance.parent) return;
  instance.props.onUpdate == null ? void 0 : instance.props.onUpdate(instance.object);
  const state2 = (_instance$root = instance.root) == null ? void 0 : _instance$root.getState == null ? void 0 : _instance$root.getState();
  if (state2 && state2.internal.frames === 0) state2.invalidate();
}
function updateCamera(camera, size) {
  if (camera.manual) return;
  if (isOrthographicCamera(camera)) {
    camera.left = size.width / -2;
    camera.right = size.width / 2;
    camera.top = size.height / 2;
    camera.bottom = size.height / -2;
  } else {
    camera.aspect = size.width / size.height;
  }
  camera.updateProjectionMatrix();
}
var isObject3D = (object) => object == null ? void 0 : object.isObject3D;
function makeId(event) {
  return (event.eventObject || event.object).uuid + "/" + event.index + event.instanceId;
}
function releaseInternalPointerCapture(capturedMap, obj, captures, pointerId) {
  const captureData = captures.get(obj);
  if (captureData) {
    captures.delete(obj);
    if (captures.size === 0) {
      capturedMap.delete(pointerId);
      captureData.target.releasePointerCapture(pointerId);
    }
  }
}
function removeInteractivity(store, object) {
  const {
    internal
  } = store.getState();
  internal.interaction = internal.interaction.filter((o3) => o3 !== object);
  internal.initialHits = internal.initialHits.filter((o3) => o3 !== object);
  internal.hovered.forEach((value, key) => {
    if (value.eventObject === object || value.object === object) {
      internal.hovered.delete(key);
    }
  });
  internal.capturedMap.forEach((captures, pointerId) => {
    releaseInternalPointerCapture(internal.capturedMap, object, captures, pointerId);
  });
}
function createEvents(store) {
  function calculateDistance(event) {
    const {
      internal
    } = store.getState();
    const dx = event.offsetX - internal.initialClick[0];
    const dy = event.offsetY - internal.initialClick[1];
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  }
  function filterPointerEvents(objects) {
    return objects.filter((obj) => ["Move", "Over", "Enter", "Out", "Leave"].some((name) => {
      var _r3f;
      return (_r3f = obj.__r3f) == null ? void 0 : _r3f.handlers["onPointer" + name];
    }));
  }
  function intersect(event, filter) {
    const state2 = store.getState();
    const duplicates = /* @__PURE__ */ new Set();
    const intersections = [];
    const eventsObjects = filter ? filter(state2.internal.interaction) : state2.internal.interaction;
    for (let i3 = 0; i3 < eventsObjects.length; i3++) {
      const state3 = getRootState(eventsObjects[i3]);
      if (state3) {
        state3.raycaster.camera = void 0;
      }
    }
    if (!state2.previousRoot) {
      state2.events.compute == null ? void 0 : state2.events.compute(event, state2);
    }
    function handleRaycast(obj) {
      const state3 = getRootState(obj);
      if (!state3 || !state3.events.enabled || state3.raycaster.camera === null) return [];
      if (state3.raycaster.camera === void 0) {
        var _state$previousRoot;
        state3.events.compute == null ? void 0 : state3.events.compute(event, state3, (_state$previousRoot = state3.previousRoot) == null ? void 0 : _state$previousRoot.getState());
        if (state3.raycaster.camera === void 0) state3.raycaster.camera = null;
      }
      return state3.raycaster.camera ? state3.raycaster.intersectObject(obj, true) : [];
    }
    let hits = eventsObjects.flatMap(handleRaycast).sort((a2, b2) => {
      const aState = getRootState(a2.object);
      const bState = getRootState(b2.object);
      if (!aState || !bState) return a2.distance - b2.distance;
      return bState.events.priority - aState.events.priority || a2.distance - b2.distance;
    }).filter((item) => {
      const id = makeId(item);
      if (duplicates.has(id)) return false;
      duplicates.add(id);
      return true;
    });
    if (state2.events.filter) hits = state2.events.filter(hits, state2);
    for (const hit of hits) {
      let eventObject = hit.object;
      while (eventObject) {
        var _r3f2;
        if ((_r3f2 = eventObject.__r3f) != null && _r3f2.eventCount) intersections.push({
          ...hit,
          eventObject
        });
        eventObject = eventObject.parent;
      }
    }
    if ("pointerId" in event && state2.internal.capturedMap.has(event.pointerId)) {
      for (let captureData of state2.internal.capturedMap.get(event.pointerId).values()) {
        if (!duplicates.has(makeId(captureData.intersection))) intersections.push(captureData.intersection);
      }
    }
    return intersections;
  }
  function handleIntersects(intersections, event, delta, callback) {
    if (intersections.length) {
      const localState = {
        stopped: false
      };
      for (const hit of intersections) {
        let state2 = getRootState(hit.object);
        if (!state2) {
          hit.object.traverseAncestors((obj) => {
            const parentState = getRootState(obj);
            if (parentState) {
              state2 = parentState;
              return false;
            }
          });
        }
        if (state2) {
          const {
            raycaster,
            pointer,
            camera,
            internal
          } = state2;
          const unprojectedPoint = new THREE.Vector3(pointer.x, pointer.y, 0).unproject(camera);
          const hasPointerCapture = (id) => {
            var _internal$capturedMap, _internal$capturedMap2;
            return (_internal$capturedMap = (_internal$capturedMap2 = internal.capturedMap.get(id)) == null ? void 0 : _internal$capturedMap2.has(hit.eventObject)) != null ? _internal$capturedMap : false;
          };
          const setPointerCapture = (id) => {
            const captureData = {
              intersection: hit,
              target: event.target
            };
            if (internal.capturedMap.has(id)) {
              internal.capturedMap.get(id).set(hit.eventObject, captureData);
            } else {
              internal.capturedMap.set(id, /* @__PURE__ */ new Map([[hit.eventObject, captureData]]));
            }
            event.target.setPointerCapture(id);
          };
          const releasePointerCapture = (id) => {
            const captures = internal.capturedMap.get(id);
            if (captures) {
              releaseInternalPointerCapture(internal.capturedMap, hit.eventObject, captures, id);
            }
          };
          let extractEventProps = {};
          for (let prop in event) {
            let property = event[prop];
            if (typeof property !== "function") extractEventProps[prop] = property;
          }
          let raycastEvent = {
            ...hit,
            ...extractEventProps,
            pointer,
            intersections,
            stopped: localState.stopped,
            delta,
            unprojectedPoint,
            ray: raycaster.ray,
            camera,
            // Hijack stopPropagation, which just sets a flag
            stopPropagation() {
              const capturesForPointer = "pointerId" in event && internal.capturedMap.get(event.pointerId);
              if (
                // ...if this pointer hasn't been captured
                !capturesForPointer || // ... or if the hit object is capturing the pointer
                capturesForPointer.has(hit.eventObject)
              ) {
                raycastEvent.stopped = localState.stopped = true;
                if (internal.hovered.size && Array.from(internal.hovered.values()).find((i3) => i3.eventObject === hit.eventObject)) {
                  const higher = intersections.slice(0, intersections.indexOf(hit));
                  cancelPointer([...higher, hit]);
                }
              }
            },
            // there should be a distinction between target and currentTarget
            target: {
              hasPointerCapture,
              setPointerCapture,
              releasePointerCapture
            },
            currentTarget: {
              hasPointerCapture,
              setPointerCapture,
              releasePointerCapture
            },
            nativeEvent: event
          };
          callback(raycastEvent);
          if (localState.stopped === true) break;
        }
      }
    }
    return intersections;
  }
  function cancelPointer(intersections) {
    const {
      internal
    } = store.getState();
    for (const hoveredObj of internal.hovered.values()) {
      if (!intersections.length || !intersections.find((hit) => hit.object === hoveredObj.object && hit.index === hoveredObj.index && hit.instanceId === hoveredObj.instanceId)) {
        const eventObject = hoveredObj.eventObject;
        const instance = eventObject.__r3f;
        internal.hovered.delete(makeId(hoveredObj));
        if (instance != null && instance.eventCount) {
          const handlers = instance.handlers;
          const data = {
            ...hoveredObj,
            intersections
          };
          handlers.onPointerOut == null ? void 0 : handlers.onPointerOut(data);
          handlers.onPointerLeave == null ? void 0 : handlers.onPointerLeave(data);
        }
      }
    }
  }
  function pointerMissed(event, objects) {
    for (let i3 = 0; i3 < objects.length; i3++) {
      const instance = objects[i3].__r3f;
      instance == null ? void 0 : instance.handlers.onPointerMissed == null ? void 0 : instance.handlers.onPointerMissed(event);
    }
  }
  function handlePointer(name) {
    switch (name) {
      case "onPointerLeave":
      case "onPointerCancel":
        return () => cancelPointer([]);
      case "onLostPointerCapture":
        return (event) => {
          const {
            internal
          } = store.getState();
          if ("pointerId" in event && internal.capturedMap.has(event.pointerId)) {
            requestAnimationFrame(() => {
              if (internal.capturedMap.has(event.pointerId)) {
                internal.capturedMap.delete(event.pointerId);
                cancelPointer([]);
              }
            });
          }
        };
    }
    return function handleEvent(event) {
      const {
        onPointerMissed,
        internal
      } = store.getState();
      internal.lastEvent.current = event;
      const isPointerMove = name === "onPointerMove";
      const isClickEvent = name === "onClick" || name === "onContextMenu" || name === "onDoubleClick";
      const filter = isPointerMove ? filterPointerEvents : void 0;
      const hits = intersect(event, filter);
      const delta = isClickEvent ? calculateDistance(event) : 0;
      if (name === "onPointerDown") {
        internal.initialClick = [event.offsetX, event.offsetY];
        internal.initialHits = hits.map((hit) => hit.eventObject);
      }
      if (isClickEvent && !hits.length) {
        if (delta <= 2) {
          pointerMissed(event, internal.interaction);
          if (onPointerMissed) onPointerMissed(event);
        }
      }
      if (isPointerMove) cancelPointer(hits);
      function onIntersect(data) {
        const eventObject = data.eventObject;
        const instance = eventObject.__r3f;
        if (!(instance != null && instance.eventCount)) return;
        const handlers = instance.handlers;
        if (isPointerMove) {
          if (handlers.onPointerOver || handlers.onPointerEnter || handlers.onPointerOut || handlers.onPointerLeave) {
            const id = makeId(data);
            const hoveredItem = internal.hovered.get(id);
            if (!hoveredItem) {
              internal.hovered.set(id, data);
              handlers.onPointerOver == null ? void 0 : handlers.onPointerOver(data);
              handlers.onPointerEnter == null ? void 0 : handlers.onPointerEnter(data);
            } else if (hoveredItem.stopped) {
              data.stopPropagation();
            }
          }
          handlers.onPointerMove == null ? void 0 : handlers.onPointerMove(data);
        } else {
          const handler = handlers[name];
          if (handler) {
            if (!isClickEvent || internal.initialHits.includes(eventObject)) {
              pointerMissed(event, internal.interaction.filter((object) => !internal.initialHits.includes(object)));
              handler(data);
            }
          } else {
            if (isClickEvent && internal.initialHits.includes(eventObject)) {
              pointerMissed(event, internal.interaction.filter((object) => !internal.initialHits.includes(object)));
            }
          }
        }
      }
      handleIntersects(hits, event, delta, onIntersect);
    };
  }
  return {
    handlePointer
  };
}
var isRenderer = (def) => !!(def != null && def.render);
var context = /* @__PURE__ */ React2.createContext(null);
var createStore2 = (invalidate2, advance2) => {
  const rootStore = createWithEqualityFn((set, get) => {
    const position = new THREE.Vector3();
    const defaultTarget = new THREE.Vector3();
    const tempTarget = new THREE.Vector3();
    function getCurrentViewport(camera = get().camera, target = defaultTarget, size = get().size) {
      const {
        width,
        height,
        top,
        left
      } = size;
      const aspect = width / height;
      if (target.isVector3) tempTarget.copy(target);
      else tempTarget.set(...target);
      const distance = camera.getWorldPosition(position).distanceTo(tempTarget);
      if (isOrthographicCamera(camera)) {
        return {
          width: width / camera.zoom,
          height: height / camera.zoom,
          top,
          left,
          factor: 1,
          distance,
          aspect
        };
      } else {
        const fov = camera.fov * Math.PI / 180;
        const h2 = 2 * Math.tan(fov / 2) * distance;
        const w = h2 * (width / height);
        return {
          width: w,
          height: h2,
          top,
          left,
          factor: width / w,
          distance,
          aspect
        };
      }
    }
    let performanceTimeout = void 0;
    const setPerformanceCurrent = (current) => set((state3) => ({
      performance: {
        ...state3.performance,
        current
      }
    }));
    const pointer = new THREE.Vector2();
    const rootState = {
      set,
      get,
      // Mock objects that have to be configured
      gl: null,
      camera: null,
      raycaster: null,
      events: {
        priority: 1,
        enabled: true,
        connected: false
      },
      scene: null,
      xr: null,
      invalidate: (frames = 1) => invalidate2(get(), frames),
      advance: (timestamp, runGlobalEffects) => advance2(timestamp, runGlobalEffects, get()),
      legacy: false,
      linear: false,
      flat: false,
      controls: null,
      clock: new THREE.Clock(),
      pointer,
      mouse: pointer,
      frameloop: "always",
      onPointerMissed: void 0,
      performance: {
        current: 1,
        min: 0.5,
        max: 1,
        debounce: 200,
        regress: () => {
          const state3 = get();
          if (performanceTimeout) clearTimeout(performanceTimeout);
          if (state3.performance.current !== state3.performance.min) setPerformanceCurrent(state3.performance.min);
          performanceTimeout = setTimeout(() => setPerformanceCurrent(get().performance.max), state3.performance.debounce);
        }
      },
      size: {
        width: 0,
        height: 0,
        top: 0,
        left: 0
      },
      viewport: {
        initialDpr: 0,
        dpr: 0,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        aspect: 0,
        distance: 0,
        factor: 0,
        getCurrentViewport
      },
      setEvents: (events) => set((state3) => ({
        ...state3,
        events: {
          ...state3.events,
          ...events
        }
      })),
      setSize: (width, height, top = 0, left = 0) => {
        const camera = get().camera;
        const size = {
          width,
          height,
          top,
          left
        };
        set((state3) => ({
          size,
          viewport: {
            ...state3.viewport,
            ...getCurrentViewport(camera, defaultTarget, size)
          }
        }));
      },
      setDpr: (dpr) => set((state3) => {
        const resolved = calculateDpr(dpr);
        return {
          viewport: {
            ...state3.viewport,
            dpr: resolved,
            initialDpr: state3.viewport.initialDpr || resolved
          }
        };
      }),
      setFrameloop: (frameloop = "always") => {
        const clock = get().clock;
        clock.stop();
        clock.elapsedTime = 0;
        if (frameloop !== "never") {
          clock.start();
          clock.elapsedTime = 0;
        }
        set(() => ({
          frameloop
        }));
      },
      previousRoot: void 0,
      internal: {
        // Events
        interaction: [],
        hovered: /* @__PURE__ */ new Map(),
        subscribers: [],
        initialClick: [0, 0],
        initialHits: [],
        capturedMap: /* @__PURE__ */ new Map(),
        lastEvent: /* @__PURE__ */ React2.createRef(),
        // Updates
        active: false,
        frames: 0,
        priority: 0,
        subscribe: (ref, priority, store) => {
          const internal = get().internal;
          internal.priority = internal.priority + (priority > 0 ? 1 : 0);
          internal.subscribers.push({
            ref,
            priority,
            store
          });
          internal.subscribers = internal.subscribers.sort((a2, b2) => a2.priority - b2.priority);
          return () => {
            const internal2 = get().internal;
            if (internal2 != null && internal2.subscribers) {
              internal2.priority = internal2.priority - (priority > 0 ? 1 : 0);
              internal2.subscribers = internal2.subscribers.filter((s) => s.ref !== ref);
            }
          };
        }
      }
    };
    return rootState;
  });
  const state2 = rootStore.getState();
  let oldSize = state2.size;
  let oldDpr = state2.viewport.dpr;
  let oldCamera = state2.camera;
  rootStore.subscribe(() => {
    const {
      camera,
      size,
      viewport,
      gl,
      set
    } = rootStore.getState();
    if (size.width !== oldSize.width || size.height !== oldSize.height || viewport.dpr !== oldDpr) {
      oldSize = size;
      oldDpr = viewport.dpr;
      updateCamera(camera, size);
      if (viewport.dpr > 0) gl.setPixelRatio(viewport.dpr);
      const updateStyle = typeof HTMLCanvasElement !== "undefined" && gl.domElement instanceof HTMLCanvasElement;
      gl.setSize(size.width, size.height, updateStyle);
    }
    if (camera !== oldCamera) {
      oldCamera = camera;
      set((state3) => ({
        viewport: {
          ...state3.viewport,
          ...state3.viewport.getCurrentViewport(camera)
        }
      }));
    }
  });
  rootStore.subscribe((state3) => invalidate2(state3));
  return rootStore;
};
function useInstanceHandle(ref) {
  const instance = React2.useRef(null);
  React2.useImperativeHandle(instance, () => ref.current.__r3f, [ref]);
  return instance;
}
function useStore() {
  const store = React2.useContext(context);
  if (!store) throw new Error("R3F: Hooks can only be used within the Canvas component!");
  return store;
}
function useThree(selector = (state2) => state2, equalityFn) {
  return useStore()(selector, equalityFn);
}
function useFrame(callback, renderPriority = 0) {
  const store = useStore();
  const subscribe = store.getState().internal.subscribe;
  const ref = useMutableCallback(callback);
  useIsomorphicLayoutEffect(() => subscribe(ref, renderPriority, store), [renderPriority, subscribe, store]);
  return null;
}
function useGraph(object) {
  return React2.useMemo(() => buildGraph(object), [object]);
}
var memoizedLoaders = /* @__PURE__ */ new WeakMap();
var isConstructor$1 = (value) => {
  var _value$prototype;
  return typeof value === "function" && (value == null ? void 0 : (_value$prototype = value.prototype) == null ? void 0 : _value$prototype.constructor) === value;
};
function loadingFn(extensions, onProgress) {
  return function(Proto, ...input) {
    let loader;
    if (isConstructor$1(Proto)) {
      loader = memoizedLoaders.get(Proto);
      if (!loader) {
        loader = new Proto();
        memoizedLoaders.set(Proto, loader);
      }
    } else {
      loader = Proto;
    }
    if (extensions) extensions(loader);
    return Promise.all(input.map((input2) => new Promise((res, reject) => loader.load(input2, (data) => {
      if (isObject3D(data == null ? void 0 : data.scene)) Object.assign(data, buildGraph(data.scene));
      res(data);
    }, onProgress, (error) => reject(new Error(`Could not load ${input2}: ${error == null ? void 0 : error.message}`))))));
  };
}
function useLoader(loader, input, extensions, onProgress) {
  const keys = Array.isArray(input) ? input : [input];
  const results = suspend(loadingFn(extensions, onProgress), [loader, ...keys], {
    equal: is.equ
  });
  return Array.isArray(input) ? results : results[0];
}
useLoader.preload = function(loader, input, extensions) {
  const keys = Array.isArray(input) ? input : [input];
  return preload(loadingFn(extensions), [loader, ...keys]);
};
useLoader.clear = function(loader, input) {
  const keys = Array.isArray(input) ? input : [input];
  return clear([loader, ...keys]);
};
var t = 1;
var o2 = 8;
var r = 32;
var e = 2;
var packageData = {
  name: "@react-three/fiber",
  version: "9.5.0",
  description: "A React renderer for Threejs",
  keywords: [
    "react",
    "renderer",
    "fiber",
    "three",
    "threejs"
  ],
  author: "Paul Henschel (https://github.com/drcmda)",
  license: "MIT",
  maintainers: [
    "Josh Ellis (https://github.com/joshuaellis)",
    "Cody Bennett (https://github.com/codyjasonbennett)",
    "Kris Baumgarter (https://github.com/krispya)"
  ],
  bugs: {
    url: "https://github.com/pmndrs/react-three-fiber/issues"
  },
  homepage: "https://github.com/pmndrs/react-three-fiber#readme",
  repository: {
    type: "git",
    url: "git+https://github.com/pmndrs/react-three-fiber.git"
  },
  collective: {
    type: "opencollective",
    url: "https://opencollective.com/react-three-fiber"
  },
  main: "dist/react-three-fiber.cjs.js",
  module: "dist/react-three-fiber.esm.js",
  types: "dist/react-three-fiber.cjs.d.ts",
  "react-native": "native/dist/react-three-fiber-native.cjs.js",
  sideEffects: false,
  preconstruct: {
    entrypoints: [
      "index.tsx",
      "native.tsx"
    ]
  },
  scripts: {
    prebuild: "cp ../../readme.md readme.md"
  },
  devDependencies: {
    "@types/react-reconciler": "^0.32.3",
    "react-reconciler": "^0.33.0"
  },
  dependencies: {
    "@babel/runtime": "^7.17.8",
    "@types/webxr": "*",
    "base64-js": "^1.5.1",
    buffer: "^6.0.3",
    "its-fine": "^2.0.0",
    "react-use-measure": "^2.1.7",
    scheduler: "^0.27.0",
    "suspend-react": "^0.1.3",
    "use-sync-external-store": "^1.4.0",
    zustand: "^5.0.3"
  },
  peerDependencies: {
    expo: ">=43.0",
    "expo-asset": ">=8.4",
    "expo-file-system": ">=11.0",
    "expo-gl": ">=11.0",
    react: ">=19 <19.3",
    "react-dom": ">=19 <19.3",
    "react-native": ">=0.78",
    three: ">=0.156"
  },
  peerDependenciesMeta: {
    "react-dom": {
      optional: true
    },
    "react-native": {
      optional: true
    },
    expo: {
      optional: true
    },
    "expo-asset": {
      optional: true
    },
    "expo-file-system": {
      optional: true
    },
    "expo-gl": {
      optional: true
    }
  }
};
function Xb(Tt) {
  return Tt && Tt.__esModule && Object.prototype.hasOwnProperty.call(Tt, "default") ? Tt.default : Tt;
}
var Rm = {
  exports: {}
};
var Og = {
  exports: {}
};
Og.exports;
var _b;
function Kb() {
  return _b || (_b = 1, function(Tt) {
    Tt.exports = function(m2) {
      function Yn(t2, r2, a2, l2) {
        return new uc(t2, r2, a2, l2);
      }
      function _d() {
      }
      function F(t2) {
        var r2 = "https://react.dev/errors/" + t2;
        if (1 < arguments.length) {
          r2 += "?args[]=" + encodeURIComponent(arguments[1]);
          for (var a2 = 2; a2 < arguments.length; a2++) r2 += "&args[]=" + encodeURIComponent(arguments[a2]);
        }
        return "Minified React error #" + t2 + "; visit " + r2 + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
      }
      function Rd(t2) {
        var r2 = t2, a2 = t2;
        if (t2.alternate) for (; r2.return; ) r2 = r2.return;
        else {
          t2 = r2;
          do
            r2 = t2, (r2.flags & 4098) !== 0 && (a2 = r2.return), t2 = r2.return;
          while (t2);
        }
        return r2.tag === 3 ? a2 : null;
      }
      function du(t2) {
        if (Rd(t2) !== t2) throw Error(F(188));
      }
      function fu(t2) {
        var r2 = t2.alternate;
        if (!r2) {
          if (r2 = Rd(t2), r2 === null) throw Error(F(188));
          return r2 !== t2 ? null : t2;
        }
        for (var a2 = t2, l2 = r2; ; ) {
          var c2 = a2.return;
          if (c2 === null) break;
          var d = c2.alternate;
          if (d === null) {
            if (l2 = c2.return, l2 !== null) {
              a2 = l2;
              continue;
            }
            break;
          }
          if (c2.child === d.child) {
            for (d = c2.child; d; ) {
              if (d === a2) return du(c2), t2;
              if (d === l2) return du(c2), r2;
              d = d.sibling;
            }
            throw Error(F(188));
          }
          if (a2.return !== l2.return) a2 = c2, l2 = d;
          else {
            for (var h2 = false, y = c2.child; y; ) {
              if (y === a2) {
                h2 = true, a2 = c2, l2 = d;
                break;
              }
              if (y === l2) {
                h2 = true, l2 = c2, a2 = d;
                break;
              }
              y = y.sibling;
            }
            if (!h2) {
              for (y = d.child; y; ) {
                if (y === a2) {
                  h2 = true, a2 = d, l2 = c2;
                  break;
                }
                if (y === l2) {
                  h2 = true, l2 = d, a2 = c2;
                  break;
                }
                y = y.sibling;
              }
              if (!h2) throw Error(F(189));
            }
          }
          if (a2.alternate !== l2) throw Error(F(190));
        }
        if (a2.tag !== 3) throw Error(F(188));
        return a2.stateNode.current === a2 ? t2 : r2;
      }
      function pu(t2) {
        var r2 = t2.tag;
        if (r2 === 5 || r2 === 26 || r2 === 27 || r2 === 6) return t2;
        for (t2 = t2.child; t2 !== null; ) {
          if (r2 = pu(t2), r2 !== null) return r2;
          t2 = t2.sibling;
        }
        return null;
      }
      function lt(t2) {
        var r2 = t2.tag;
        if (r2 === 5 || r2 === 26 || r2 === 27 || r2 === 6) return t2;
        for (t2 = t2.child; t2 !== null; ) {
          if (t2.tag !== 4 && (r2 = lt(t2), r2 !== null)) return r2;
          t2 = t2.sibling;
        }
        return null;
      }
      function Fl(t2) {
        return t2 === null || typeof t2 != "object" ? null : (t2 = Pf && t2[Pf] || t2["@@iterator"], typeof t2 == "function" ? t2 : null);
      }
      function hu(t2) {
        if (t2 == null) return null;
        if (typeof t2 == "function") return t2.$$typeof === xf ? null : t2.displayName || t2.name || null;
        if (typeof t2 == "string") return t2;
        switch (t2) {
          case $a:
            return "Fragment";
          case Cs:
            return "Profiler";
          case kf:
            return "StrictMode";
          case Va:
            return "Suspense";
          case Te:
            return "SuspenseList";
          case gc:
            return "Activity";
        }
        if (typeof t2 == "object") switch (t2.$$typeof) {
          case sa:
            return "Portal";
          case Io:
            return t2.displayName || "Context";
          case mc:
            return (t2._context.displayName || "Context") + ".Consumer";
          case Zi:
            var r2 = t2.render;
            return t2 = t2.displayName, t2 || (t2 = r2.displayName || r2.name || "", t2 = t2 !== "" ? "ForwardRef(" + t2 + ")" : "ForwardRef"), t2;
          case wf:
            return r2 = t2.displayName || null, r2 !== null ? r2 : hu(t2.type) || "Memo";
          case ua:
            r2 = t2._payload, t2 = t2._init;
            try {
              return hu(t2(r2));
            } catch {
            }
        }
        return null;
      }
      function Ir(t2) {
        return {
          current: t2
        };
      }
      function D2(t2) {
        0 > tl || (t2.current = Hs[tl], Hs[tl] = null, tl--);
      }
      function Ce(t2, r2) {
        tl++, Hs[tl] = t2.current, t2.current = r2;
      }
      function Em(t2) {
        return t2 >>>= 0, t2 === 0 ? 32 : 31 - (Dh(t2) / Wh | 0) | 0;
      }
      function Zo(t2) {
        var r2 = t2 & 42;
        if (r2 !== 0) return r2;
        switch (t2 & -t2) {
          case 1:
            return 1;
          case 2:
            return 2;
          case 4:
            return 4;
          case 8:
            return 8;
          case 16:
            return 16;
          case 32:
            return 32;
          case 64:
            return 64;
          case 128:
            return 128;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
            return t2 & 261888;
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return t2 & 3932160;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return t2 & 62914560;
          case 67108864:
            return 67108864;
          case 134217728:
            return 134217728;
          case 268435456:
            return 268435456;
          case 536870912:
            return 536870912;
          case 1073741824:
            return 0;
          default:
            return t2;
        }
      }
      function Lr(t2, r2, a2) {
        var l2 = t2.pendingLanes;
        if (l2 === 0) return 0;
        var c2 = 0, d = t2.suspendedLanes, h2 = t2.pingedLanes;
        t2 = t2.warmLanes;
        var y = l2 & 134217727;
        return y !== 0 ? (l2 = y & ~d, l2 !== 0 ? c2 = Zo(l2) : (h2 &= y, h2 !== 0 ? c2 = Zo(h2) : a2 || (a2 = y & ~t2, a2 !== 0 && (c2 = Zo(a2))))) : (y = l2 & ~d, y !== 0 ? c2 = Zo(y) : h2 !== 0 ? c2 = Zo(h2) : a2 || (a2 = l2 & ~t2, a2 !== 0 && (c2 = Zo(a2)))), c2 === 0 ? 0 : r2 !== 0 && r2 !== c2 && (r2 & d) === 0 && (d = c2 & -c2, a2 = r2 & -r2, d >= a2 || d === 32 && (a2 & 4194048) !== 0) ? r2 : c2;
      }
      function Pi(t2, r2) {
        return (t2.pendingLanes & ~(t2.suspendedLanes & ~t2.pingedLanes) & r2) === 0;
      }
      function Tp(t2, r2) {
        switch (t2) {
          case 1:
          case 2:
          case 4:
          case 8:
          case 64:
            return r2 + 250;
          case 16:
          case 32:
          case 128:
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
            return r2 + 5e3;
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            return -1;
          case 67108864:
          case 134217728:
          case 268435456:
          case 536870912:
          case 1073741824:
            return -1;
          default:
            return -1;
        }
      }
      function Ed() {
        var t2 = rl;
        return rl <<= 1, (rl & 62914560) === 0 && (rl = 4194304), t2;
      }
      function mu(t2) {
        for (var r2 = [], a2 = 0; 31 > a2; a2++) r2.push(t2);
        return r2;
      }
      function xi(t2, r2) {
        t2.pendingLanes |= r2, r2 !== 268435456 && (t2.suspendedLanes = 0, t2.pingedLanes = 0, t2.warmLanes = 0);
      }
      function _p(t2, r2, a2, l2, c2, d) {
        var h2 = t2.pendingLanes;
        t2.pendingLanes = a2, t2.suspendedLanes = 0, t2.pingedLanes = 0, t2.warmLanes = 0, t2.expiredLanes &= a2, t2.entangledLanes &= a2, t2.errorRecoveryDisabledLanes &= a2, t2.shellSuspendCounter = 0;
        var y = t2.entanglements, R = t2.expirationTimes, L = t2.hiddenUpdates;
        for (a2 = h2 & ~a2; 0 < a2; ) {
          var j2 = 31 - vt(a2), A = 1 << j2;
          y[j2] = 0, R[j2] = -1;
          var W2 = L[j2];
          if (W2 !== null) for (L[j2] = null, j2 = 0; j2 < W2.length; j2++) {
            var V = W2[j2];
            V !== null && (V.lane &= -536870913);
          }
          a2 &= ~A;
        }
        l2 !== 0 && Yo(t2, l2, 0), d !== 0 && c2 === 0 && t2.tag !== 0 && (t2.suspendedLanes |= d & ~(h2 & ~r2));
      }
      function Yo(t2, r2, a2) {
        t2.pendingLanes |= r2, t2.suspendedLanes &= ~r2;
        var l2 = 31 - vt(r2);
        t2.entangledLanes |= r2, t2.entanglements[l2] = t2.entanglements[l2] | 1073741824 | a2 & 261930;
      }
      function $e(t2, r2) {
        var a2 = t2.entangledLanes |= r2;
        for (t2 = t2.entanglements; a2; ) {
          var l2 = 31 - vt(a2), c2 = 1 << l2;
          c2 & r2 | t2[l2] & r2 && (t2[l2] |= r2), a2 &= ~c2;
        }
      }
      function G(t2, r2) {
        var a2 = r2 & -r2;
        return a2 = (a2 & 42) !== 0 ? 1 : st(a2), (a2 & (t2.suspendedLanes | r2)) !== 0 ? 0 : a2;
      }
      function st(t2) {
        switch (t2) {
          case 2:
            t2 = 1;
            break;
          case 8:
            t2 = 4;
            break;
          case 32:
            t2 = 16;
            break;
          case 256:
          case 512:
          case 1024:
          case 2048:
          case 4096:
          case 8192:
          case 16384:
          case 32768:
          case 65536:
          case 131072:
          case 262144:
          case 524288:
          case 1048576:
          case 2097152:
          case 4194304:
          case 8388608:
          case 16777216:
          case 33554432:
            t2 = 128;
            break;
          case 268435456:
            t2 = 134217728;
            break;
          default:
            t2 = 0;
        }
        return t2;
      }
      function Ze(t2) {
        return t2 &= -t2, 2 < t2 ? 8 < t2 ? (t2 & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
      }
      function pe(t2) {
        if (typeof Lc == "function" && Uf(t2), on && typeof on.setStrictMode == "function") try {
          on.setStrictMode(ei, t2);
        } catch {
        }
      }
      function Im(t2, r2) {
        return t2 === r2 && (t2 !== 0 || 1 / t2 === 1 / r2) || t2 !== t2 && r2 !== r2;
      }
      function _t(t2) {
        if (al === void 0) try {
          throw Error();
        } catch (a2) {
          var r2 = a2.stack.trim().match(/\n( *(at )?)/);
          al = r2 && r2[1] || "", kt = -1 < a2.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a2.stack.indexOf("@") ? "@unknown:0:0" : "";
        }
        return `
` + al + t2 + kt;
      }
      function zi(t2, r2) {
        if (!t2 || Ds) return "";
        Ds = true;
        var a2 = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
          var l2 = {
            DetermineComponentFrameRoot: function() {
              try {
                if (r2) {
                  var A = function() {
                    throw Error();
                  };
                  if (Object.defineProperty(A.prototype, "props", {
                    set: function() {
                      throw Error();
                    }
                  }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                      Reflect.construct(A, []);
                    } catch (V) {
                      var W2 = V;
                    }
                    Reflect.construct(t2, [], A);
                  } else {
                    try {
                      A.call();
                    } catch (V) {
                      W2 = V;
                    }
                    t2.call(A.prototype);
                  }
                } else {
                  try {
                    throw Error();
                  } catch (V) {
                    W2 = V;
                  }
                  (A = t2()) && typeof A.catch == "function" && A.catch(function() {
                  });
                }
              } catch (V) {
                if (V && W2 && typeof V.stack == "string") return [V.stack, W2.stack];
              }
              return [null, null];
            }
          };
          l2.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
          var c2 = Object.getOwnPropertyDescriptor(l2.DetermineComponentFrameRoot, "name");
          c2 && c2.configurable && Object.defineProperty(l2.DetermineComponentFrameRoot, "name", {
            value: "DetermineComponentFrameRoot"
          });
          var d = l2.DetermineComponentFrameRoot(), h2 = d[0], y = d[1];
          if (h2 && y) {
            var R = h2.split(`
`), L = y.split(`
`);
            for (c2 = l2 = 0; l2 < R.length && !R[l2].includes("DetermineComponentFrameRoot"); ) l2++;
            for (; c2 < L.length && !L[c2].includes("DetermineComponentFrameRoot"); ) c2++;
            if (l2 === R.length || c2 === L.length) for (l2 = R.length - 1, c2 = L.length - 1; 1 <= l2 && 0 <= c2 && R[l2] !== L[c2]; ) c2--;
            for (; 1 <= l2 && 0 <= c2; l2--, c2--) if (R[l2] !== L[c2]) {
              if (l2 !== 1 || c2 !== 1) do
                if (l2--, c2--, 0 > c2 || R[l2] !== L[c2]) {
                  var j2 = `
` + R[l2].replace(" at new ", " at ");
                  return t2.displayName && j2.includes("<anonymous>") && (j2 = j2.replace("<anonymous>", t2.displayName)), j2;
                }
              while (1 <= l2 && 0 <= c2);
              break;
            }
          }
        } finally {
          Ds = false, Error.prepareStackTrace = a2;
        }
        return (a2 = t2 ? t2.displayName || t2.name : "") ? _t(a2) : "";
      }
      function Hl(t2, r2) {
        switch (t2.tag) {
          case 26:
          case 27:
          case 5:
            return _t(t2.type);
          case 16:
            return _t("Lazy");
          case 13:
            return t2.child !== r2 && r2 !== null ? _t("Suspense Fallback") : _t("Suspense");
          case 19:
            return _t("SuspenseList");
          case 0:
          case 15:
            return zi(t2.type, false);
          case 11:
            return zi(t2.type.render, false);
          case 1:
            return zi(t2.type, true);
          case 31:
            return _t("Activity");
          default:
            return "";
        }
      }
      function Rp(t2) {
        try {
          var r2 = "", a2 = null;
          do
            r2 += Hl(t2, a2), a2 = t2, t2 = t2.return;
          while (t2);
          return r2;
        } catch (l2) {
          return `
Error generating stack: ` + l2.message + `
` + l2.stack;
        }
      }
      function ut(t2, r2) {
        if (typeof t2 == "object" && t2 !== null) {
          var a2 = Bh.get(t2);
          return a2 !== void 0 ? a2 : (r2 = {
            value: t2,
            source: r2,
            stack: Rp(r2)
          }, Bh.set(t2, r2), r2);
        }
        return {
          value: t2,
          source: r2,
          stack: Rp(r2)
        };
      }
      function or(t2, r2) {
        ni[il++] = x2, ni[il++] = fn, fn = t2, x2 = r2;
      }
      function Ci(t2, r2, a2) {
        Jt[Zt++] = ot, Jt[Zt++] = Zr, Jt[Zt++] = jo, jo = t2;
        var l2 = ot;
        t2 = Zr;
        var c2 = 32 - vt(l2) - 1;
        l2 &= ~(1 << c2), a2 += 1;
        var d = 32 - vt(r2) + c2;
        if (30 < d) {
          var h2 = c2 - c2 % 5;
          d = (l2 & (1 << h2) - 1).toString(32), l2 >>= h2, c2 -= h2, ot = 1 << 32 - vt(r2) + c2 | a2 << c2 | l2, Zr = d + t2;
        } else ot = 1 << d | a2 << c2 | l2, Zr = t2;
      }
      function Id(t2) {
        t2.return !== null && (or(t2, 1), Ci(t2, 1, 0));
      }
      function gu(t2) {
        for (; t2 === fn; ) fn = ni[--il], ni[il] = null, x2 = ni[--il], ni[il] = null;
        for (; t2 === jo; ) jo = Jt[--Zt], Jt[Zt] = null, Zr = Jt[--Zt], Jt[Zt] = null, ot = Jt[--Zt], Jt[Zt] = null;
      }
      function Ld(t2, r2) {
        Jt[Zt++] = ot, Jt[Zt++] = Zr, Jt[Zt++] = jo, ot = r2.id, Zr = r2.overflow, jo = t2;
      }
      function Al(t2, r2) {
        Ce(pa, r2), Ce(Ws, t2), Ce(Dn, null), t2 = Hm(r2), D2(Dn), Ce(Dn, t2);
      }
      function Xo() {
        D2(Dn), D2(Ws), D2(pa);
      }
      function yu(t2) {
        t2.memoizedState !== null && Ce(Fc, t2);
        var r2 = Dn.current, a2 = Xp(r2, t2.type);
        r2 !== a2 && (Ce(Ws, t2), Ce(Dn, a2));
      }
      function jl(t2) {
        Ws.current === t2 && (D2(Dn), D2(Ws)), Fc.current === t2 && (D2(Fc), qt ? da._currentValue = rt : da._currentValue2 = rt);
      }
      function ar(t2) {
        var r2 = Error(F(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", ""));
        throw ct(ut(r2, t2)), Of;
      }
      function Ep(t2, r2) {
        if (!Hn) throw Error(F(175));
        Ki(t2.stateNode, t2.type, t2.memoizedProps, r2, t2) || ar(t2, true);
      }
      function De(t2) {
        for (bn = t2.return; bn; ) switch (bn.tag) {
          case 5:
          case 31:
          case 13:
            Yt = false;
            return;
          case 27:
          case 3:
            Yt = true;
            return;
          default:
            bn = bn.return;
        }
      }
      function Ti(t2) {
        if (!Hn || t2 !== bn) return false;
        if (!ue) return De(t2), ue = true, false;
        var r2 = t2.tag;
        if (dn ? r2 !== 3 && r2 !== 27 && (r2 !== 5 || Nh(t2.type) && !Rs(t2.type, t2.memoizedProps)) && Ue && ar(t2) : r2 !== 3 && (r2 !== 5 || Nh(t2.type) && !Rs(t2.type, t2.memoizedProps)) && Ue && ar(t2), De(t2), r2 === 13) {
          if (!Hn) throw Error(F(316));
          if (t2 = t2.memoizedState, t2 = t2 !== null ? t2.dehydrated : null, !t2) throw Error(F(317));
          Ue = Th(t2);
        } else if (r2 === 31) {
          if (t2 = t2.memoizedState, t2 = t2 !== null ? t2.dehydrated : null, !t2) throw Error(F(317));
          Ue = Ch(t2);
        } else Ue = dn && r2 === 27 ? kh(t2.type, Ue) : bn ? Nf(t2.stateNode) : null;
        return true;
      }
      function _a() {
        Hn && (Ue = bn = null, ue = false);
      }
      function Dl() {
        var t2 = Do;
        return t2 !== null && (xt === null ? xt = t2 : xt.push.apply(xt, t2), Do = null), t2;
      }
      function ct(t2) {
        Do === null ? Do = [t2] : Do.push(t2);
      }
      function fo(t2, r2, a2) {
        qt ? (Ce(Yr, r2._currentValue), r2._currentValue = a2) : (Ce(Yr, r2._currentValue2), r2._currentValue2 = a2);
      }
      function En(t2) {
        var r2 = Yr.current;
        qt ? t2._currentValue = r2 : t2._currentValue2 = r2, D2(Yr);
      }
      function Ot(t2, r2, a2) {
        for (; t2 !== null; ) {
          var l2 = t2.alternate;
          if ((t2.childLanes & r2) !== r2 ? (t2.childLanes |= r2, l2 !== null && (l2.childLanes |= r2)) : l2 !== null && (l2.childLanes & r2) !== r2 && (l2.childLanes |= r2), t2 === a2) break;
          t2 = t2.return;
        }
      }
      function _i(t2, r2, a2, l2) {
        var c2 = t2.child;
        for (c2 !== null && (c2.return = t2); c2 !== null; ) {
          var d = c2.dependencies;
          if (d !== null) {
            var h2 = c2.child;
            d = d.firstContext;
            e: for (; d !== null; ) {
              var y = d;
              d = c2;
              for (var R = 0; R < r2.length; R++) if (y.context === r2[R]) {
                d.lanes |= a2, y = d.alternate, y !== null && (y.lanes |= a2), Ot(d.return, a2, t2), l2 || (h2 = null);
                break e;
              }
              d = y.next;
            }
          } else if (c2.tag === 18) {
            if (h2 = c2.return, h2 === null) throw Error(F(341));
            h2.lanes |= a2, d = h2.alternate, d !== null && (d.lanes |= a2), Ot(h2, a2, t2), h2 = null;
          } else h2 = c2.child;
          if (h2 !== null) h2.return = c2;
          else for (h2 = c2; h2 !== null; ) {
            if (h2 === t2) {
              h2 = null;
              break;
            }
            if (c2 = h2.sibling, c2 !== null) {
              c2.return = h2.return, h2 = c2;
              break;
            }
            h2 = h2.return;
          }
          c2 = h2;
        }
      }
      function po(t2, r2, a2, l2) {
        t2 = null;
        for (var c2 = r2, d = false; c2 !== null; ) {
          if (!d) {
            if ((c2.flags & 524288) !== 0) d = true;
            else if ((c2.flags & 262144) !== 0) break;
          }
          if (c2.tag === 10) {
            var h2 = c2.alternate;
            if (h2 === null) throw Error(F(387));
            if (h2 = h2.memoizedProps, h2 !== null) {
              var y = c2.type;
              jn(c2.pendingProps.value, h2.value) || (t2 !== null ? t2.push(y) : t2 = [y]);
            }
          } else if (c2 === Fc.current) {
            if (h2 = c2.alternate, h2 === null) throw Error(F(387));
            h2.memoizedState.memoizedState !== c2.memoizedState.memoizedState && (t2 !== null ? t2.push(da) : t2 = [da]);
          }
          c2 = c2.return;
        }
        t2 !== null && _i(r2, t2, a2, l2), r2.flags |= 262144;
      }
      function Ri(t2) {
        for (t2 = t2.firstContext; t2 !== null; ) {
          var r2 = t2.context;
          if (!jn(qt ? r2._currentValue : r2._currentValue2, t2.memoizedValue)) return true;
          t2 = t2.next;
        }
        return false;
      }
      function Un(t2) {
        at = t2, Be = null, t2 = t2.dependencies, t2 !== null && (t2.firstContext = null);
      }
      function In(t2) {
        return Nd(at, t2);
      }
      function Wl(t2, r2) {
        return at === null && Un(t2), Nd(t2, r2);
      }
      function Nd(t2, r2) {
        var a2 = qt ? r2._currentValue : r2._currentValue2;
        if (r2 = {
          context: r2,
          memoizedValue: a2,
          next: null
        }, Be === null) {
          if (t2 === null) throw Error(F(308));
          Be = r2, t2.dependencies = {
            lanes: 0,
            firstContext: r2
          }, t2.flags |= 524288;
        } else Be = Be.next = r2;
        return a2;
      }
      function Fd() {
        return {
          controller: new Xr(),
          data: /* @__PURE__ */ new Map(),
          refCount: 0
        };
      }
      function Ra(t2) {
        t2.refCount--, t2.refCount === 0 && qn(Gm, function() {
          t2.controller.abort();
        });
      }
      function bu() {
      }
      function ir(t2) {
        t2 !== wt && t2.next === null && (wt === null ? an = wt = t2 : wt = wt.next = t2), ll = true, Mf || (Mf = true, Lm());
      }
      function Ea(t2, r2) {
        if (!ti && ll) {
          ti = true;
          do
            for (var a2 = false, l2 = an; l2 !== null; ) {
              if (!r2) if (t2 !== 0) {
                var c2 = l2.pendingLanes;
                if (c2 === 0) var d = 0;
                else {
                  var h2 = l2.suspendedLanes, y = l2.pingedLanes;
                  d = (1 << 31 - vt(42 | t2) + 1) - 1, d &= c2 & ~(h2 & ~y), d = d & 201326741 ? d & 201326741 | 1 : d ? d | 2 : 0;
                }
                d !== 0 && (a2 = true, Su(l2, d));
              } else d = he, d = Lr(l2, l2 === Ne ? d : 0, l2.cancelPendingCommit !== null || l2.timeoutHandle !== Lo), (d & 3) === 0 || Pi(l2, d) || (a2 = true, Su(l2, d));
              l2 = l2.next;
            }
          while (a2);
          ti = false;
        }
      }
      function Ip() {
        Lp();
      }
      function Lp() {
        ll = Mf = false;
        var t2 = 0;
        Pr !== 0 && _f() && (t2 = Pr);
        for (var r2 = ze(), a2 = null, l2 = an; l2 !== null; ) {
          var c2 = l2.next, d = vu(l2, r2);
          d === 0 ? (l2.next = null, a2 === null ? an = c2 : a2.next = c2, c2 === null && (wt = a2)) : (a2 = l2, (t2 !== 0 || (d & 3) !== 0) && (ll = true)), l2 = c2;
        }
        Re !== 0 && Re !== 5 || Ea(t2, false), Pr !== 0 && (Pr = 0);
      }
      function vu(t2, r2) {
        for (var a2 = t2.suspendedLanes, l2 = t2.pingedLanes, c2 = t2.expirationTimes, d = t2.pendingLanes & -62914561; 0 < d; ) {
          var h2 = 31 - vt(d), y = 1 << h2, R = c2[h2];
          R === -1 ? ((y & a2) === 0 || (y & l2) !== 0) && (c2[h2] = Tp(y, r2)) : R <= r2 && (t2.expiredLanes |= y), d &= ~y;
        }
        if (r2 = Ne, a2 = he, a2 = Lr(t2, t2 === r2 ? a2 : 0, t2.cancelPendingCommit !== null || t2.timeoutHandle !== Lo), l2 = t2.callbackNode, a2 === 0 || t2 === r2 && (_e === 2 || _e === 9) || t2.cancelPendingCommit !== null) return l2 !== null && l2 !== null && le(l2), t2.callbackNode = null, t2.callbackPriority = 0;
        if ((a2 & 3) === 0 || Pi(t2, a2)) {
          if (r2 = a2 & -a2, r2 === t2.callbackPriority) return r2;
          switch (l2 !== null && le(l2), Ze(a2)) {
            case 2:
            case 8:
              a2 = Ho;
              break;
            case 32:
              a2 = Ao;
              break;
            case 268435456:
              a2 = ol;
              break;
            default:
              a2 = Ao;
          }
          return l2 = dt.bind(null, t2), a2 = Ic(a2, l2), t2.callbackPriority = r2, t2.callbackNode = a2, r2;
        }
        return l2 !== null && l2 !== null && le(l2), t2.callbackPriority = 2, t2.callbackNode = null, 2;
      }
      function dt(t2, r2) {
        if (Re !== 0 && Re !== 5) return t2.callbackNode = null, t2.callbackPriority = 0, null;
        var a2 = t2.callbackNode;
        if (rn() && t2.callbackNode !== a2) return null;
        var l2 = he;
        return l2 = Lr(t2, t2 === Ne ? l2 : 0, t2.cancelPendingCommit !== null || t2.timeoutHandle !== Lo), l2 === 0 ? null : (uf(t2, l2, r2), vu(t2, ze()), t2.callbackNode != null && t2.callbackNode === a2 ? dt.bind(null, t2) : null);
      }
      function Su(t2, r2) {
        if (rn()) return null;
        uf(t2, r2, true);
      }
      function Lm() {
        ih ? Gr(function() {
          (ce & 6) !== 0 ? Ic(Uh, Ip) : Lp();
        }) : Ic(Uh, Ip);
      }
      function ku() {
        if (Pr === 0) {
          var t2 = sl;
          t2 === 0 && (t2 = As, As <<= 1, (As & 261888) === 0 && (As = 256)), Pr = t2;
        }
        return Pr;
      }
      function Np(t2, r2) {
        if (Us === null) {
          var a2 = Us = [];
          Qf = 0, sl = ku(), ul = {
            status: "pending",
            value: void 0,
            then: function(l2) {
              a2.push(l2);
            }
          };
        }
        return Qf++, r2.then(ft, ft), r2;
      }
      function ft() {
        if (--Qf === 0 && Us !== null) {
          ul !== null && (ul.status = "fulfilled");
          var t2 = Us;
          Us = null, sl = 0, ul = null;
          for (var r2 = 0; r2 < t2.length; r2++) (0, t2[r2])();
        }
      }
      function ho(t2, r2) {
        var a2 = [], l2 = {
          status: "pending",
          value: null,
          reason: null,
          then: function(c2) {
            a2.push(c2);
          }
        };
        return t2.then(function() {
          l2.status = "fulfilled", l2.value = r2;
          for (var c2 = 0; c2 < a2.length; c2++) (0, a2[c2])(r2);
        }, function(c2) {
          for (l2.status = "rejected", l2.reason = c2, c2 = 0; c2 < a2.length; c2++) (0, a2[c2])(void 0);
        }), l2;
      }
      function wu() {
        var t2 = ha.current;
        return t2 !== null ? t2 : Ne.pooledCache;
      }
      function Ei(t2, r2) {
        r2 === null ? Ce(ha, ha.current) : Ce(ha, r2.pool);
      }
      function Pu() {
        var t2 = wu();
        return t2 === null ? null : {
          parent: qt ? qe._currentValue : qe._currentValue2,
          pool: t2
        };
      }
      function Ul(t2, r2) {
        if (jn(t2, r2)) return true;
        if (typeof t2 != "object" || t2 === null || typeof r2 != "object" || r2 === null) return false;
        var a2 = Object.keys(t2), l2 = Object.keys(r2);
        if (a2.length !== l2.length) return false;
        for (l2 = 0; l2 < a2.length; l2++) {
          var c2 = a2[l2];
          if (!Bf.call(r2, c2) || !jn(t2[c2], r2[c2])) return false;
        }
        return true;
      }
      function Hd(t2) {
        return t2 = t2.status, t2 === "fulfilled" || t2 === "rejected";
      }
      function mo(t2, r2, a2) {
        switch (a2 = t2[a2], a2 === void 0 ? t2.push(r2) : a2 !== r2 && (r2.then(bu, bu), r2 = a2), r2.status) {
          case "fulfilled":
            return r2.value;
          case "rejected":
            throw t2 = r2.reason, Ia(t2), t2;
          default:
            if (typeof r2.status == "string") r2.then(bu, bu);
            else {
              if (t2 = Ne, t2 !== null && 100 < t2.shellSuspendCounter) throw Error(F(482));
              t2 = r2, t2.status = "pending", t2.then(function(l2) {
                if (r2.status === "pending") {
                  var c2 = r2;
                  c2.status = "fulfilled", c2.value = l2;
                }
              }, function(l2) {
                if (r2.status === "pending") {
                  var c2 = r2;
                  c2.status = "rejected", c2.reason = l2;
                }
              });
            }
            switch (r2.status) {
              case "fulfilled":
                return r2.value;
              case "rejected":
                throw t2 = r2.reason, Ia(t2), t2;
            }
            throw Xt = r2, cl;
        }
      }
      function pt(t2) {
        try {
          var r2 = t2._init;
          return r2(t2._payload);
        } catch (a2) {
          throw a2 !== null && typeof a2 == "object" && typeof a2.then == "function" ? (Xt = a2, cl) : a2;
        }
      }
      function Bl() {
        if (Xt === null) throw Error(F(459));
        var t2 = Xt;
        return Xt = null, t2;
      }
      function Ia(t2) {
        if (t2 === cl || t2 === jc) throw Error(F(483));
      }
      function Rt(t2) {
        var r2 = Bs;
        return Bs += 1, Kt === null && (Kt = []), mo(Kt, t2, r2);
      }
      function La(t2, r2) {
        r2 = r2.props.ref, t2.ref = r2 !== void 0 ? r2 : null;
      }
      function Na(t2, r2) {
        throw r2.$$typeof === hc ? Error(F(525)) : (t2 = Object.prototype.toString.call(r2), Error(F(31, t2 === "[object Object]" ? "object with keys {" + Object.keys(r2).join(", ") + "}" : t2)));
      }
      function Ad(t2) {
        function r2(P, w) {
          if (t2) {
            var C = P.deletions;
            C === null ? (P.deletions = [w], P.flags |= 16) : C.push(w);
          }
        }
        function a2(P, w) {
          if (!t2) return null;
          for (; w !== null; ) r2(P, w), w = w.sibling;
          return null;
        }
        function l2(P) {
          for (var w = /* @__PURE__ */ new Map(); P !== null; ) P.key !== null ? w.set(P.key, P) : w.set(P.index, P), P = P.sibling;
          return w;
        }
        function c2(P, w) {
          return P = Qr(P, w), P.index = 0, P.sibling = null, P;
        }
        function d(P, w, C) {
          return P.index = C, t2 ? (C = P.alternate, C !== null ? (C = C.index, C < w ? (P.flags |= 67108866, w) : C) : (P.flags |= 67108866, w)) : (P.flags |= 1048576, w);
        }
        function h2(P) {
          return t2 && P.alternate === null && (P.flags |= 67108866), P;
        }
        function y(P, w, C, H) {
          return w === null || w.tag !== 6 ? (w = Ps(C, P.mode, H), w.return = P, w) : (w = c2(w, C), w.return = P, w);
        }
        function R(P, w, C, H) {
          var Q = C.type;
          return Q === $a ? j2(P, w, C.props.children, H, C.key) : w !== null && (w.elementType === Q || typeof Q == "object" && Q !== null && Q.$$typeof === ua && pt(Q) === w.type) ? (w = c2(w, C.props), La(w, C), w.return = P, w) : (w = ws(C.type, C.key, C.props, null, P.mode, H), La(w, C), w.return = P, w);
        }
        function L(P, w, C, H) {
          return w === null || w.tag !== 4 || w.stateNode.containerInfo !== C.containerInfo || w.stateNode.implementation !== C.implementation ? (w = dc(C, P.mode, H), w.return = P, w) : (w = c2(w, C.children || []), w.return = P, w);
        }
        function j2(P, w, C, H, Q) {
          return w === null || w.tag !== 7 ? (w = Eo(C, P.mode, H, Q), w.return = P, w) : (w = c2(w, C), w.return = P, w);
        }
        function A(P, w, C) {
          if (typeof w == "string" && w !== "" || typeof w == "number" || typeof w == "bigint") return w = Ps("" + w, P.mode, C), w.return = P, w;
          if (typeof w == "object" && w !== null) {
            switch (w.$$typeof) {
              case zs:
                return C = ws(w.type, w.key, w.props, null, P.mode, C), La(C, w), C.return = P, C;
              case sa:
                return w = dc(w, P.mode, C), w.return = P, w;
              case ua:
                return w = pt(w), A(P, w, C);
            }
            if (ca(w) || Fl(w)) return w = Eo(w, P.mode, C, null), w.return = P, w;
            if (typeof w.then == "function") return A(P, Rt(w), C);
            if (w.$$typeof === Io) return A(P, Wl(P, w), C);
            Na(P, w);
          }
          return null;
        }
        function W2(P, w, C, H) {
          var Q = w !== null ? w.key : null;
          if (typeof C == "string" && C !== "" || typeof C == "number" || typeof C == "bigint") return Q !== null ? null : y(P, w, "" + C, H);
          if (typeof C == "object" && C !== null) {
            switch (C.$$typeof) {
              case zs:
                return C.key === Q ? R(P, w, C, H) : null;
              case sa:
                return C.key === Q ? L(P, w, C, H) : null;
              case ua:
                return C = pt(C), W2(P, w, C, H);
            }
            if (ca(C) || Fl(C)) return Q !== null ? null : j2(P, w, C, H, null);
            if (typeof C.then == "function") return W2(P, w, Rt(C), H);
            if (C.$$typeof === Io) return W2(P, w, Wl(P, C), H);
            Na(P, C);
          }
          return null;
        }
        function V(P, w, C, H, Q) {
          if (typeof H == "string" && H !== "" || typeof H == "number" || typeof H == "bigint") return P = P.get(C) || null, y(w, P, "" + H, Q);
          if (typeof H == "object" && H !== null) {
            switch (H.$$typeof) {
              case zs:
                return P = P.get(H.key === null ? C : H.key) || null, R(w, P, H, Q);
              case sa:
                return P = P.get(H.key === null ? C : H.key) || null, L(w, P, H, Q);
              case ua:
                return H = pt(H), V(P, w, C, H, Q);
            }
            if (ca(H) || Fl(H)) return P = P.get(C) || null, j2(w, P, H, Q, null);
            if (typeof H.then == "function") return V(P, w, C, Rt(H), Q);
            if (H.$$typeof === Io) return V(P, w, C, Wl(w, H), Q);
            Na(w, H);
          }
          return null;
        }
        function Oe(P, w, C, H) {
          for (var Q = null, Ge = null, J = w, Pe = w = 0, me = null; J !== null && Pe < C.length; Pe++) {
            J.index > Pe ? (me = J, J = null) : me = J.sibling;
            var be = W2(P, J, C[Pe], H);
            if (be === null) {
              J === null && (J = me);
              break;
            }
            t2 && J && be.alternate === null && r2(P, J), w = d(be, w, Pe), Ge === null ? Q = be : Ge.sibling = be, Ge = be, J = me;
          }
          if (Pe === C.length) return a2(P, J), ue && or(P, Pe), Q;
          if (J === null) {
            for (; Pe < C.length; Pe++) J = A(P, C[Pe], H), J !== null && (w = d(J, w, Pe), Ge === null ? Q = J : Ge.sibling = J, Ge = J);
            return ue && or(P, Pe), Q;
          }
          for (J = l2(J); Pe < C.length; Pe++) me = V(J, P, Pe, C[Pe], H), me !== null && (t2 && me.alternate !== null && J.delete(me.key === null ? Pe : me.key), w = d(me, w, Pe), Ge === null ? Q = me : Ge.sibling = me, Ge = me);
          return t2 && J.forEach(function(Oo) {
            return r2(P, Oo);
          }), ue && or(P, Pe), Q;
        }
        function vn(P, w, C, H) {
          if (C == null) throw Error(F(151));
          for (var Q = null, Ge = null, J = w, Pe = w = 0, me = null, be = C.next(); J !== null && !be.done; Pe++, be = C.next()) {
            J.index > Pe ? (me = J, J = null) : me = J.sibling;
            var Oo = W2(P, J, be.value, H);
            if (Oo === null) {
              J === null && (J = me);
              break;
            }
            t2 && J && Oo.alternate === null && r2(P, J), w = d(Oo, w, Pe), Ge === null ? Q = Oo : Ge.sibling = Oo, Ge = Oo, J = me;
          }
          if (be.done) return a2(P, J), ue && or(P, Pe), Q;
          if (J === null) {
            for (; !be.done; Pe++, be = C.next()) be = A(P, be.value, H), be !== null && (w = d(be, w, Pe), Ge === null ? Q = be : Ge.sibling = be, Ge = be);
            return ue && or(P, Pe), Q;
          }
          for (J = l2(J); !be.done; Pe++, be = C.next()) be = V(J, P, Pe, be.value, H), be !== null && (t2 && be.alternate !== null && J.delete(be.key === null ? Pe : be.key), w = d(be, w, Pe), Ge === null ? Q = be : Ge.sibling = be, Ge = be);
          return t2 && J.forEach(function(qs) {
            return r2(P, qs);
          }), ue && or(P, Pe), Q;
        }
        function li(P, w, C, H) {
          if (typeof C == "object" && C !== null && C.type === $a && C.key === null && (C = C.props.children), typeof C == "object" && C !== null) {
            switch (C.$$typeof) {
              case zs:
                e: {
                  for (var Q = C.key; w !== null; ) {
                    if (w.key === Q) {
                      if (Q = C.type, Q === $a) {
                        if (w.tag === 7) {
                          a2(P, w.sibling), H = c2(w, C.props.children), H.return = P, P = H;
                          break e;
                        }
                      } else if (w.elementType === Q || typeof Q == "object" && Q !== null && Q.$$typeof === ua && pt(Q) === w.type) {
                        a2(P, w.sibling), H = c2(w, C.props), La(H, C), H.return = P, P = H;
                        break e;
                      }
                      a2(P, w);
                      break;
                    } else r2(P, w);
                    w = w.sibling;
                  }
                  C.type === $a ? (H = Eo(C.props.children, P.mode, H, C.key), H.return = P, P = H) : (H = ws(C.type, C.key, C.props, null, P.mode, H), La(H, C), H.return = P, P = H);
                }
                return h2(P);
              case sa:
                e: {
                  for (Q = C.key; w !== null; ) {
                    if (w.key === Q) {
                      if (w.tag === 4 && w.stateNode.containerInfo === C.containerInfo && w.stateNode.implementation === C.implementation) {
                        a2(P, w.sibling), H = c2(w, C.children || []), H.return = P, P = H;
                        break e;
                      } else {
                        a2(P, w);
                        break;
                      }
                    } else r2(P, w);
                    w = w.sibling;
                  }
                  H = dc(C, P.mode, H), H.return = P, P = H;
                }
                return h2(P);
              case ua:
                return C = pt(C), li(P, w, C, H);
            }
            if (ca(C)) return Oe(P, w, C, H);
            if (Fl(C)) {
              if (Q = Fl(C), typeof Q != "function") throw Error(F(150));
              return C = Q.call(C), vn(P, w, C, H);
            }
            if (typeof C.then == "function") return li(P, w, Rt(C), H);
            if (C.$$typeof === Io) return li(P, w, Wl(P, C), H);
            Na(P, C);
          }
          return typeof C == "string" && C !== "" || typeof C == "number" || typeof C == "bigint" ? (C = "" + C, w !== null && w.tag === 6 ? (a2(P, w.sibling), H = c2(w, C), H.return = P, P = H) : (a2(P, w), H = Ps(C, P.mode, H), H.return = P, P = H), h2(P)) : a2(P, w);
        }
        return function(P, w, C, H) {
          try {
            Bs = 0;
            var Q = li(P, w, C, H);
            return Kt = null, Q;
          } catch (J) {
            if (J === cl || J === jc) throw J;
            var Ge = Yn(29, J, null, P.mode);
            return Ge.lanes = H, Ge.return = P, Ge;
          } finally {
          }
        };
      }
      function Bn() {
        for (var t2 = xr, r2 = $f = xr = 0; r2 < t2; ) {
          var a2 = er[r2];
          er[r2++] = null;
          var l2 = er[r2];
          er[r2++] = null;
          var c2 = er[r2];
          er[r2++] = null;
          var d = er[r2];
          if (er[r2++] = null, l2 !== null && c2 !== null) {
            var h2 = l2.pending;
            h2 === null ? c2.next = c2 : (c2.next = h2.next, h2.next = c2), l2.pending = c2;
          }
          d !== 0 && Ii(a2, c2, d);
        }
      }
      function go(t2, r2, a2, l2) {
        er[xr++] = t2, er[xr++] = r2, er[xr++] = a2, er[xr++] = l2, $f |= l2, t2.lanes |= l2, t2 = t2.alternate, t2 !== null && (t2.lanes |= l2);
      }
      function yo(t2, r2, a2, l2) {
        return go(t2, r2, a2, l2), Fa(t2);
      }
      function Ko(t2, r2) {
        return go(t2, null, null, r2), Fa(t2);
      }
      function Ii(t2, r2, a2) {
        t2.lanes |= a2;
        var l2 = t2.alternate;
        l2 !== null && (l2.lanes |= a2);
        for (var c2 = false, d = t2.return; d !== null; ) d.childLanes |= a2, l2 = d.alternate, l2 !== null && (l2.childLanes |= a2), d.tag === 22 && (t2 = d.stateNode, t2 === null || t2._visibility & 1 || (c2 = true)), t2 = d, d = d.return;
        return t2.tag === 3 ? (d = t2.stateNode, c2 && r2 !== null && (c2 = 31 - vt(a2), t2 = d.hiddenUpdates, l2 = t2[c2], l2 === null ? t2[c2] = [r2] : l2.push(r2), r2.lane = a2 | 536870912), d) : null;
      }
      function Fa(t2) {
        if (50 < gl) throw gl = 0, nd = null, Error(F(185));
        for (var r2 = t2.return; r2 !== null; ) t2 = r2, r2 = t2.return;
        return t2.tag === 3 ? t2.stateNode : null;
      }
      function Ol(t2) {
        t2.updateQueue = {
          baseState: t2.memoizedState,
          firstBaseUpdate: null,
          lastBaseUpdate: null,
          shared: {
            pending: null,
            lanes: 0,
            hiddenCallbacks: null
          },
          callbacks: null
        };
      }
      function Ha(t2, r2) {
        t2 = t2.updateQueue, r2.updateQueue === t2 && (r2.updateQueue = {
          baseState: t2.baseState,
          firstBaseUpdate: t2.firstBaseUpdate,
          lastBaseUpdate: t2.lastBaseUpdate,
          shared: t2.shared,
          callbacks: null
        });
      }
      function Et(t2) {
        return {
          lane: t2,
          tag: 0,
          payload: null,
          callback: null,
          next: null
        };
      }
      function Nr(t2, r2, a2) {
        var l2 = t2.updateQueue;
        if (l2 === null) return null;
        if (l2 = l2.shared, (ce & 2) !== 0) {
          var c2 = l2.pending;
          return c2 === null ? r2.next = r2 : (r2.next = c2.next, c2.next = r2), l2.pending = r2, r2 = Fa(t2), Ii(t2, null, a2), r2;
        }
        return go(t2, l2, r2, a2), Fa(t2);
      }
      function Ml(t2, r2, a2) {
        if (r2 = r2.updateQueue, r2 !== null && (r2 = r2.shared, (a2 & 4194048) !== 0)) {
          var l2 = r2.lanes;
          l2 &= t2.pendingLanes, a2 |= l2, r2.lanes = a2, $e(t2, a2);
        }
      }
      function jd(t2, r2) {
        var a2 = t2.updateQueue, l2 = t2.alternate;
        if (l2 !== null && (l2 = l2.updateQueue, a2 === l2)) {
          var c2 = null, d = null;
          if (a2 = a2.firstBaseUpdate, a2 !== null) {
            do {
              var h2 = {
                lane: a2.lane,
                tag: a2.tag,
                payload: a2.payload,
                callback: null,
                next: null
              };
              d === null ? c2 = d = h2 : d = d.next = h2, a2 = a2.next;
            } while (a2 !== null);
            d === null ? c2 = d = r2 : d = d.next = r2;
          } else c2 = d = r2;
          a2 = {
            baseState: l2.baseState,
            firstBaseUpdate: c2,
            lastBaseUpdate: d,
            shared: l2.shared,
            callbacks: l2.callbacks
          }, t2.updateQueue = a2;
          return;
        }
        t2 = a2.lastBaseUpdate, t2 === null ? a2.firstBaseUpdate = r2 : t2.next = r2, a2.lastBaseUpdate = r2;
      }
      function Li() {
        if (Vf) {
          var t2 = ul;
          if (t2 !== null) throw t2;
        }
      }
      function Aa(t2, r2, a2, l2) {
        Vf = false;
        var c2 = t2.updateQueue;
        ma = false;
        var d = c2.firstBaseUpdate, h2 = c2.lastBaseUpdate, y = c2.shared.pending;
        if (y !== null) {
          c2.shared.pending = null;
          var R = y, L = R.next;
          R.next = null, h2 === null ? d = L : h2.next = L, h2 = R;
          var j2 = t2.alternate;
          j2 !== null && (j2 = j2.updateQueue, y = j2.lastBaseUpdate, y !== h2 && (y === null ? j2.firstBaseUpdate = L : y.next = L, j2.lastBaseUpdate = R));
        }
        if (d !== null) {
          var A = c2.baseState;
          h2 = 0, j2 = L = R = null, y = d;
          do {
            var W2 = y.lane & -536870913, V = W2 !== y.lane;
            if (V ? (he & W2) === W2 : (l2 & W2) === W2) {
              W2 !== 0 && W2 === sl && (Vf = true), j2 !== null && (j2 = j2.next = {
                lane: 0,
                tag: y.tag,
                payload: y.payload,
                callback: null,
                next: null
              });
              e: {
                var Oe = t2, vn = y;
                W2 = r2;
                var li = a2;
                switch (vn.tag) {
                  case 1:
                    if (Oe = vn.payload, typeof Oe == "function") {
                      A = Oe.call(li, A, W2);
                      break e;
                    }
                    A = Oe;
                    break e;
                  case 3:
                    Oe.flags = Oe.flags & -65537 | 128;
                  case 0:
                    if (Oe = vn.payload, W2 = typeof Oe == "function" ? Oe.call(li, A, W2) : Oe, W2 == null) break e;
                    A = Lt({}, A, W2);
                    break e;
                  case 2:
                    ma = true;
                }
              }
              W2 = y.callback, W2 !== null && (t2.flags |= 64, V && (t2.flags |= 8192), V = c2.callbacks, V === null ? c2.callbacks = [W2] : V.push(W2));
            } else V = {
              lane: W2,
              tag: y.tag,
              payload: y.payload,
              callback: y.callback,
              next: null
            }, j2 === null ? (L = j2 = V, R = A) : j2 = j2.next = V, h2 |= W2;
            if (y = y.next, y === null) {
              if (y = c2.shared.pending, y === null) break;
              V = y, y = V.next, V.next = null, c2.lastBaseUpdate = V, c2.shared.pending = null;
            }
          } while (true);
          j2 === null && (R = A), c2.baseState = R, c2.firstBaseUpdate = L, c2.lastBaseUpdate = j2, d === null && (c2.shared.lanes = 0), ba |= h2, t2.lanes = h2, t2.memoizedState = A;
        }
      }
      function Dd(t2, r2) {
        if (typeof t2 != "function") throw Error(F(191, t2));
        t2.call(r2);
      }
      function Fp(t2, r2) {
        var a2 = t2.callbacks;
        if (a2 !== null) for (t2.callbacks = null, t2 = 0; t2 < a2.length; t2++) Dd(a2[t2], r2);
      }
      function B(t2, r2) {
        t2 = Uo, Ce(Wc, t2), Ce(Kr, r2), Uo = t2 | r2.baseLanes;
      }
      function Ql() {
        Ce(Wc, Uo), Ce(Kr, Kr.current);
      }
      function bo() {
        Uo = Wc.current, D2(Kr), D2(Wc);
      }
      function vo(t2) {
        var r2 = t2.alternate;
        Ce(ln, ln.current & 1), Ce(Ft, t2), zr === null && (r2 === null || Kr.current !== null || r2.memoizedState !== null) && (zr = t2);
      }
      function Ni(t2) {
        Ce(ln, ln.current), Ce(Ft, t2), zr === null && (zr = t2);
      }
      function Fr(t2) {
        t2.tag === 22 ? (Ce(ln, ln.current), Ce(Ft, t2), zr === null && (zr = t2)) : So();
      }
      function So() {
        Ce(ln, ln.current), Ce(Ft, Ft.current);
      }
      function ht(t2) {
        D2(Ft), zr === t2 && (zr = null), D2(ln);
      }
      function ko(t2) {
        for (var r2 = t2; r2 !== null; ) {
          if (r2.tag === 13) {
            var a2 = r2.memoizedState;
            if (a2 !== null && (a2 = a2.dehydrated, a2 === null || Ns(a2) || Fs(a2))) return r2;
          } else if (r2.tag === 19 && (r2.memoizedProps.revealOrder === "forwards" || r2.memoizedProps.revealOrder === "backwards" || r2.memoizedProps.revealOrder === "unstable_legacy-backwards" || r2.memoizedProps.revealOrder === "together")) {
            if ((r2.flags & 128) !== 0) return r2;
          } else if (r2.child !== null) {
            r2.child.return = r2, r2 = r2.child;
            continue;
          }
          if (r2 === t2) break;
          for (; r2.sibling === null; ) {
            if (r2.return === null || r2.return === t2) return null;
            r2 = r2.return;
          }
          r2.sibling.return = r2.return, r2 = r2.sibling;
        }
        return null;
      }
      function Ve() {
        throw Error(F(321));
      }
      function wo(t2, r2) {
        if (r2 === null) return false;
        for (var a2 = 0; a2 < r2.length && a2 < t2.length; a2++) if (!jn(t2[a2], r2[a2])) return false;
        return true;
      }
      function $l(t2, r2, a2, l2, c2, d) {
        return Wo = d, ne = r2, r2.memoizedState = null, r2.updateQueue = null, r2.lanes = 0, M2.H = t2 === null || t2.memoizedState === null ? Mh : qf, oi = false, d = a2(l2, c2), oi = false, dl && (d = xu(r2, a2, l2, c2)), Fi(t2), d;
      }
      function Fi(t2) {
        M2.H = Os;
        var r2 = Ie !== null && Ie.next !== null;
        if (Wo = 0, pn = Ie = ne = null, Uc = false, fl = 0, pl = null, r2) throw Error(F(300));
        t2 === null || hn || (t2 = t2.dependencies, t2 !== null && Ri(t2) && (hn = true));
      }
      function xu(t2, r2, a2, l2) {
        ne = t2;
        var c2 = 0;
        do {
          if (dl && (pl = null), fl = 0, dl = false, 25 <= c2) throw Error(F(301));
          if (c2 += 1, pn = Ie = null, t2.updateQueue != null) {
            var d = t2.updateQueue;
            d.lastEffect = null, d.events = null, d.stores = null, d.memoCache != null && (d.memoCache.index = 0);
          }
          M2.H = Qh, d = r2(a2, l2);
        } while (dl);
        return d;
      }
      function zu() {
        var t2 = M2.H, r2 = t2.useState()[0];
        return r2 = typeof r2.then == "function" ? sr(r2) : r2, t2 = t2.useState()[0], (Ie !== null ? Ie.memoizedState : null) !== t2 && (ne.flags |= 1024), r2;
      }
      function Hr() {
        var t2 = Bc !== 0;
        return Bc = 0, t2;
      }
      function lr(t2, r2, a2) {
        r2.updateQueue = t2.updateQueue, r2.flags &= -2053, t2.lanes &= ~a2;
      }
      function Vl(t2) {
        if (Uc) {
          for (t2 = t2.memoizedState; t2 !== null; ) {
            var r2 = t2.queue;
            r2 !== null && (r2.pending = null), t2 = t2.next;
          }
          Uc = false;
        }
        Wo = 0, pn = Ie = ne = null, dl = false, fl = Bc = 0, pl = null;
      }
      function Ln() {
        var t2 = {
          memoizedState: null,
          baseState: null,
          baseQueue: null,
          queue: null,
          next: null
        };
        return pn === null ? ne.memoizedState = pn = t2 : pn = pn.next = t2, pn;
      }
      function He() {
        if (Ie === null) {
          var t2 = ne.alternate;
          t2 = t2 !== null ? t2.memoizedState : null;
        } else t2 = Ie.next;
        var r2 = pn === null ? ne.memoizedState : pn.next;
        if (r2 !== null) pn = r2, Ie = t2;
        else {
          if (t2 === null) throw ne.alternate === null ? Error(F(467)) : Error(F(310));
          Ie = t2, t2 = {
            memoizedState: Ie.memoizedState,
            baseState: Ie.baseState,
            baseQueue: Ie.baseQueue,
            queue: Ie.queue,
            next: null
          }, pn === null ? ne.memoizedState = pn = t2 : pn = pn.next = t2;
        }
        return pn;
      }
      function ja() {
        return {
          lastEffect: null,
          events: null,
          stores: null,
          memoCache: null
        };
      }
      function sr(t2) {
        var r2 = fl;
        return fl += 1, pl === null && (pl = []), t2 = mo(pl, t2, r2), r2 = ne, (pn === null ? r2.memoizedState : pn.next) === null && (r2 = r2.alternate, M2.H = r2 === null || r2.memoizedState === null ? Mh : qf), t2;
      }
      function Ee(t2) {
        if (t2 !== null && typeof t2 == "object") {
          if (typeof t2.then == "function") return sr(t2);
          if (t2.$$typeof === Io) return In(t2);
        }
        throw Error(F(438, String(t2)));
      }
      function Hi(t2) {
        var r2 = null, a2 = ne.updateQueue;
        if (a2 !== null && (r2 = a2.memoCache), r2 == null) {
          var l2 = ne.alternate;
          l2 !== null && (l2 = l2.updateQueue, l2 !== null && (l2 = l2.memoCache, l2 != null && (r2 = {
            data: l2.data.map(function(c2) {
              return c2.slice();
            }),
            index: 0
          })));
        }
        if (r2 == null && (r2 = {
          data: [],
          index: 0
        }), a2 === null && (a2 = ja(), ne.updateQueue = a2), a2.memoCache = r2, a2 = r2.data[r2.index], a2 === void 0) for (a2 = r2.data[r2.index] = Array(t2), l2 = 0; l2 < t2; l2++) a2[l2] = $r;
        return r2.index++, a2;
      }
      function Ar(t2, r2) {
        return typeof r2 == "function" ? r2(t2) : r2;
      }
      function Ai(t2) {
        var r2 = He();
        return Po(r2, Ie, t2);
      }
      function Po(t2, r2, a2) {
        var l2 = t2.queue;
        if (l2 === null) throw Error(F(311));
        l2.lastRenderedReducer = a2;
        var c2 = t2.baseQueue, d = l2.pending;
        if (d !== null) {
          if (c2 !== null) {
            var h2 = c2.next;
            c2.next = d.next, d.next = h2;
          }
          r2.baseQueue = c2 = d, l2.pending = null;
        }
        if (d = t2.baseState, c2 === null) t2.memoizedState = d;
        else {
          r2 = c2.next;
          var y = h2 = null, R = null, L = r2, j2 = false;
          do {
            var A = L.lane & -536870913;
            if (A !== L.lane ? (he & A) === A : (Wo & A) === A) {
              var W2 = L.revertLane;
              if (W2 === 0) R !== null && (R = R.next = {
                lane: 0,
                revertLane: 0,
                gesture: null,
                action: L.action,
                hasEagerState: L.hasEagerState,
                eagerState: L.eagerState,
                next: null
              }), A === sl && (j2 = true);
              else if ((Wo & W2) === W2) {
                L = L.next, W2 === sl && (j2 = true);
                continue;
              } else A = {
                lane: 0,
                revertLane: L.revertLane,
                gesture: null,
                action: L.action,
                hasEagerState: L.hasEagerState,
                eagerState: L.eagerState,
                next: null
              }, R === null ? (y = R = A, h2 = d) : R = R.next = A, ne.lanes |= W2, ba |= W2;
              A = L.action, oi && a2(d, A), d = L.hasEagerState ? L.eagerState : a2(d, A);
            } else W2 = {
              lane: A,
              revertLane: L.revertLane,
              gesture: L.gesture,
              action: L.action,
              hasEagerState: L.hasEagerState,
              eagerState: L.eagerState,
              next: null
            }, R === null ? (y = R = W2, h2 = d) : R = R.next = W2, ne.lanes |= A, ba |= A;
            L = L.next;
          } while (L !== null && L !== r2);
          if (R === null ? h2 = d : R.next = y, !jn(d, t2.memoizedState) && (hn = true, j2 && (a2 = ul, a2 !== null))) throw a2;
          t2.memoizedState = d, t2.baseState = h2, t2.baseQueue = R, l2.lastRenderedState = d;
        }
        return c2 === null && (l2.lanes = 0), [t2.memoizedState, l2.dispatch];
      }
      function Da(t2) {
        var r2 = He(), a2 = r2.queue;
        if (a2 === null) throw Error(F(311));
        a2.lastRenderedReducer = t2;
        var l2 = a2.dispatch, c2 = a2.pending, d = r2.memoizedState;
        if (c2 !== null) {
          a2.pending = null;
          var h2 = c2 = c2.next;
          do
            d = t2(d, h2.action), h2 = h2.next;
          while (h2 !== c2);
          jn(d, r2.memoizedState) || (hn = true), r2.memoizedState = d, r2.baseQueue === null && (r2.baseState = d), a2.lastRenderedState = d;
        }
        return [d, l2];
      }
      function ur(t2, r2, a2) {
        var l2 = ne, c2 = He(), d = ue;
        if (d) {
          if (a2 === void 0) throw Error(F(407));
          a2 = a2();
        } else a2 = r2();
        var h2 = !jn((Ie || c2).memoizedState, a2);
        if (h2 && (c2.memoizedState = a2, hn = true), c2 = c2.queue, Tu(ql.bind(null, l2, c2, t2), [t2]), c2.getSnapshot !== r2 || h2 || pn !== null && pn.memoizedState.tag & 1) {
          if (l2.flags |= 2048, Kn(9, {
            destroy: void 0
          }, jr.bind(null, l2, c2, a2, r2), null), Ne === null) throw Error(F(349));
          d || (Wo & 127) !== 0 || Hp(l2, r2, a2);
        }
        return a2;
      }
      function Hp(t2, r2, a2) {
        t2.flags |= 16384, t2 = {
          getSnapshot: r2,
          value: a2
        }, r2 = ne.updateQueue, r2 === null ? (r2 = ja(), ne.updateQueue = r2, r2.stores = [t2]) : (a2 = r2.stores, a2 === null ? r2.stores = [t2] : a2.push(t2));
      }
      function jr(t2, r2, a2, l2) {
        r2.value = a2, r2.getSnapshot = l2, ji(r2) && Gl(t2);
      }
      function ql(t2, r2, a2) {
        return a2(function() {
          ji(r2) && Gl(t2);
        });
      }
      function ji(t2) {
        var r2 = t2.getSnapshot;
        t2 = t2.value;
        try {
          var a2 = r2();
          return !jn(t2, a2);
        } catch {
          return true;
        }
      }
      function Gl(t2) {
        var r2 = Ko(t2, 2);
        r2 !== null && nt(r2, t2, 2);
      }
      function Xn(t2) {
        var r2 = Ln();
        if (typeof t2 == "function") {
          var a2 = t2;
          if (t2 = a2(), oi) {
            pe(true);
            try {
              a2();
            } finally {
              pe(false);
            }
          }
        }
        return r2.memoizedState = r2.baseState = t2, r2.queue = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Ar,
          lastRenderedState: t2
        }, r2;
      }
      function mt(t2, r2, a2, l2) {
        return t2.baseState = a2, Po(t2, Ie, typeof l2 == "function" ? l2 : Ar);
      }
      function Dr(t2, r2, a2, l2, c2) {
        if (na(t2)) throw Error(F(485));
        if (t2 = r2.action, t2 !== null) {
          var d = {
            payload: c2,
            action: t2,
            next: null,
            isTransition: true,
            status: "pending",
            value: null,
            reason: null,
            listeners: [],
            then: function(h2) {
              d.listeners.push(h2);
            }
          };
          M2.T !== null ? a2(true) : d.isTransition = false, l2(d), a2 = r2.pending, a2 === null ? (d.next = r2.pending = d, cr(r2, d)) : (d.next = a2.next, r2.pending = a2.next = d);
        }
      }
      function cr(t2, r2) {
        var a2 = r2.action, l2 = r2.payload, c2 = t2.state;
        if (r2.isTransition) {
          var d = M2.T, h2 = {};
          M2.T = h2;
          try {
            var y = a2(c2, l2), R = M2.S;
            R !== null && R(h2, y), dr(t2, r2, y);
          } catch (L) {
            Jl(t2, r2, L);
          } finally {
            d !== null && h2.types !== null && (d.types = h2.types), M2.T = d;
          }
        } else try {
          d = a2(c2, l2), dr(t2, r2, d);
        } catch (L) {
          Jl(t2, r2, L);
        }
      }
      function dr(t2, r2, a2) {
        a2 !== null && typeof a2 == "object" && typeof a2.then == "function" ? a2.then(function(l2) {
          fr(t2, r2, l2);
        }, function(l2) {
          return Jl(t2, r2, l2);
        }) : fr(t2, r2, a2);
      }
      function fr(t2, r2, a2) {
        r2.status = "fulfilled", r2.value = a2, Cu(r2), t2.state = a2, r2 = t2.pending, r2 !== null && (a2 = r2.next, a2 === r2 ? t2.pending = null : (a2 = a2.next, r2.next = a2, cr(t2, a2)));
      }
      function Jl(t2, r2, a2) {
        var l2 = t2.pending;
        if (t2.pending = null, l2 !== null) {
          l2 = l2.next;
          do
            r2.status = "rejected", r2.reason = a2, Cu(r2), r2 = r2.next;
          while (r2 !== l2);
        }
        t2.action = null;
      }
      function Cu(t2) {
        t2 = t2.listeners;
        for (var r2 = 0; r2 < t2.length; r2++) (0, t2[r2])();
      }
      function Wd(t2, r2) {
        return r2;
      }
      function pr(t2, r2) {
        if (ue) {
          var a2 = Ne.formState;
          if (a2 !== null) {
            e: {
              var l2 = ne;
              if (ue) {
                if (Ue) {
                  var c2 = vh(Ue, Yt);
                  if (c2) {
                    Ue = Nf(c2), l2 = Sh(c2);
                    break e;
                  }
                }
                ar(l2);
              }
              l2 = false;
            }
            l2 && (r2 = a2[0]);
          }
        }
        a2 = Ln(), a2.memoizedState = a2.baseState = r2, l2 = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Wd,
          lastRenderedState: r2
        }, a2.queue = l2, a2 = Nu.bind(null, ne, l2), l2.dispatch = a2, l2 = Xn(false);
        var d = Wi.bind(null, ne, false, l2.queue);
        return l2 = Ln(), c2 = {
          state: r2,
          dispatch: null,
          action: t2,
          pending: null
        }, l2.queue = c2, a2 = Dr.bind(null, ne, c2, d, a2), c2.dispatch = a2, l2.memoizedState = t2, [r2, a2, false];
      }
      function Ud(t2) {
        var r2 = He();
        return hr(r2, Ie, t2);
      }
      function hr(t2, r2, a2) {
        if (r2 = Po(t2, r2, Wd)[0], t2 = Ai(Ar)[0], typeof r2 == "object" && r2 !== null && typeof r2.then == "function") try {
          var l2 = sr(r2);
        } catch (h2) {
          throw h2 === cl ? jc : h2;
        }
        else l2 = r2;
        r2 = He();
        var c2 = r2.queue, d = c2.dispatch;
        return a2 !== r2.memoizedState && (ne.flags |= 2048, Kn(9, {
          destroy: void 0
        }, Zl.bind(null, c2, a2), null)), [l2, d, t2];
      }
      function Zl(t2, r2) {
        t2.action = r2;
      }
      function Yl(t2) {
        var r2 = He(), a2 = Ie;
        if (a2 !== null) return hr(r2, a2, t2);
        He(), r2 = r2.memoizedState, a2 = He();
        var l2 = a2.queue.dispatch;
        return a2.memoizedState = t2, [r2, l2, false];
      }
      function Kn(t2, r2, a2, l2) {
        return t2 = {
          tag: t2,
          create: a2,
          deps: l2,
          inst: r2,
          next: null
        }, r2 = ne.updateQueue, r2 === null && (r2 = ja(), ne.updateQueue = r2), a2 = r2.lastEffect, a2 === null ? r2.lastEffect = t2.next = t2 : (l2 = a2.next, a2.next = t2, t2.next = l2, r2.lastEffect = t2), t2;
      }
      function Wa() {
        return He().memoizedState;
      }
      function Xl(t2, r2, a2, l2) {
        var c2 = Ln();
        ne.flags |= t2, c2.memoizedState = Kn(1 | r2, {
          destroy: void 0
        }, a2, l2 === void 0 ? null : l2);
      }
      function Di(t2, r2, a2, l2) {
        var c2 = He();
        l2 = l2 === void 0 ? null : l2;
        var d = c2.memoizedState.inst;
        Ie !== null && l2 !== null && wo(l2, Ie.memoizedState.deps) ? c2.memoizedState = Kn(r2, d, a2, l2) : (ne.flags |= t2, c2.memoizedState = Kn(1 | r2, d, a2, l2));
      }
      function Bd(t2, r2) {
        Xl(8390656, 8, t2, r2);
      }
      function Tu(t2, r2) {
        Di(2048, 8, t2, r2);
      }
      function Ap(t2) {
        ne.flags |= 4;
        var r2 = ne.updateQueue;
        if (r2 === null) r2 = ja(), ne.updateQueue = r2, r2.events = [t2];
        else {
          var a2 = r2.events;
          a2 === null ? r2.events = [t2] : a2.push(t2);
        }
      }
      function _u(t2) {
        var r2 = He().memoizedState;
        return Ap({
          ref: r2,
          nextImpl: t2
        }), function() {
          if ((ce & 2) !== 0) throw Error(F(440));
          return r2.impl.apply(void 0, arguments);
        };
      }
      function Od(t2, r2) {
        return Di(4, 2, t2, r2);
      }
      function Ru(t2, r2) {
        return Di(4, 4, t2, r2);
      }
      function jp(t2, r2) {
        if (typeof r2 == "function") {
          t2 = t2();
          var a2 = r2(t2);
          return function() {
            typeof a2 == "function" ? a2() : r2(null);
          };
        }
        if (r2 != null) return t2 = t2(), r2.current = t2, function() {
          r2.current = null;
        };
      }
      function Md(t2, r2, a2) {
        a2 = a2 != null ? a2.concat([t2]) : null, Di(4, 4, jp.bind(null, r2, t2), a2);
      }
      function Qd() {
      }
      function Eu(t2, r2) {
        var a2 = He();
        r2 = r2 === void 0 ? null : r2;
        var l2 = a2.memoizedState;
        return r2 !== null && wo(r2, l2[1]) ? l2[0] : (a2.memoizedState = [t2, r2], t2);
      }
      function Kl(t2, r2) {
        var a2 = He();
        r2 = r2 === void 0 ? null : r2;
        var l2 = a2.memoizedState;
        if (r2 !== null && wo(r2, l2[1])) return l2[0];
        if (l2 = t2(), oi) {
          pe(true);
          try {
            t2();
          } finally {
            pe(false);
          }
        }
        return a2.memoizedState = [l2, r2], l2;
      }
      function Iu(t2, r2, a2) {
        return a2 === void 0 || (Wo & 1073741824) !== 0 && (he & 261930) === 0 ? t2.memoizedState = r2 : (t2.memoizedState = a2, t2 = ys(), ne.lanes |= t2, ba |= t2, a2);
      }
      function es(t2, r2, a2, l2) {
        return jn(a2, r2) ? a2 : Kr.current !== null ? (t2 = Iu(t2, a2, l2), jn(t2, r2) || (hn = true), t2) : (Wo & 42) === 0 || (Wo & 1073741824) !== 0 && (he & 261930) === 0 ? (hn = true, t2.memoizedState = a2) : (t2 = ys(), ne.lanes |= t2, ba |= t2, r2);
      }
      function $d(t2, r2, a2, l2, c2) {
        var d = qr();
        yn(d !== 0 && 8 > d ? d : 8);
        var h2 = M2.T, y = {};
        M2.T = y, Wi(t2, false, r2, a2);
        try {
          var R = c2(), L = M2.S;
          if (L !== null && L(y, R), R !== null && typeof R == "object" && typeof R.then == "function") {
            var j2 = ho(R, l2);
            ea(t2, r2, j2, bt(t2));
          } else ea(t2, r2, l2, bt(t2));
        } catch (A) {
          ea(t2, r2, {
            then: function() {
            },
            status: "rejected",
            reason: A
          }, bt());
        } finally {
          yn(d), h2 !== null && y.types !== null && (h2.types = y.types), M2.T = h2;
        }
      }
      function Vd(t2) {
        var r2 = t2.memoizedState;
        if (r2 !== null) return r2;
        r2 = {
          memoizedState: rt,
          baseState: rt,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ar,
            lastRenderedState: rt
          },
          next: null
        };
        var a2 = {};
        return r2.next = {
          memoizedState: a2,
          baseState: a2,
          baseQueue: null,
          queue: {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: Ar,
            lastRenderedState: a2
          },
          next: null
        }, t2.memoizedState = r2, t2 = t2.alternate, t2 !== null && (t2.memoizedState = r2), r2;
      }
      function Lu() {
        return In(da);
      }
      function xo() {
        return He().memoizedState;
      }
      function qd() {
        return He().memoizedState;
      }
      function Dp(t2) {
        for (var r2 = t2.return; r2 !== null; ) {
          switch (r2.tag) {
            case 24:
            case 3:
              var a2 = bt();
              t2 = Et(a2);
              var l2 = Nr(r2, t2, a2);
              l2 !== null && (nt(l2, r2, a2), Ml(l2, r2, a2)), r2 = {
                cache: Fd()
              }, t2.payload = r2;
              return;
          }
          r2 = r2.return;
        }
      }
      function Nn(t2, r2, a2) {
        var l2 = bt();
        a2 = {
          lane: l2,
          revertLane: 0,
          gesture: null,
          action: a2,
          hasEagerState: false,
          eagerState: null,
          next: null
        }, na(t2) ? Gd(r2, a2) : (a2 = yo(t2, r2, a2, l2), a2 !== null && (nt(a2, t2, l2), ns(a2, r2, l2)));
      }
      function Nu(t2, r2, a2) {
        var l2 = bt();
        ea(t2, r2, a2, l2);
      }
      function ea(t2, r2, a2, l2) {
        var c2 = {
          lane: l2,
          revertLane: 0,
          gesture: null,
          action: a2,
          hasEagerState: false,
          eagerState: null,
          next: null
        };
        if (na(t2)) Gd(r2, c2);
        else {
          var d = t2.alternate;
          if (t2.lanes === 0 && (d === null || d.lanes === 0) && (d = r2.lastRenderedReducer, d !== null)) try {
            var h2 = r2.lastRenderedState, y = d(h2, a2);
            if (c2.hasEagerState = true, c2.eagerState = y, jn(y, h2)) return go(t2, r2, c2, 0), Ne === null && Bn(), false;
          } catch {
          } finally {
          }
          if (a2 = yo(t2, r2, c2, l2), a2 !== null) return nt(a2, t2, l2), ns(a2, r2, l2), true;
        }
        return false;
      }
      function Wi(t2, r2, a2, l2) {
        if (l2 = {
          lane: 2,
          revertLane: ku(),
          gesture: null,
          action: l2,
          hasEagerState: false,
          eagerState: null,
          next: null
        }, na(t2)) {
          if (r2) throw Error(F(479));
        } else r2 = yo(t2, a2, l2, 2), r2 !== null && nt(r2, t2, 2);
      }
      function na(t2) {
        var r2 = t2.alternate;
        return t2 === ne || r2 !== null && r2 === ne;
      }
      function Gd(t2, r2) {
        dl = Uc = true;
        var a2 = t2.pending;
        a2 === null ? r2.next = r2 : (r2.next = a2.next, a2.next = r2), t2.pending = r2;
      }
      function ns(t2, r2, a2) {
        if ((a2 & 4194048) !== 0) {
          var l2 = r2.lanes;
          l2 &= t2.pendingLanes, a2 |= l2, r2.lanes = a2, $e(t2, a2);
        }
      }
      function Fu(t2, r2, a2, l2) {
        r2 = t2.memoizedState, a2 = a2(l2, r2), a2 = a2 == null ? r2 : Lt({}, r2, a2), t2.memoizedState = a2, t2.lanes === 0 && (t2.updateQueue.baseState = a2);
      }
      function ts(t2, r2, a2, l2, c2, d, h2) {
        return t2 = t2.stateNode, typeof t2.shouldComponentUpdate == "function" ? t2.shouldComponentUpdate(l2, d, h2) : r2.prototype && r2.prototype.isPureReactComponent ? !Ul(a2, l2) || !Ul(c2, d) : true;
      }
      function Jd(t2, r2, a2, l2) {
        t2 = r2.state, typeof r2.componentWillReceiveProps == "function" && r2.componentWillReceiveProps(a2, l2), typeof r2.UNSAFE_componentWillReceiveProps == "function" && r2.UNSAFE_componentWillReceiveProps(a2, l2), r2.state !== t2 && Oc.enqueueReplaceState(r2, r2.state, null);
      }
      function Wr(t2, r2) {
        var a2 = r2;
        if ("ref" in r2) {
          a2 = {};
          for (var l2 in r2) l2 !== "ref" && (a2[l2] = r2[l2]);
        }
        if (t2 = t2.defaultProps) {
          a2 === r2 && (a2 = Lt({}, a2));
          for (var c2 in t2) a2[c2] === void 0 && (a2[c2] = t2[c2]);
        }
        return a2;
      }
      function rs(t2, r2) {
        try {
          var a2 = t2.onUncaughtError;
          a2(r2.value, {
            componentStack: r2.stack
          });
        } catch (l2) {
          setTimeout(function() {
            throw l2;
          });
        }
      }
      function Zd(t2, r2, a2) {
        try {
          var l2 = t2.onCaughtError;
          l2(a2.value, {
            componentStack: a2.stack,
            errorBoundary: r2.tag === 1 ? r2.stateNode : null
          });
        } catch (c2) {
          setTimeout(function() {
            throw c2;
          });
        }
      }
      function Ui(t2, r2, a2) {
        return a2 = Et(a2), a2.tag = 3, a2.payload = {
          element: null
        }, a2.callback = function() {
          rs(t2, r2);
        }, a2;
      }
      function os(t2) {
        return t2 = Et(t2), t2.tag = 3, t2;
      }
      function Hu(t2, r2, a2, l2) {
        var c2 = a2.type.getDerivedStateFromError;
        if (typeof c2 == "function") {
          var d = l2.value;
          t2.payload = function() {
            return c2(d);
          }, t2.callback = function() {
            Zd(r2, a2, l2);
          };
        }
        var h2 = a2.stateNode;
        h2 !== null && typeof h2.componentDidCatch == "function" && (t2.callback = function() {
          Zd(r2, a2, l2), typeof c2 != "function" && (va === null ? va = /* @__PURE__ */ new Set([this]) : va.add(this));
          var y = l2.stack;
          this.componentDidCatch(l2.value, {
            componentStack: y !== null ? y : ""
          });
        });
      }
      function On(t2, r2, a2, l2, c2) {
        if (a2.flags |= 32768, l2 !== null && typeof l2 == "object" && typeof l2.then == "function") {
          if (r2 = a2.alternate, r2 !== null && po(r2, a2, c2, true), a2 = Ft.current, a2 !== null) {
            switch (a2.tag) {
              case 31:
              case 13:
                return zr === null ? Gi() : a2.alternate === null && Xe === 0 && (Xe = 3), a2.flags &= -257, a2.flags |= 65536, a2.lanes = c2, l2 === Dc ? a2.flags |= 16384 : (r2 = a2.updateQueue, r2 === null ? a2.updateQueue = /* @__PURE__ */ new Set([l2]) : r2.add(l2), lc(t2, l2, c2)), false;
              case 22:
                return a2.flags |= 65536, l2 === Dc ? a2.flags |= 16384 : (r2 = a2.updateQueue, r2 === null ? (r2 = {
                  transitions: null,
                  markerInstances: null,
                  retryQueue: /* @__PURE__ */ new Set([l2])
                }, a2.updateQueue = r2) : (a2 = r2.retryQueue, a2 === null ? r2.retryQueue = /* @__PURE__ */ new Set([l2]) : a2.add(l2)), lc(t2, l2, c2)), false;
            }
            throw Error(F(435, a2.tag));
          }
          return lc(t2, l2, c2), Gi(), false;
        }
        if (ue) return r2 = Ft.current, r2 !== null ? ((r2.flags & 65536) === 0 && (r2.flags |= 256), r2.flags |= 65536, r2.lanes = c2, l2 !== Of && (t2 = Error(F(422), {
          cause: l2
        }), ct(ut(t2, a2)))) : (l2 !== Of && (r2 = Error(F(423), {
          cause: l2
        }), ct(ut(r2, a2))), t2 = t2.current.alternate, t2.flags |= 65536, c2 &= -c2, t2.lanes |= c2, l2 = ut(l2, a2), c2 = Ui(t2.stateNode, l2, c2), jd(t2, c2), Xe !== 4 && (Xe = 2)), false;
        var d = Error(F(520), {
          cause: l2
        });
        if (d = ut(d, a2), $s === null ? $s = [d] : $s.push(d), Xe !== 4 && (Xe = 2), r2 === null) return true;
        l2 = ut(l2, a2), a2 = r2;
        do {
          switch (a2.tag) {
            case 3:
              return a2.flags |= 65536, t2 = c2 & -c2, a2.lanes |= t2, t2 = Ui(a2.stateNode, l2, t2), jd(a2, t2), false;
            case 1:
              if (r2 = a2.type, d = a2.stateNode, (a2.flags & 128) === 0 && (typeof r2.getDerivedStateFromError == "function" || d !== null && typeof d.componentDidCatch == "function" && (va === null || !va.has(d)))) return a2.flags |= 65536, c2 &= -c2, a2.lanes |= c2, c2 = os(c2), Hu(c2, t2, a2, l2), jd(a2, c2), false;
          }
          a2 = a2.return;
        } while (a2 !== null);
        return false;
      }
      function wn(t2, r2, a2, l2) {
        r2.child = t2 === null ? Oh(r2, null, a2, l2) : ri(r2, t2.child, a2, l2);
      }
      function as(t2, r2, a2, l2, c2) {
        a2 = a2.render;
        var d = r2.ref;
        if ("ref" in l2) {
          var h2 = {};
          for (var y in l2) y !== "ref" && (h2[y] = l2[y]);
        } else h2 = l2;
        return Un(r2), l2 = $l(t2, r2, a2, h2, d, c2), y = Hr(), t2 !== null && !hn ? (lr(t2, r2, c2), gt(t2, r2, c2)) : (ue && y && Id(r2), r2.flags |= 1, wn(t2, r2, l2, c2), r2.child);
      }
      function Au(t2, r2, a2, l2, c2) {
        if (t2 === null) {
          var d = a2.type;
          return typeof d == "function" && !ks(d) && d.defaultProps === void 0 && a2.compare === null ? (r2.tag = 15, r2.type = d, ju(t2, r2, d, l2, c2)) : (t2 = ws(a2.type, null, l2, r2, r2.mode, c2), t2.ref = r2.ref, t2.return = r2, r2.child = t2);
        }
        if (d = t2.child, !Mi(t2, c2)) {
          var h2 = d.memoizedProps;
          if (a2 = a2.compare, a2 = a2 !== null ? a2 : Ul, a2(h2, l2) && t2.ref === r2.ref) return gt(t2, r2, c2);
        }
        return r2.flags |= 1, t2 = Qr(d, l2), t2.ref = r2.ref, t2.return = r2, r2.child = t2;
      }
      function ju(t2, r2, a2, l2, c2) {
        if (t2 !== null) {
          var d = t2.memoizedProps;
          if (Ul(d, l2) && t2.ref === r2.ref) if (hn = false, r2.pendingProps = l2 = d, Mi(t2, c2)) (t2.flags & 131072) !== 0 && (hn = true);
          else return r2.lanes = t2.lanes, gt(t2, r2, c2);
        }
        return Yd(t2, r2, a2, l2, c2);
      }
      function zo(t2, r2, a2, l2) {
        var c2 = l2.children, d = t2 !== null ? t2.memoizedState : null;
        if (t2 === null && r2.stateNode === null && (r2.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), l2.mode === "hidden") {
          if ((r2.flags & 128) !== 0) {
            if (d = d !== null ? d.baseLanes | a2 : a2, t2 !== null) {
              for (l2 = r2.child = t2.child, c2 = 0; l2 !== null; ) c2 = c2 | l2.lanes | l2.childLanes, l2 = l2.sibling;
              l2 = c2 & ~d;
            } else l2 = 0, r2.child = null;
            return Bi(t2, r2, d, a2, l2);
          }
          if ((a2 & 536870912) !== 0) r2.memoizedState = {
            baseLanes: 0,
            cachePool: null
          }, t2 !== null && Ei(r2, d !== null ? d.cachePool : null), d !== null ? B(r2, d) : Ql(), Fr(r2);
          else return l2 = r2.lanes = 536870912, Bi(t2, r2, d !== null ? d.baseLanes | a2 : a2, a2, l2);
        } else d !== null ? (Ei(r2, d.cachePool), B(r2, d), So(), r2.memoizedState = null) : (t2 !== null && Ei(r2, null), Ql(), So());
        return wn(t2, r2, c2, a2), r2.child;
      }
      function Mt(t2, r2) {
        return t2 !== null && t2.tag === 22 || r2.stateNode !== null || (r2.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null
        }), r2.sibling;
      }
      function Bi(t2, r2, a2, l2, c2) {
        var d = wu();
        return d = d === null ? null : {
          parent: qt ? qe._currentValue : qe._currentValue2,
          pool: d
        }, r2.memoizedState = {
          baseLanes: a2,
          cachePool: d
        }, t2 !== null && Ei(r2, null), Ql(), Fr(r2), t2 !== null && po(t2, r2, l2, true), r2.childLanes = c2, null;
      }
      function Ua(t2, r2) {
        return r2 = mr({
          mode: r2.mode,
          children: r2.children
        }, t2.mode), r2.ref = t2.ref, t2.child = r2, r2.return = t2, r2;
      }
      function Oi(t2, r2, a2) {
        return ri(r2, t2.child, null, a2), t2 = Ua(r2, r2.pendingProps), t2.flags |= 2, ht(r2), r2.memoizedState = null, t2;
      }
      function is2(t2, r2, a2) {
        var l2 = r2.pendingProps, c2 = (r2.flags & 128) !== 0;
        if (r2.flags &= -129, t2 === null) {
          if (ue) {
            if (l2.mode === "hidden") return t2 = Ua(r2, l2), r2.lanes = 536870912, Mt(null, t2);
            if (Ni(r2), (t2 = Ue) ? (t2 = xh(t2, Yt), t2 !== null && (r2.memoizedState = {
              dehydrated: t2,
              treeContext: jo !== null ? {
                id: ot,
                overflow: Zr
              } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a2 = cc(t2), a2.return = r2, r2.child = a2, bn = r2, Ue = null)) : t2 = null, t2 === null) throw ar(r2);
            return r2.lanes = 536870912, null;
          }
          return Ua(r2, l2);
        }
        var d = t2.memoizedState;
        if (d !== null) {
          var h2 = d.dehydrated;
          if (Ni(r2), c2) {
            if (r2.flags & 256) r2.flags &= -257, r2 = Oi(t2, r2, a2);
            else if (r2.memoizedState !== null) r2.child = t2.child, r2.flags |= 128, r2 = null;
            else throw Error(F(558));
          } else if (hn || po(t2, r2, a2, false), c2 = (a2 & t2.childLanes) !== 0, hn || c2) {
            if (l2 = Ne, l2 !== null && (h2 = G(l2, a2), h2 !== 0 && h2 !== d.retryLane)) throw d.retryLane = h2, Ko(t2, h2), nt(l2, t2, h2), Mc;
            Gi(), r2 = Oi(t2, r2, a2);
          } else t2 = d.treeContext, Hn && (Ue = Ff(h2), bn = r2, ue = true, Do = null, Yt = false, t2 !== null && Ld(r2, t2)), r2 = Ua(r2, l2), r2.flags |= 4096;
          return r2;
        }
        return t2 = Qr(t2.child, {
          mode: l2.mode,
          children: l2.children
        }), t2.ref = r2.ref, r2.child = t2, t2.return = r2, t2;
      }
      function ls(t2, r2) {
        var a2 = r2.ref;
        if (a2 === null) t2 !== null && t2.ref !== null && (r2.flags |= 4194816);
        else {
          if (typeof a2 != "function" && typeof a2 != "object") throw Error(F(284));
          (t2 === null || t2.ref !== a2) && (r2.flags |= 4194816);
        }
      }
      function Yd(t2, r2, a2, l2, c2) {
        return Un(r2), a2 = $l(t2, r2, a2, l2, void 0, c2), l2 = Hr(), t2 !== null && !hn ? (lr(t2, r2, c2), gt(t2, r2, c2)) : (ue && l2 && Id(r2), r2.flags |= 1, wn(t2, r2, a2, c2), r2.child);
      }
      function Xd(t2, r2, a2, l2, c2, d) {
        return Un(r2), r2.updateQueue = null, a2 = xu(r2, l2, a2, c2), Fi(t2), l2 = Hr(), t2 !== null && !hn ? (lr(t2, r2, d), gt(t2, r2, d)) : (ue && l2 && Id(r2), r2.flags |= 1, wn(t2, r2, a2, d), r2.child);
      }
      function Kd(t2, r2, a2, l2, c2) {
        if (Un(r2), r2.stateNode === null) {
          var d = Ka, h2 = a2.contextType;
          typeof h2 == "object" && h2 !== null && (d = In(h2)), d = new a2(l2, d), r2.memoizedState = d.state !== null && d.state !== void 0 ? d.state : null, d.updater = Oc, r2.stateNode = d, d._reactInternals = r2, d = r2.stateNode, d.props = l2, d.state = r2.memoizedState, d.refs = {}, Ol(r2), h2 = a2.contextType, d.context = typeof h2 == "object" && h2 !== null ? In(h2) : Ka, d.state = r2.memoizedState, h2 = a2.getDerivedStateFromProps, typeof h2 == "function" && (Fu(r2, a2, h2, l2), d.state = r2.memoizedState), typeof a2.getDerivedStateFromProps == "function" || typeof d.getSnapshotBeforeUpdate == "function" || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (h2 = d.state, typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount(), h2 !== d.state && Oc.enqueueReplaceState(d, d.state, null), Aa(r2, l2, d, c2), Li(), d.state = r2.memoizedState), typeof d.componentDidMount == "function" && (r2.flags |= 4194308), l2 = true;
        } else if (t2 === null) {
          d = r2.stateNode;
          var y = r2.memoizedProps, R = Wr(a2, y);
          d.props = R;
          var L = d.context, j2 = a2.contextType;
          h2 = Ka, typeof j2 == "object" && j2 !== null && (h2 = In(j2));
          var A = a2.getDerivedStateFromProps;
          j2 = typeof A == "function" || typeof d.getSnapshotBeforeUpdate == "function", y = r2.pendingProps !== y, j2 || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (y || L !== h2) && Jd(r2, d, l2, h2), ma = false;
          var W2 = r2.memoizedState;
          d.state = W2, Aa(r2, l2, d, c2), Li(), L = r2.memoizedState, y || W2 !== L || ma ? (typeof A == "function" && (Fu(r2, a2, A, l2), L = r2.memoizedState), (R = ma || ts(r2, a2, R, l2, W2, L, h2)) ? (j2 || typeof d.UNSAFE_componentWillMount != "function" && typeof d.componentWillMount != "function" || (typeof d.componentWillMount == "function" && d.componentWillMount(), typeof d.UNSAFE_componentWillMount == "function" && d.UNSAFE_componentWillMount()), typeof d.componentDidMount == "function" && (r2.flags |= 4194308)) : (typeof d.componentDidMount == "function" && (r2.flags |= 4194308), r2.memoizedProps = l2, r2.memoizedState = L), d.props = l2, d.state = L, d.context = h2, l2 = R) : (typeof d.componentDidMount == "function" && (r2.flags |= 4194308), l2 = false);
        } else {
          d = r2.stateNode, Ha(t2, r2), h2 = r2.memoizedProps, j2 = Wr(a2, h2), d.props = j2, A = r2.pendingProps, W2 = d.context, L = a2.contextType, R = Ka, typeof L == "object" && L !== null && (R = In(L)), y = a2.getDerivedStateFromProps, (L = typeof y == "function" || typeof d.getSnapshotBeforeUpdate == "function") || typeof d.UNSAFE_componentWillReceiveProps != "function" && typeof d.componentWillReceiveProps != "function" || (h2 !== A || W2 !== R) && Jd(r2, d, l2, R), ma = false, W2 = r2.memoizedState, d.state = W2, Aa(r2, l2, d, c2), Li();
          var V = r2.memoizedState;
          h2 !== A || W2 !== V || ma || t2 !== null && t2.dependencies !== null && Ri(t2.dependencies) ? (typeof y == "function" && (Fu(r2, a2, y, l2), V = r2.memoizedState), (j2 = ma || ts(r2, a2, j2, l2, W2, V, R) || t2 !== null && t2.dependencies !== null && Ri(t2.dependencies)) ? (L || typeof d.UNSAFE_componentWillUpdate != "function" && typeof d.componentWillUpdate != "function" || (typeof d.componentWillUpdate == "function" && d.componentWillUpdate(l2, V, R), typeof d.UNSAFE_componentWillUpdate == "function" && d.UNSAFE_componentWillUpdate(l2, V, R)), typeof d.componentDidUpdate == "function" && (r2.flags |= 4), typeof d.getSnapshotBeforeUpdate == "function" && (r2.flags |= 1024)) : (typeof d.componentDidUpdate != "function" || h2 === t2.memoizedProps && W2 === t2.memoizedState || (r2.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || h2 === t2.memoizedProps && W2 === t2.memoizedState || (r2.flags |= 1024), r2.memoizedProps = l2, r2.memoizedState = V), d.props = l2, d.state = V, d.context = R, l2 = j2) : (typeof d.componentDidUpdate != "function" || h2 === t2.memoizedProps && W2 === t2.memoizedState || (r2.flags |= 4), typeof d.getSnapshotBeforeUpdate != "function" || h2 === t2.memoizedProps && W2 === t2.memoizedState || (r2.flags |= 1024), l2 = false);
        }
        return d = l2, ls(t2, r2), l2 = (r2.flags & 128) !== 0, d || l2 ? (d = r2.stateNode, a2 = l2 && typeof a2.getDerivedStateFromError != "function" ? null : d.render(), r2.flags |= 1, t2 !== null && l2 ? (r2.child = ri(r2, t2.child, null, c2), r2.child = ri(r2, null, a2, c2)) : wn(t2, r2, a2, c2), r2.memoizedState = d.state, t2 = r2.child) : t2 = gt(t2, r2, c2), t2;
      }
      function Du(t2, r2, a2, l2) {
        return _a(), r2.flags |= 256, wn(t2, r2, a2, l2), r2.child;
      }
      function ss(t2) {
        return {
          baseLanes: t2,
          cachePool: Pu()
        };
      }
      function Ur(t2, r2, a2) {
        return t2 = t2 !== null ? t2.childLanes & ~a2 : 0, r2 && (t2 |= At), t2;
      }
      function Wu(t2, r2, a2) {
        var l2 = r2.pendingProps, c2 = false, d = (r2.flags & 128) !== 0, h2;
        if ((h2 = d) || (h2 = t2 !== null && t2.memoizedState === null ? false : (ln.current & 2) !== 0), h2 && (c2 = true, r2.flags &= -129), h2 = (r2.flags & 32) !== 0, r2.flags &= -33, t2 === null) {
          if (ue) {
            if (c2 ? vo(r2) : So(), (t2 = Ue) ? (t2 = Om(t2, Yt), t2 !== null && (r2.memoizedState = {
              dehydrated: t2,
              treeContext: jo !== null ? {
                id: ot,
                overflow: Zr
              } : null,
              retryLane: 536870912,
              hydrationErrors: null
            }, a2 = cc(t2), a2.return = r2, r2.child = a2, bn = r2, Ue = null)) : t2 = null, t2 === null) throw ar(r2);
            return Fs(t2) ? r2.lanes = 32 : r2.lanes = 536870912, null;
          }
          var y = l2.children;
          return l2 = l2.fallback, c2 ? (So(), c2 = r2.mode, y = mr({
            mode: "hidden",
            children: y
          }, c2), l2 = Eo(l2, c2, a2, null), y.return = r2, l2.return = r2, y.sibling = l2, r2.child = y, l2 = r2.child, l2.memoizedState = ss(a2), l2.childLanes = Ur(t2, h2, a2), r2.memoizedState = Qc, Mt(null, l2)) : (vo(r2), Uu(r2, y));
        }
        var R = t2.memoizedState;
        if (R !== null && (y = R.dehydrated, y !== null)) {
          if (d) r2.flags & 256 ? (vo(r2), r2.flags &= -257, r2 = et(t2, r2, a2)) : r2.memoizedState !== null ? (So(), r2.child = t2.child, r2.flags |= 128, r2 = null) : (So(), y = l2.fallback, c2 = r2.mode, l2 = mr({
            mode: "visible",
            children: l2.children
          }, c2), y = Eo(y, c2, a2, null), y.flags |= 2, l2.return = r2, y.return = r2, l2.sibling = y, r2.child = l2, ri(r2, t2.child, null, a2), l2 = r2.child, l2.memoizedState = ss(a2), l2.childLanes = Ur(t2, h2, a2), r2.memoizedState = Qc, r2 = Mt(null, l2));
          else if (vo(r2), Fs(y)) h2 = Za(y).digest, l2 = Error(F(419)), l2.stack = "", l2.digest = h2, ct({
            value: l2,
            source: null,
            stack: null
          }), r2 = et(t2, r2, a2);
          else if (hn || po(t2, r2, a2, false), h2 = (a2 & t2.childLanes) !== 0, hn || h2) {
            if (h2 = Ne, h2 !== null && (l2 = G(h2, a2), l2 !== 0 && l2 !== R.retryLane)) throw R.retryLane = l2, Ko(t2, l2), nt(h2, t2, l2), Mc;
            Ns(y) || Gi(), r2 = et(t2, r2, a2);
          } else Ns(y) ? (r2.flags |= 192, r2.child = t2.child, r2 = null) : (t2 = R.treeContext, Hn && (Ue = wh(y), bn = r2, ue = true, Do = null, Yt = false, t2 !== null && Ld(r2, t2)), r2 = Uu(r2, l2.children), r2.flags |= 4096);
          return r2;
        }
        return c2 ? (So(), y = l2.fallback, c2 = r2.mode, R = t2.child, d = R.sibling, l2 = Qr(R, {
          mode: "hidden",
          children: l2.children
        }), l2.subtreeFlags = R.subtreeFlags & 65011712, d !== null ? y = Qr(d, y) : (y = Eo(y, c2, a2, null), y.flags |= 2), y.return = r2, l2.return = r2, l2.sibling = y, r2.child = l2, Mt(null, l2), l2 = r2.child, y = t2.child.memoizedState, y === null ? y = ss(a2) : (c2 = y.cachePool, c2 !== null ? (R = qt ? qe._currentValue : qe._currentValue2, c2 = c2.parent !== R ? {
          parent: R,
          pool: R
        } : c2) : c2 = Pu(), y = {
          baseLanes: y.baseLanes | a2,
          cachePool: c2
        }), l2.memoizedState = y, l2.childLanes = Ur(t2, h2, a2), r2.memoizedState = Qc, Mt(t2.child, l2)) : (vo(r2), a2 = t2.child, t2 = a2.sibling, a2 = Qr(a2, {
          mode: "visible",
          children: l2.children
        }), a2.return = r2, a2.sibling = null, t2 !== null && (h2 = r2.deletions, h2 === null ? (r2.deletions = [t2], r2.flags |= 16) : h2.push(t2)), r2.child = a2, r2.memoizedState = null, a2);
      }
      function Uu(t2, r2) {
        return r2 = mr({
          mode: "visible",
          children: r2
        }, t2.mode), r2.return = t2, t2.child = r2;
      }
      function mr(t2, r2) {
        return t2 = Yn(22, t2, null, r2), t2.lanes = 0, t2;
      }
      function et(t2, r2, a2) {
        return ri(r2, t2.child, null, a2), t2 = Uu(r2, r2.pendingProps.children), t2.flags |= 2, r2.memoizedState = null, t2;
      }
      function us(t2, r2, a2) {
        t2.lanes |= r2;
        var l2 = t2.alternate;
        l2 !== null && (l2.lanes |= r2), Ot(t2.return, r2, a2);
      }
      function ee(t2, r2, a2, l2, c2, d) {
        var h2 = t2.memoizedState;
        h2 === null ? t2.memoizedState = {
          isBackwards: r2,
          rendering: null,
          renderingStartTime: 0,
          last: l2,
          tail: a2,
          tailMode: c2,
          treeForkCount: d
        } : (h2.isBackwards = r2, h2.rendering = null, h2.renderingStartTime = 0, h2.last = l2, h2.tail = a2, h2.tailMode = c2, h2.treeForkCount = d);
      }
      function N(t2, r2, a2) {
        var l2 = r2.pendingProps, c2 = l2.revealOrder, d = l2.tail;
        l2 = l2.children;
        var h2 = ln.current, y = (h2 & 2) !== 0;
        if (y ? (h2 = h2 & 1 | 2, r2.flags |= 128) : h2 &= 1, Ce(ln, h2), wn(t2, r2, l2, a2), l2 = ue ? x2 : 0, !y && t2 !== null && (t2.flags & 128) !== 0) e: for (t2 = r2.child; t2 !== null; ) {
          if (t2.tag === 13) t2.memoizedState !== null && us(t2, a2, r2);
          else if (t2.tag === 19) us(t2, a2, r2);
          else if (t2.child !== null) {
            t2.child.return = t2, t2 = t2.child;
            continue;
          }
          if (t2 === r2) break e;
          for (; t2.sibling === null; ) {
            if (t2.return === null || t2.return === r2) break e;
            t2 = t2.return;
          }
          t2.sibling.return = t2.return, t2 = t2.sibling;
        }
        switch (c2) {
          case "forwards":
            for (a2 = r2.child, c2 = null; a2 !== null; ) t2 = a2.alternate, t2 !== null && ko(t2) === null && (c2 = a2), a2 = a2.sibling;
            a2 = c2, a2 === null ? (c2 = r2.child, r2.child = null) : (c2 = a2.sibling, a2.sibling = null), ee(r2, false, c2, a2, d, l2);
            break;
          case "backwards":
          case "unstable_legacy-backwards":
            for (a2 = null, c2 = r2.child, r2.child = null; c2 !== null; ) {
              if (t2 = c2.alternate, t2 !== null && ko(t2) === null) {
                r2.child = c2;
                break;
              }
              t2 = c2.sibling, c2.sibling = a2, a2 = c2, c2 = t2;
            }
            ee(r2, true, a2, null, d, l2);
            break;
          case "together":
            ee(r2, false, null, null, void 0, l2);
            break;
          default:
            r2.memoizedState = null;
        }
        return r2.child;
      }
      function gt(t2, r2, a2) {
        if (t2 !== null && (r2.dependencies = t2.dependencies), ba |= r2.lanes, (a2 & r2.childLanes) === 0) if (t2 !== null) {
          if (po(t2, r2, a2, false), (a2 & r2.childLanes) === 0) return null;
        } else return null;
        if (t2 !== null && r2.child !== t2.child) throw Error(F(153));
        if (r2.child !== null) {
          for (t2 = r2.child, a2 = Qr(t2, t2.pendingProps), r2.child = a2, a2.return = r2; t2.sibling !== null; ) t2 = t2.sibling, a2 = a2.sibling = Qr(t2, t2.pendingProps), a2.return = r2;
          a2.sibling = null;
        }
        return r2.child;
      }
      function Mi(t2, r2) {
        return (t2.lanes & r2) !== 0 ? true : (t2 = t2.dependencies, !!(t2 !== null && Ri(t2)));
      }
      function Ye(t2, r2, a2) {
        switch (r2.tag) {
          case 3:
            Al(r2, r2.stateNode.containerInfo), fo(r2, qe, t2.memoizedState.cache), _a();
            break;
          case 27:
          case 5:
            yu(r2);
            break;
          case 4:
            Al(r2, r2.stateNode.containerInfo);
            break;
          case 10:
            fo(r2, r2.type, r2.memoizedProps.value);
            break;
          case 31:
            if (r2.memoizedState !== null) return r2.flags |= 128, Ni(r2), null;
            break;
          case 13:
            var l2 = r2.memoizedState;
            if (l2 !== null) return l2.dehydrated !== null ? (vo(r2), r2.flags |= 128, null) : (a2 & r2.child.childLanes) !== 0 ? Wu(t2, r2, a2) : (vo(r2), t2 = gt(t2, r2, a2), t2 !== null ? t2.sibling : null);
            vo(r2);
            break;
          case 19:
            var c2 = (t2.flags & 128) !== 0;
            if (l2 = (a2 & r2.childLanes) !== 0, l2 || (po(t2, r2, a2, false), l2 = (a2 & r2.childLanes) !== 0), c2) {
              if (l2) return N(t2, r2, a2);
              r2.flags |= 128;
            }
            if (c2 = r2.memoizedState, c2 !== null && (c2.rendering = null, c2.tail = null, c2.lastEffect = null), Ce(ln, ln.current), l2) break;
            return null;
          case 22:
            return r2.lanes = 0, zo(t2, r2, a2, r2.pendingProps);
          case 24:
            fo(r2, qe, t2.memoizedState.cache);
        }
        return gt(t2, r2, a2);
      }
      function Bu(t2, r2, a2) {
        if (t2 !== null) {
          if (t2.memoizedProps !== r2.pendingProps) hn = true;
          else {
            if (!Mi(t2, a2) && (r2.flags & 128) === 0) return hn = false, Ye(t2, r2, a2);
            hn = (t2.flags & 131072) !== 0;
          }
        } else hn = false, ue && (r2.flags & 1048576) !== 0 && Ci(r2, x2, r2.index);
        switch (r2.lanes = 0, r2.tag) {
          case 16:
            e: {
              var l2 = r2.pendingProps;
              if (t2 = pt(r2.elementType), r2.type = t2, typeof t2 == "function") ks(t2) ? (l2 = Wr(t2, l2), r2.tag = 1, r2 = Kd(null, r2, t2, l2, a2)) : (r2.tag = 0, r2 = Yd(null, r2, t2, l2, a2));
              else {
                if (t2 != null) {
                  var c2 = t2.$$typeof;
                  if (c2 === Zi) {
                    r2.tag = 11, r2 = as(null, r2, t2, l2, a2);
                    break e;
                  } else if (c2 === wf) {
                    r2.tag = 14, r2 = Au(null, r2, t2, l2, a2);
                    break e;
                  }
                }
                throw r2 = hu(t2) || t2, Error(F(306, r2, ""));
              }
            }
            return r2;
          case 0:
            return Yd(t2, r2, r2.type, r2.pendingProps, a2);
          case 1:
            return l2 = r2.type, c2 = Wr(l2, r2.pendingProps), Kd(t2, r2, l2, c2, a2);
          case 3:
            e: {
              if (Al(r2, r2.stateNode.containerInfo), t2 === null) throw Error(F(387));
              var d = r2.pendingProps;
              c2 = r2.memoizedState, l2 = c2.element, Ha(t2, r2), Aa(r2, d, null, a2);
              var h2 = r2.memoizedState;
              if (d = h2.cache, fo(r2, qe, d), d !== c2.cache && _i(r2, [qe], a2, true), Li(), d = h2.element, Hn && c2.isDehydrated) {
                if (c2 = {
                  element: d,
                  isDehydrated: false,
                  cache: h2.cache
                }, r2.updateQueue.baseState = c2, r2.memoizedState = c2, r2.flags & 256) {
                  r2 = Du(t2, r2, d, a2);
                  break e;
                } else if (d !== l2) {
                  l2 = ut(Error(F(424)), r2), ct(l2), r2 = Du(t2, r2, d, a2);
                  break e;
                } else for (Hn && (Ue = Pc(r2.stateNode.containerInfo), bn = r2, ue = true, Do = null, Yt = true), a2 = Oh(r2, null, d, a2), r2.child = a2; a2; ) a2.flags = a2.flags & -3 | 4096, a2 = a2.sibling;
              } else {
                if (_a(), d === l2) {
                  r2 = gt(t2, r2, a2);
                  break e;
                }
                wn(t2, r2, d, a2);
              }
              r2 = r2.child;
            }
            return r2;
          case 26:
            if (Gt) return ls(t2, r2), t2 === null ? (a2 = nl(r2.type, null, r2.pendingProps, null)) ? r2.memoizedState = a2 : ue || (r2.stateNode = Ah(r2.type, r2.pendingProps, pa.current, r2)) : r2.memoizedState = nl(r2.type, t2.memoizedProps, r2.pendingProps, t2.memoizedState), null;
          case 27:
            if (dn) return yu(r2), t2 === null && dn && ue && (l2 = r2.stateNode = _c(r2.type, r2.pendingProps, pa.current, Dn.current, false), bn = r2, Yt = true, Ue = Um(r2.type, l2, Ue)), wn(t2, r2, r2.pendingProps.children, a2), ls(t2, r2), t2 === null && (r2.flags |= 4194304), r2.child;
          case 5:
            return t2 === null && ue && ($m(r2.type, r2.pendingProps, Dn.current), (c2 = l2 = Ue) && (l2 = Bm(l2, r2.type, r2.pendingProps, Yt), l2 !== null ? (r2.stateNode = l2, bn = r2, Ue = wc(l2), Yt = false, c2 = true) : c2 = false), c2 || ar(r2)), yu(r2), c2 = r2.type, d = r2.pendingProps, h2 = t2 !== null ? t2.memoizedProps : null, l2 = d.children, Rs(c2, d) ? l2 = null : h2 !== null && Rs(c2, h2) && (r2.flags |= 32), r2.memoizedState !== null && (c2 = $l(t2, r2, zu, null, null, a2), qt ? da._currentValue = c2 : da._currentValue2 = c2), ls(t2, r2), wn(t2, r2, l2, a2), r2.child;
          case 6:
            return t2 === null && ue && (jf(r2.pendingProps, Dn.current), (t2 = a2 = Ue) && (a2 = Ph(a2, r2.pendingProps, Yt), a2 !== null ? (r2.stateNode = a2, bn = r2, Ue = null, t2 = true) : t2 = false), t2 || ar(r2)), null;
          case 13:
            return Wu(t2, r2, a2);
          case 4:
            return Al(r2, r2.stateNode.containerInfo), l2 = r2.pendingProps, t2 === null ? r2.child = ri(r2, null, l2, a2) : wn(t2, r2, l2, a2), r2.child;
          case 11:
            return as(t2, r2, r2.type, r2.pendingProps, a2);
          case 7:
            return wn(t2, r2, r2.pendingProps, a2), r2.child;
          case 8:
            return wn(t2, r2, r2.pendingProps.children, a2), r2.child;
          case 12:
            return wn(t2, r2, r2.pendingProps.children, a2), r2.child;
          case 10:
            return l2 = r2.pendingProps, fo(r2, r2.type, l2.value), wn(t2, r2, l2.children, a2), r2.child;
          case 9:
            return c2 = r2.type._context, l2 = r2.pendingProps.children, Un(r2), c2 = In(c2), l2 = l2(c2), r2.flags |= 1, wn(t2, r2, l2, a2), r2.child;
          case 14:
            return Au(t2, r2, r2.type, r2.pendingProps, a2);
          case 15:
            return ju(t2, r2, r2.type, r2.pendingProps, a2);
          case 19:
            return N(t2, r2, a2);
          case 31:
            return is2(t2, r2, a2);
          case 22:
            return zo(t2, r2, a2, r2.pendingProps);
          case 24:
            return Un(r2), l2 = In(qe), t2 === null ? (c2 = wu(), c2 === null && (c2 = Ne, d = Fd(), c2.pooledCache = d, d.refCount++, d !== null && (c2.pooledCacheLanes |= a2), c2 = d), r2.memoizedState = {
              parent: l2,
              cache: c2
            }, Ol(r2), fo(r2, qe, c2)) : ((t2.lanes & a2) !== 0 && (Ha(t2, r2), Aa(r2, null, null, a2), Li()), c2 = t2.memoizedState, d = r2.memoizedState, c2.parent !== l2 ? (c2 = {
              parent: l2,
              cache: l2
            }, r2.memoizedState = c2, r2.lanes === 0 && (r2.memoizedState = r2.updateQueue.baseState = c2), fo(r2, qe, l2)) : (l2 = d.cache, fo(r2, qe, l2), l2 !== c2.cache && _i(r2, [qe], a2, true))), wn(t2, r2, r2.pendingProps.children, a2), r2.child;
          case 29:
            throw r2.pendingProps;
        }
        throw Error(F(156, r2.tag));
      }
      function It(t2) {
        t2.flags |= 4;
      }
      function cs(t2) {
        Sr && (t2.flags |= 8);
      }
      function Ou(t2, r2) {
        if (t2 !== null && t2.child === r2.child) return false;
        if ((r2.flags & 16) !== 0) return true;
        for (t2 = r2.child; t2 !== null; ) {
          if ((t2.flags & 8218) !== 0 || (t2.subtreeFlags & 8218) !== 0) return true;
          t2 = t2.sibling;
        }
        return false;
      }
      function ef(t2, r2, a2, l2) {
        if ($n) for (a2 = r2.child; a2 !== null; ) {
          if (a2.tag === 5 || a2.tag === 6) yc(t2, a2.stateNode);
          else if (!(a2.tag === 4 || dn && a2.tag === 27) && a2.child !== null) {
            a2.child.return = a2, a2 = a2.child;
            continue;
          }
          if (a2 === r2) break;
          for (; a2.sibling === null; ) {
            if (a2.return === null || a2.return === r2) return;
            a2 = a2.return;
          }
          a2.sibling.return = a2.return, a2 = a2.sibling;
        }
        else if (Sr) for (var c2 = r2.child; c2 !== null; ) {
          if (c2.tag === 5) {
            var d = c2.stateNode;
            a2 && l2 && (d = No(d, c2.type, c2.memoizedProps)), yc(t2, d);
          } else if (c2.tag === 6) d = c2.stateNode, a2 && l2 && (d = Ls(d, c2.memoizedProps)), yc(t2, d);
          else if (c2.tag !== 4) {
            if (c2.tag === 22 && c2.memoizedState !== null) d = c2.child, d !== null && (d.return = c2), ef(t2, c2, true, true);
            else if (c2.child !== null) {
              c2.child.return = c2, c2 = c2.child;
              continue;
            }
          }
          if (c2 === r2) break;
          for (; c2.sibling === null; ) {
            if (c2.return === null || c2.return === r2) return;
            c2 = c2.return;
          }
          c2.sibling.return = c2.return, c2 = c2.sibling;
        }
      }
      function Mu(t2, r2, a2, l2) {
        var c2 = false;
        if (Sr) for (var d = r2.child; d !== null; ) {
          if (d.tag === 5) {
            var h2 = d.stateNode;
            a2 && l2 && (h2 = No(h2, d.type, d.memoizedProps)), Lf(t2, h2);
          } else if (d.tag === 6) h2 = d.stateNode, a2 && l2 && (h2 = Ls(h2, d.memoizedProps)), Lf(t2, h2);
          else if (d.tag !== 4) {
            if (d.tag === 22 && d.memoizedState !== null) c2 = d.child, c2 !== null && (c2.return = d), Mu(t2, d, true, true), c2 = true;
            else if (d.child !== null) {
              d.child.return = d, d = d.child;
              continue;
            }
          }
          if (d === r2) break;
          for (; d.sibling === null; ) {
            if (d.return === null || d.return === r2) return c2;
            d = d.return;
          }
          d.sibling.return = d.return, d = d.sibling;
        }
        return c2;
      }
      function Qu(t2, r2) {
        if (Sr && Ou(t2, r2)) {
          t2 = r2.stateNode;
          var a2 = t2.containerInfo, l2 = We();
          Mu(l2, r2, false, false), t2.pendingChildren = l2, It(r2), yh(a2, l2);
        }
      }
      function ds(t2, r2, a2, l2) {
        if ($n) t2.memoizedProps !== l2 && It(r2);
        else if (Sr) {
          var c2 = t2.stateNode, d = t2.memoizedProps;
          if ((t2 = Ou(t2, r2)) || d !== l2) {
            var h2 = Dn.current;
            d = gh(c2, a2, d, l2, !t2, null), d === c2 ? r2.stateNode = c2 : (cs(r2), Kp(d, a2, l2, h2) && It(r2), r2.stateNode = d, t2 && ef(d, r2, false, false));
          } else r2.stateNode = c2;
        }
      }
      function Fn(t2, r2, a2, l2, c2) {
        if ((t2.mode & 32) !== 0 && (a2 === null ? rh(r2, l2) : Dm(r2, a2, l2))) {
          if (t2.flags |= 16777216, (c2 & 335544128) === c2 || Yi(r2, l2)) if (An(t2.stateNode, r2, l2)) t2.flags |= 8192;
          else if (Vp()) t2.flags |= 8192;
          else throw Xt = Dc, Ac;
        } else t2.flags &= -16777217;
      }
      function xe(t2, r2) {
        if (Vm(r2)) {
          if (t2.flags |= 16777216, !Tc(r2)) if (Vp()) t2.flags |= 8192;
          else throw Xt = Dc, Ac;
        } else t2.flags &= -16777217;
      }
      function Ba(t2, r2) {
        r2 !== null && (t2.flags |= 4), t2.flags & 16384 && (r2 = t2.tag !== 22 ? Ed() : 536870912, t2.lanes |= r2, hl |= r2);
      }
      function Co(t2, r2) {
        if (!ue) switch (t2.tailMode) {
          case "hidden":
            r2 = t2.tail;
            for (var a2 = null; r2 !== null; ) r2.alternate !== null && (a2 = r2), r2 = r2.sibling;
            a2 === null ? t2.tail = null : a2.sibling = null;
            break;
          case "collapsed":
            a2 = t2.tail;
            for (var l2 = null; a2 !== null; ) a2.alternate !== null && (l2 = a2), a2 = a2.sibling;
            l2 === null ? r2 || t2.tail === null ? t2.tail = null : t2.tail.sibling = null : l2.sibling = null;
        }
      }
      function we(t2) {
        var r2 = t2.alternate !== null && t2.alternate.child === t2.child, a2 = 0, l2 = 0;
        if (r2) for (var c2 = t2.child; c2 !== null; ) a2 |= c2.lanes | c2.childLanes, l2 |= c2.subtreeFlags & 65011712, l2 |= c2.flags & 65011712, c2.return = t2, c2 = c2.sibling;
        else for (c2 = t2.child; c2 !== null; ) a2 |= c2.lanes | c2.childLanes, l2 |= c2.subtreeFlags, l2 |= c2.flags, c2.return = t2, c2 = c2.sibling;
        return t2.subtreeFlags |= l2, t2.childLanes = a2, r2;
      }
      function Oa(t2, r2, a2) {
        var l2 = r2.pendingProps;
        switch (gu(r2), r2.tag) {
          case 16:
          case 15:
          case 0:
          case 11:
          case 7:
          case 8:
          case 12:
          case 9:
          case 14:
            return we(r2), null;
          case 1:
            return we(r2), null;
          case 3:
            return a2 = r2.stateNode, l2 = null, t2 !== null && (l2 = t2.memoizedState.cache), r2.memoizedState.cache !== l2 && (r2.flags |= 2048), En(qe), Xo(), a2.pendingContext && (a2.context = a2.pendingContext, a2.pendingContext = null), (t2 === null || t2.child === null) && (Ti(r2) ? It(r2) : t2 === null || t2.memoizedState.isDehydrated && (r2.flags & 256) === 0 || (r2.flags |= 1024, Dl())), Qu(t2, r2), we(r2), null;
          case 26:
            if (Gt) {
              var c2 = r2.type, d = r2.memoizedState;
              return t2 === null ? (It(r2), d !== null ? (we(r2), xe(r2, d)) : (we(r2), Fn(r2, c2, null, l2, a2))) : d ? d !== t2.memoizedState ? (It(r2), we(r2), xe(r2, d)) : (we(r2), r2.flags &= -16777217) : (d = t2.memoizedProps, $n ? d !== l2 && It(r2) : ds(t2, r2, c2, l2), we(r2), Fn(r2, c2, d, l2, a2)), null;
            }
          case 27:
            if (dn) {
              if (jl(r2), a2 = pa.current, c2 = r2.type, t2 !== null && r2.stateNode != null) $n ? t2.memoizedProps !== l2 && It(r2) : ds(t2, r2, c2, l2);
              else {
                if (!l2) {
                  if (r2.stateNode === null) throw Error(F(166));
                  return we(r2), null;
                }
                t2 = Dn.current, Ti(r2) ? Ep(r2, t2) : (t2 = _c(c2, l2, a2, t2, true), r2.stateNode = t2, It(r2));
              }
              return we(r2), null;
            }
          case 5:
            if (jl(r2), c2 = r2.type, t2 !== null && r2.stateNode != null) ds(t2, r2, c2, l2);
            else {
              if (!l2) {
                if (r2.stateNode === null) throw Error(F(166));
                return we(r2), null;
              }
              if (d = Dn.current, Ti(r2)) Ep(r2, d), Eh(r2.stateNode, c2, l2, d) && (r2.flags |= 64);
              else {
                var h2 = Vr(c2, l2, pa.current, d, r2);
                cs(r2), ef(h2, r2, false, false), r2.stateNode = h2, Kp(h2, c2, l2, d) && It(r2);
              }
            }
            return we(r2), Fn(r2, r2.type, t2 === null ? null : t2.memoizedProps, r2.pendingProps, a2), null;
          case 6:
            if (t2 && r2.stateNode != null) a2 = t2.memoizedProps, $n ? a2 !== l2 && It(r2) : Sr && (a2 !== l2 ? (t2 = pa.current, a2 = Dn.current, cs(r2), r2.stateNode = bc(l2, t2, a2, r2)) : r2.stateNode = t2.stateNode);
            else {
              if (typeof l2 != "string" && r2.stateNode === null) throw Error(F(166));
              if (t2 = pa.current, a2 = Dn.current, Ti(r2)) {
                if (!Hn) throw Error(F(176));
                if (t2 = r2.stateNode, a2 = r2.memoizedProps, l2 = null, c2 = bn, c2 !== null) switch (c2.tag) {
                  case 27:
                  case 5:
                    l2 = c2.memoizedProps;
                }
                xc(t2, a2, r2, l2) || ar(r2, true);
              } else cs(r2), r2.stateNode = bc(l2, t2, a2, r2);
            }
            return we(r2), null;
          case 31:
            if (a2 = r2.memoizedState, t2 === null || t2.memoizedState !== null) {
              if (l2 = Ti(r2), a2 !== null) {
                if (t2 === null) {
                  if (!l2) throw Error(F(318));
                  if (!Hn) throw Error(F(556));
                  if (t2 = r2.memoizedState, t2 = t2 !== null ? t2.dehydrated : null, !t2) throw Error(F(557));
                  zh(t2, r2);
                } else _a(), (r2.flags & 128) === 0 && (r2.memoizedState = null), r2.flags |= 4;
                we(r2), t2 = false;
              } else a2 = Dl(), t2 !== null && t2.memoizedState !== null && (t2.memoizedState.hydrationErrors = a2), t2 = true;
              if (!t2) return r2.flags & 256 ? (ht(r2), r2) : (ht(r2), null);
              if ((r2.flags & 128) !== 0) throw Error(F(558));
            }
            return we(r2), null;
          case 13:
            if (l2 = r2.memoizedState, t2 === null || t2.memoizedState !== null && t2.memoizedState.dehydrated !== null) {
              if (c2 = Ti(r2), l2 !== null && l2.dehydrated !== null) {
                if (t2 === null) {
                  if (!c2) throw Error(F(318));
                  if (!Hn) throw Error(F(344));
                  if (c2 = r2.memoizedState, c2 = c2 !== null ? c2.dehydrated : null, !c2) throw Error(F(317));
                  Hf(c2, r2);
                } else _a(), (r2.flags & 128) === 0 && (r2.memoizedState = null), r2.flags |= 4;
                we(r2), c2 = false;
              } else c2 = Dl(), t2 !== null && t2.memoizedState !== null && (t2.memoizedState.hydrationErrors = c2), c2 = true;
              if (!c2) return r2.flags & 256 ? (ht(r2), r2) : (ht(r2), null);
            }
            return ht(r2), (r2.flags & 128) !== 0 ? (r2.lanes = a2, r2) : (a2 = l2 !== null, t2 = t2 !== null && t2.memoizedState !== null, a2 && (l2 = r2.child, c2 = null, l2.alternate !== null && l2.alternate.memoizedState !== null && l2.alternate.memoizedState.cachePool !== null && (c2 = l2.alternate.memoizedState.cachePool.pool), d = null, l2.memoizedState !== null && l2.memoizedState.cachePool !== null && (d = l2.memoizedState.cachePool.pool), d !== c2 && (l2.flags |= 2048)), a2 !== t2 && a2 && (r2.child.flags |= 8192), Ba(r2, r2.updateQueue), we(r2), null);
          case 4:
            return Xo(), Qu(t2, r2), t2 === null && jm(r2.stateNode.containerInfo), we(r2), null;
          case 10:
            return En(r2.type), we(r2), null;
          case 19:
            if (D2(ln), l2 = r2.memoizedState, l2 === null) return we(r2), null;
            if (c2 = (r2.flags & 128) !== 0, d = l2.rendering, d === null) {
              if (c2) Co(l2, false);
              else {
                if (Xe !== 0 || t2 !== null && (t2.flags & 128) !== 0) for (t2 = r2.child; t2 !== null; ) {
                  if (d = ko(t2), d !== null) {
                    for (r2.flags |= 128, Co(l2, false), t2 = d.updateQueue, r2.updateQueue = t2, Ba(r2, t2), r2.subtreeFlags = 0, t2 = a2, a2 = r2.child; a2 !== null; ) yf(a2, t2), a2 = a2.sibling;
                    return Ce(ln, ln.current & 1 | 2), ue && or(r2, l2.treeForkCount), r2.child;
                  }
                  t2 = t2.sibling;
                }
                l2.tail !== null && ze() > ml && (r2.flags |= 128, c2 = true, Co(l2, false), r2.lanes = 4194304);
              }
            } else {
              if (!c2) if (t2 = ko(d), t2 !== null) {
                if (r2.flags |= 128, c2 = true, t2 = t2.updateQueue, r2.updateQueue = t2, Ba(r2, t2), Co(l2, true), l2.tail === null && l2.tailMode === "hidden" && !d.alternate && !ue) return we(r2), null;
              } else 2 * ze() - l2.renderingStartTime > ml && a2 !== 536870912 && (r2.flags |= 128, c2 = true, Co(l2, false), r2.lanes = 4194304);
              l2.isBackwards ? (d.sibling = r2.child, r2.child = d) : (t2 = l2.last, t2 !== null ? t2.sibling = d : r2.child = d, l2.last = d);
            }
            return l2.tail !== null ? (t2 = l2.tail, l2.rendering = t2, l2.tail = t2.sibling, l2.renderingStartTime = ze(), t2.sibling = null, a2 = ln.current, Ce(ln, c2 ? a2 & 1 | 2 : a2 & 1), ue && or(r2, l2.treeForkCount), t2) : (we(r2), null);
          case 22:
          case 23:
            return ht(r2), bo(), l2 = r2.memoizedState !== null, t2 !== null ? t2.memoizedState !== null !== l2 && (r2.flags |= 8192) : l2 && (r2.flags |= 8192), l2 ? (a2 & 536870912) !== 0 && (r2.flags & 128) === 0 && (we(r2), r2.subtreeFlags & 6 && (r2.flags |= 8192)) : we(r2), a2 = r2.updateQueue, a2 !== null && Ba(r2, a2.retryQueue), a2 = null, t2 !== null && t2.memoizedState !== null && t2.memoizedState.cachePool !== null && (a2 = t2.memoizedState.cachePool.pool), l2 = null, r2.memoizedState !== null && r2.memoizedState.cachePool !== null && (l2 = r2.memoizedState.cachePool.pool), l2 !== a2 && (r2.flags |= 2048), t2 !== null && D2(ha), null;
          case 24:
            return a2 = null, t2 !== null && (a2 = t2.memoizedState.cache), r2.memoizedState.cache !== a2 && (r2.flags |= 2048), En(qe), we(r2), null;
          case 25:
            return null;
          case 30:
            return null;
        }
        throw Error(F(156, r2.tag));
      }
      function gr(t2, r2) {
        switch (gu(r2), r2.tag) {
          case 1:
            return t2 = r2.flags, t2 & 65536 ? (r2.flags = t2 & -65537 | 128, r2) : null;
          case 3:
            return En(qe), Xo(), t2 = r2.flags, (t2 & 65536) !== 0 && (t2 & 128) === 0 ? (r2.flags = t2 & -65537 | 128, r2) : null;
          case 26:
          case 27:
          case 5:
            return jl(r2), null;
          case 31:
            if (r2.memoizedState !== null) {
              if (ht(r2), r2.alternate === null) throw Error(F(340));
              _a();
            }
            return t2 = r2.flags, t2 & 65536 ? (r2.flags = t2 & -65537 | 128, r2) : null;
          case 13:
            if (ht(r2), t2 = r2.memoizedState, t2 !== null && t2.dehydrated !== null) {
              if (r2.alternate === null) throw Error(F(340));
              _a();
            }
            return t2 = r2.flags, t2 & 65536 ? (r2.flags = t2 & -65537 | 128, r2) : null;
          case 19:
            return D2(ln), null;
          case 4:
            return Xo(), null;
          case 10:
            return En(r2.type), null;
          case 22:
          case 23:
            return ht(r2), bo(), t2 !== null && D2(ha), t2 = r2.flags, t2 & 65536 ? (r2.flags = t2 & -65537 | 128, r2) : null;
          case 24:
            return En(qe), null;
          case 25:
            return null;
          default:
            return null;
        }
      }
      function $u(t2, r2) {
        switch (gu(r2), r2.tag) {
          case 3:
            En(qe), Xo();
            break;
          case 26:
          case 27:
          case 5:
            jl(r2);
            break;
          case 4:
            Xo();
            break;
          case 31:
            r2.memoizedState !== null && ht(r2);
            break;
          case 13:
            ht(r2);
            break;
          case 19:
            D2(ln);
            break;
          case 10:
            En(r2.type);
            break;
          case 22:
          case 23:
            ht(r2), bo(), t2 !== null && D2(ha);
            break;
          case 24:
            En(qe);
        }
      }
      function Br(t2, r2) {
        try {
          var a2 = r2.updateQueue, l2 = a2 !== null ? a2.lastEffect : null;
          if (l2 !== null) {
            var c2 = l2.next;
            a2 = c2;
            do {
              if ((a2.tag & t2) === t2) {
                l2 = void 0;
                var d = a2.create, h2 = a2.inst;
                l2 = d(), h2.destroy = l2;
              }
              a2 = a2.next;
            } while (a2 !== c2);
          }
        } catch (y) {
          ve(r2, r2.return, y);
        }
      }
      function Or(t2, r2, a2) {
        try {
          var l2 = r2.updateQueue, c2 = l2 !== null ? l2.lastEffect : null;
          if (c2 !== null) {
            var d = c2.next;
            l2 = d;
            do {
              if ((l2.tag & t2) === t2) {
                var h2 = l2.inst, y = h2.destroy;
                if (y !== void 0) {
                  h2.destroy = void 0, c2 = r2;
                  var R = a2, L = y;
                  try {
                    L();
                  } catch (j2) {
                    ve(c2, R, j2);
                  }
                }
              }
              l2 = l2.next;
            } while (l2 !== d);
          }
        } catch (j2) {
          ve(r2, r2.return, j2);
        }
      }
      function Qi(t2) {
        var r2 = t2.updateQueue;
        if (r2 !== null) {
          var a2 = t2.stateNode;
          try {
            Fp(r2, a2);
          } catch (l2) {
            ve(t2, t2.return, l2);
          }
        }
      }
      function Vu(t2, r2, a2) {
        a2.props = Wr(t2.type, t2.memoizedProps), a2.state = t2.memoizedState;
        try {
          a2.componentWillUnmount();
        } catch (l2) {
          ve(t2, r2, l2);
        }
      }
      function ta(t2, r2) {
        try {
          var a2 = t2.ref;
          if (a2 !== null) {
            switch (t2.tag) {
              case 26:
              case 27:
              case 5:
                var l2 = Ts(t2.stateNode);
                break;
              case 30:
                l2 = t2.stateNode;
                break;
              default:
                l2 = t2.stateNode;
            }
            typeof a2 == "function" ? t2.refCleanup = a2(l2) : a2.current = l2;
          }
        } catch (c2) {
          ve(t2, r2, c2);
        }
      }
      function yr(t2, r2) {
        var a2 = t2.ref, l2 = t2.refCleanup;
        if (a2 !== null) if (typeof l2 == "function") try {
          l2();
        } catch (c2) {
          ve(t2, r2, c2);
        } finally {
          t2.refCleanup = null, t2 = t2.alternate, t2 != null && (t2.refCleanup = null);
        }
        else if (typeof a2 == "function") try {
          a2(null);
        } catch (c2) {
          ve(t2, r2, c2);
        }
        else a2.current = null;
      }
      function nf(t2) {
        var r2 = t2.type, a2 = t2.memoizedProps, l2 = t2.stateNode;
        try {
          dh(l2, r2, a2, t2);
        } catch (c2) {
          ve(t2, t2.return, c2);
        }
      }
      function qu(t2, r2, a2) {
        try {
          vc(t2.stateNode, t2.type, a2, r2, t2);
        } catch (l2) {
          ve(t2, t2.return, l2);
        }
      }
      function tf(t2) {
        return t2.tag === 5 || t2.tag === 3 || (Gt ? t2.tag === 26 : false) || (dn ? t2.tag === 27 && Xa(t2.type) : false) || t2.tag === 4;
      }
      function Gu(t2) {
        e: for (; ; ) {
          for (; t2.sibling === null; ) {
            if (t2.return === null || tf(t2.return)) return null;
            t2 = t2.return;
          }
          for (t2.sibling.return = t2.return, t2 = t2.sibling; t2.tag !== 5 && t2.tag !== 6 && t2.tag !== 18; ) {
            if (dn && t2.tag === 27 && Xa(t2.type) || t2.flags & 2 || t2.child === null || t2.tag === 4) continue e;
            t2.child.return = t2, t2 = t2.child;
          }
          if (!(t2.flags & 2)) return t2.stateNode;
        }
      }
      function fs(t2, r2, a2) {
        var l2 = t2.tag;
        if (l2 === 5 || l2 === 6) t2 = t2.stateNode, r2 ? ph(a2, t2, r2) : ch(a2, t2);
        else if (l2 !== 4 && (dn && l2 === 27 && Xa(t2.type) && (a2 = t2.stateNode, r2 = null), t2 = t2.child, t2 !== null)) for (fs(t2, r2, a2), t2 = t2.sibling; t2 !== null; ) fs(t2, r2, a2), t2 = t2.sibling;
      }
      function $i(t2, r2, a2) {
        var l2 = t2.tag;
        if (l2 === 5 || l2 === 6) t2 = t2.stateNode, r2 ? fh(a2, t2, r2) : uh(a2, t2);
        else if (l2 !== 4 && (dn && l2 === 27 && Xa(t2.type) && (a2 = t2.stateNode), t2 = t2.child, t2 !== null)) for ($i(t2, r2, a2), t2 = t2.sibling; t2 !== null; ) $i(t2, r2, a2), t2 = t2.sibling;
      }
      function Ju(t2, r2, a2) {
        t2 = t2.containerInfo;
        try {
          bh(t2, a2);
        } catch (l2) {
          ve(r2, r2.return, l2);
        }
      }
      function rf(t2) {
        var r2 = t2.stateNode, a2 = t2.memoizedProps;
        try {
          Rc(t2.type, a2, r2, t2);
        } catch (l2) {
          ve(t2, t2.return, l2);
        }
      }
      function Wp(t2, r2) {
        for (Am(t2.containerInfo), Pn = r2; Pn !== null; ) if (t2 = Pn, r2 = t2.child, (t2.subtreeFlags & 1028) !== 0 && r2 !== null) r2.return = t2, Pn = r2;
        else for (; Pn !== null; ) {
          t2 = Pn;
          var a2 = t2.alternate;
          switch (r2 = t2.flags, t2.tag) {
            case 0:
              if ((r2 & 4) !== 0 && (r2 = t2.updateQueue, r2 = r2 !== null ? r2.events : null, r2 !== null)) for (var l2 = 0; l2 < r2.length; l2++) {
                var c2 = r2[l2];
                c2.ref.impl = c2.nextImpl;
              }
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((r2 & 1024) !== 0 && a2 !== null) {
                r2 = void 0, l2 = t2, c2 = a2.memoizedProps, a2 = a2.memoizedState;
                var d = l2.stateNode;
                try {
                  var h2 = Wr(l2.type, c2);
                  r2 = d.getSnapshotBeforeUpdate(h2, a2), d.__reactInternalSnapshotBeforeUpdate = r2;
                } catch (y) {
                  ve(l2, l2.return, y);
                }
              }
              break;
            case 3:
              (r2 & 1024) !== 0 && $n && Nt(t2.stateNode.containerInfo);
              break;
            case 5:
            case 26:
            case 27:
            case 6:
            case 4:
            case 17:
              break;
            default:
              if ((r2 & 1024) !== 0) throw Error(F(163));
          }
          if (r2 = t2.sibling, r2 !== null) {
            r2.return = t2.return, Pn = r2;
            break;
          }
          Pn = t2.return;
        }
      }
      function of(t2, r2, a2) {
        var l2 = a2.flags;
        switch (a2.tag) {
          case 0:
          case 11:
          case 15:
            $t(t2, a2), l2 & 4 && Br(5, a2);
            break;
          case 1:
            if ($t(t2, a2), l2 & 4) if (t2 = a2.stateNode, r2 === null) try {
              t2.componentDidMount();
            } catch (h2) {
              ve(a2, a2.return, h2);
            }
            else {
              var c2 = Wr(a2.type, r2.memoizedProps);
              r2 = r2.memoizedState;
              try {
                t2.componentDidUpdate(c2, r2, t2.__reactInternalSnapshotBeforeUpdate);
              } catch (h2) {
                ve(a2, a2.return, h2);
              }
            }
            l2 & 64 && Qi(a2), l2 & 512 && ta(a2, a2.return);
            break;
          case 3:
            if ($t(t2, a2), l2 & 64 && (l2 = a2.updateQueue, l2 !== null)) {
              if (t2 = null, a2.child !== null) switch (a2.child.tag) {
                case 27:
                case 5:
                  t2 = Ts(a2.child.stateNode);
                  break;
                case 1:
                  t2 = a2.child.stateNode;
              }
              try {
                Fp(l2, t2);
              } catch (h2) {
                ve(a2, a2.return, h2);
              }
            }
            break;
          case 27:
            dn && r2 === null && l2 & 4 && rf(a2);
          case 26:
          case 5:
            if ($t(t2, a2), r2 === null) {
              if (l2 & 4) nf(a2);
              else if (l2 & 64) {
                t2 = a2.type, r2 = a2.memoizedProps, c2 = a2.stateNode;
                try {
                  _h(c2, t2, r2, a2);
                } catch (h2) {
                  ve(a2, a2.return, h2);
                }
              }
            }
            l2 & 512 && ta(a2, a2.return);
            break;
          case 12:
            $t(t2, a2);
            break;
          case 31:
            $t(t2, a2), l2 & 4 && af(t2, a2);
            break;
          case 13:
            $t(t2, a2), l2 & 4 && Yu(t2, a2), l2 & 64 && (l2 = a2.memoizedState, l2 !== null && (l2 = l2.dehydrated, l2 !== null && (a2 = sc.bind(null, a2), Xi(l2, a2))));
            break;
          case 22:
            if (l2 = a2.memoizedState !== null || eo, !l2) {
              r2 = r2 !== null && r2.memoizedState !== null || sn, c2 = eo;
              var d = sn;
              eo = l2, (sn = r2) && !d ? br(t2, a2, (a2.subtreeFlags & 8772) !== 0) : $t(t2, a2), eo = c2, sn = d;
            }
            break;
          case 30:
            break;
          default:
            $t(t2, a2);
        }
      }
      function Up(t2) {
        var r2 = t2.alternate;
        r2 !== null && (t2.alternate = null, Up(r2)), t2.child = null, t2.deletions = null, t2.sibling = null, t2.tag === 5 && (r2 = t2.stateNode, r2 !== null && th(r2)), t2.stateNode = null, t2.return = null, t2.dependencies = null, t2.memoizedProps = null, t2.memoizedState = null, t2.pendingProps = null, t2.stateNode = null, t2.updateQueue = null;
      }
      function Qt(t2, r2, a2) {
        for (a2 = a2.child; a2 !== null; ) Zu(t2, r2, a2), a2 = a2.sibling;
      }
      function Zu(t2, r2, a2) {
        if (on && typeof on.onCommitFiberUnmount == "function") try {
          on.onCommitFiberUnmount(ei, a2);
        } catch {
        }
        switch (a2.tag) {
          case 26:
            if (Gt) {
              sn || yr(a2, r2), Qt(t2, r2, a2), a2.memoizedState ? Hh(a2.memoizedState) : a2.stateNode && Wf(a2.stateNode);
              break;
            }
          case 27:
            if (dn) {
              sn || yr(a2, r2);
              var l2 = mn, c2 = Pt;
              Xa(a2.type) && (mn = a2.stateNode, Pt = false), Qt(t2, r2, a2), fa(a2.stateNode), mn = l2, Pt = c2;
              break;
            }
          case 5:
            sn || yr(a2, r2);
          case 6:
            if ($n) {
              if (l2 = mn, c2 = Pt, mn = null, Qt(t2, r2, a2), mn = l2, Pt = c2, mn !== null) if (Pt) try {
                If(mn, a2.stateNode);
              } catch (d) {
                ve(a2, r2, d);
              }
              else try {
                Ef(mn, a2.stateNode);
              } catch (d) {
                ve(a2, r2, d);
              }
            } else Qt(t2, r2, a2);
            break;
          case 18:
            $n && mn !== null && (Pt ? Af(mn, a2.stateNode) : Se(mn, a2.stateNode));
            break;
          case 4:
            $n ? (l2 = mn, c2 = Pt, mn = a2.stateNode.containerInfo, Pt = true, Qt(t2, r2, a2), mn = l2, Pt = c2) : (Sr && Ju(a2.stateNode, a2, We()), Qt(t2, r2, a2));
            break;
          case 0:
          case 11:
          case 14:
          case 15:
            Or(2, a2, r2), sn || Or(4, a2, r2), Qt(t2, r2, a2);
            break;
          case 1:
            sn || (yr(a2, r2), l2 = a2.stateNode, typeof l2.componentWillUnmount == "function" && Vu(a2, r2, l2)), Qt(t2, r2, a2);
            break;
          case 21:
            Qt(t2, r2, a2);
            break;
          case 22:
            sn = (l2 = sn) || a2.memoizedState !== null, Qt(t2, r2, a2), sn = l2;
            break;
          default:
            Qt(t2, r2, a2);
        }
      }
      function af(t2, r2) {
        if (Hn && r2.memoizedState === null && (t2 = r2.alternate, t2 !== null && (t2 = t2.memoizedState, t2 !== null))) {
          t2 = t2.dehydrated;
          try {
            Rh(t2);
          } catch (a2) {
            ve(r2, r2.return, a2);
          }
        }
      }
      function Yu(t2, r2) {
        if (Hn && r2.memoizedState === null && (t2 = r2.alternate, t2 !== null && (t2 = t2.memoizedState, t2 !== null && (t2 = t2.dehydrated, t2 !== null)))) try {
          el(t2);
        } catch (a2) {
          ve(r2, r2.return, a2);
        }
      }
      function Bp(t2) {
        switch (t2.tag) {
          case 31:
          case 13:
          case 19:
            var r2 = t2.stateNode;
            return r2 === null && (r2 = t2.stateNode = new $c()), r2;
          case 22:
            return t2 = t2.stateNode, r2 = t2._retryCache, r2 === null && (r2 = t2._retryCache = new $c()), r2;
          default:
            throw Error(F(435, t2.tag));
        }
      }
      function ps(t2, r2) {
        var a2 = Bp(t2);
        r2.forEach(function(l2) {
          if (!a2.has(l2)) {
            a2.add(l2);
            var c2 = Zp.bind(null, t2, l2);
            l2.then(c2, c2);
          }
        });
      }
      function tn(t2, r2) {
        var a2 = r2.deletions;
        if (a2 !== null) for (var l2 = 0; l2 < a2.length; l2++) {
          var c2 = a2[l2], d = t2, h2 = r2;
          if ($n) {
            var y = h2;
            e: for (; y !== null; ) {
              switch (y.tag) {
                case 27:
                  if (dn) {
                    if (Xa(y.type)) {
                      mn = y.stateNode, Pt = false;
                      break e;
                    }
                    break;
                  }
                case 5:
                  mn = y.stateNode, Pt = false;
                  break e;
                case 3:
                case 4:
                  mn = y.stateNode.containerInfo, Pt = true;
                  break e;
              }
              y = y.return;
            }
            if (mn === null) throw Error(F(160));
            Zu(d, h2, c2), mn = null, Pt = false;
          } else Zu(d, h2, c2);
          d = c2.alternate, d !== null && (d.return = null), c2.return = null;
        }
        if (r2.subtreeFlags & 13886) for (r2 = r2.child; r2 !== null; ) hs(r2, t2), r2 = r2.sibling;
      }
      function hs(t2, r2) {
        var a2 = t2.alternate, l2 = t2.flags;
        switch (t2.tag) {
          case 0:
          case 11:
          case 14:
          case 15:
            tn(r2, t2), Mn(t2), l2 & 4 && (Or(3, t2, t2.return), Br(3, t2), Or(5, t2, t2.return));
            break;
          case 1:
            tn(r2, t2), Mn(t2), l2 & 512 && (sn || a2 === null || yr(a2, a2.return)), l2 & 64 && eo && (t2 = t2.updateQueue, t2 !== null && (l2 = t2.callbacks, l2 !== null && (a2 = t2.shared.hiddenCallbacks, t2.shared.hiddenCallbacks = a2 === null ? l2 : a2.concat(l2))));
            break;
          case 26:
            if (Gt) {
              var c2 = Cr;
              if (tn(r2, t2), Mn(t2), l2 & 512 && (sn || a2 === null || yr(a2, a2.return)), l2 & 4) {
                l2 = a2 !== null ? a2.memoizedState : null;
                var d = t2.memoizedState;
                a2 === null ? d === null ? t2.stateNode === null ? t2.stateNode = Ya(c2, t2.type, t2.memoizedProps, t2) : Cc(c2, t2.type, t2.stateNode) : t2.stateNode = Fh(c2, d, t2.memoizedProps) : l2 !== d ? (l2 === null ? a2.stateNode !== null && Wf(a2.stateNode) : Hh(l2), d === null ? Cc(c2, t2.type, t2.stateNode) : Fh(c2, d, t2.memoizedProps)) : d === null && t2.stateNode !== null && qu(t2, t2.memoizedProps, a2.memoizedProps);
              }
              break;
            }
          case 27:
            if (dn) {
              tn(r2, t2), Mn(t2), l2 & 512 && (sn || a2 === null || yr(a2, a2.return)), a2 !== null && l2 & 4 && qu(t2, t2.memoizedProps, a2.memoizedProps);
              break;
            }
          case 5:
            if (tn(r2, t2), Mn(t2), l2 & 512 && (sn || a2 === null || yr(a2, a2.return)), $n) {
              if (t2.flags & 32) {
                c2 = t2.stateNode;
                try {
                  Sc(c2);
                } catch (A) {
                  ve(t2, t2.return, A);
                }
              }
              l2 & 4 && t2.stateNode != null && (c2 = t2.memoizedProps, qu(t2, c2, a2 !== null ? a2.memoizedProps : c2)), l2 & 1024 && (Ms = true);
            } else Sr && t2.alternate !== null && (t2.alternate.stateNode = t2.stateNode);
            break;
          case 6:
            if (tn(r2, t2), Mn(t2), l2 & 4 && $n) {
              if (t2.stateNode === null) throw Error(F(162));
              l2 = t2.memoizedProps, a2 = a2 !== null ? a2.memoizedProps : l2, c2 = t2.stateNode;
              try {
                Is(c2, a2, l2);
              } catch (A) {
                ve(t2, t2.return, A);
              }
            }
            break;
          case 3:
            if (Gt ? (jh(), c2 = Cr, Cr = zc(r2.containerInfo), tn(r2, t2), Cr = c2) : tn(r2, t2), Mn(t2), l2 & 4) {
              if ($n && Hn && a2 !== null && a2.memoizedState.isDehydrated) try {
                Mm(r2.containerInfo);
              } catch (A) {
                ve(t2, t2.return, A);
              }
              if (Sr) {
                l2 = r2.containerInfo, a2 = r2.pendingChildren;
                try {
                  bh(l2, a2);
                } catch (A) {
                  ve(t2, t2.return, A);
                }
              }
            }
            Ms && (Ms = false, Op(t2));
            break;
          case 4:
            Gt ? (a2 = Cr, Cr = zc(t2.stateNode.containerInfo), tn(r2, t2), Mn(t2), Cr = a2) : (tn(r2, t2), Mn(t2)), l2 & 4 && Sr && Ju(t2.stateNode, t2, t2.stateNode.pendingChildren);
            break;
          case 12:
            tn(r2, t2), Mn(t2);
            break;
          case 31:
            tn(r2, t2), Mn(t2), l2 & 4 && (l2 = t2.updateQueue, l2 !== null && (t2.updateQueue = null, ps(t2, l2)));
            break;
          case 13:
            tn(r2, t2), Mn(t2), t2.child.flags & 8192 && t2.memoizedState !== null != (a2 !== null && a2.memoizedState !== null) && (Vs = ze()), l2 & 4 && (l2 = t2.updateQueue, l2 !== null && (t2.updateQueue = null, ps(t2, l2)));
            break;
          case 22:
            c2 = t2.memoizedState !== null;
            var h2 = a2 !== null && a2.memoizedState !== null, y = eo, R = sn;
            if (eo = y || c2, sn = R || h2, tn(r2, t2), sn = R, eo = y, Mn(t2), l2 & 8192 && (r2 = t2.stateNode, r2._visibility = c2 ? r2._visibility & -2 : r2._visibility | 1, c2 && (a2 === null || h2 || eo || sn || Vt(t2)), $n)) {
              e: if (a2 = null, $n) for (r2 = t2; ; ) {
                if (r2.tag === 5 || Gt && r2.tag === 26) {
                  if (a2 === null) {
                    h2 = a2 = r2;
                    try {
                      d = h2.stateNode, c2 ? hh(d) : Wm(h2.stateNode, h2.memoizedProps);
                    } catch (A) {
                      ve(h2, h2.return, A);
                    }
                  }
                } else if (r2.tag === 6) {
                  if (a2 === null) {
                    h2 = r2;
                    try {
                      var L = h2.stateNode;
                      c2 ? kc(L) : mh(L, h2.memoizedProps);
                    } catch (A) {
                      ve(h2, h2.return, A);
                    }
                  }
                } else if (r2.tag === 18) {
                  if (a2 === null) {
                    h2 = r2;
                    try {
                      var j2 = h2.stateNode;
                      c2 ? Qm(j2) : Lh(h2.stateNode);
                    } catch (A) {
                      ve(h2, h2.return, A);
                    }
                  }
                } else if ((r2.tag !== 22 && r2.tag !== 23 || r2.memoizedState === null || r2 === t2) && r2.child !== null) {
                  r2.child.return = r2, r2 = r2.child;
                  continue;
                }
                if (r2 === t2) break e;
                for (; r2.sibling === null; ) {
                  if (r2.return === null || r2.return === t2) break e;
                  a2 === r2 && (a2 = null), r2 = r2.return;
                }
                a2 === r2 && (a2 = null), r2.sibling.return = r2.return, r2 = r2.sibling;
              }
            }
            l2 & 4 && (l2 = t2.updateQueue, l2 !== null && (a2 = l2.retryQueue, a2 !== null && (l2.retryQueue = null, ps(t2, a2))));
            break;
          case 19:
            tn(r2, t2), Mn(t2), l2 & 4 && (l2 = t2.updateQueue, l2 !== null && (t2.updateQueue = null, ps(t2, l2)));
            break;
          case 30:
            break;
          case 21:
            break;
          default:
            tn(r2, t2), Mn(t2);
        }
      }
      function Mn(t2) {
        var r2 = t2.flags;
        if (r2 & 2) {
          try {
            for (var a2, l2 = t2.return; l2 !== null; ) {
              if (tf(l2)) {
                a2 = l2;
                break;
              }
              l2 = l2.return;
            }
            if ($n) {
              if (a2 == null) throw Error(F(160));
              switch (a2.tag) {
                case 27:
                  if (dn) {
                    var c2 = a2.stateNode, d = Gu(t2);
                    $i(t2, d, c2);
                    break;
                  }
                case 5:
                  var h2 = a2.stateNode;
                  a2.flags & 32 && (Sc(h2), a2.flags &= -33);
                  var y = Gu(t2);
                  $i(t2, y, h2);
                  break;
                case 3:
                case 4:
                  var R = a2.stateNode.containerInfo, L = Gu(t2);
                  fs(t2, L, R);
                  break;
                default:
                  throw Error(F(161));
              }
            }
          } catch (j2) {
            ve(t2, t2.return, j2);
          }
          t2.flags &= -3;
        }
        r2 & 4096 && (t2.flags &= -4097);
      }
      function Op(t2) {
        if (t2.subtreeFlags & 1024) for (t2 = t2.child; t2 !== null; ) {
          var r2 = t2;
          Op(r2), r2.tag === 5 && r2.flags & 1024 && qa(r2.stateNode), t2 = t2.sibling;
        }
      }
      function $t(t2, r2) {
        if (r2.subtreeFlags & 8772) for (r2 = r2.child; r2 !== null; ) of(t2, r2.alternate, r2), r2 = r2.sibling;
      }
      function Vt(t2) {
        for (t2 = t2.child; t2 !== null; ) {
          var r2 = t2;
          switch (r2.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
              Or(4, r2, r2.return), Vt(r2);
              break;
            case 1:
              yr(r2, r2.return);
              var a2 = r2.stateNode;
              typeof a2.componentWillUnmount == "function" && Vu(r2, r2.return, a2), Vt(r2);
              break;
            case 27:
              dn && fa(r2.stateNode);
            case 26:
            case 5:
              yr(r2, r2.return), Vt(r2);
              break;
            case 22:
              r2.memoizedState === null && Vt(r2);
              break;
            case 30:
              Vt(r2);
              break;
            default:
              Vt(r2);
          }
          t2 = t2.sibling;
        }
      }
      function br(t2, r2, a2) {
        for (a2 = a2 && (r2.subtreeFlags & 8772) !== 0, r2 = r2.child; r2 !== null; ) {
          var l2 = r2.alternate, c2 = t2, d = r2, h2 = d.flags;
          switch (d.tag) {
            case 0:
            case 11:
            case 15:
              br(c2, d, a2), Br(4, d);
              break;
            case 1:
              if (br(c2, d, a2), l2 = d, c2 = l2.stateNode, typeof c2.componentDidMount == "function") try {
                c2.componentDidMount();
              } catch (L) {
                ve(l2, l2.return, L);
              }
              if (l2 = d, c2 = l2.updateQueue, c2 !== null) {
                var y = l2.stateNode;
                try {
                  var R = c2.shared.hiddenCallbacks;
                  if (R !== null) for (c2.shared.hiddenCallbacks = null, c2 = 0; c2 < R.length; c2++) Dd(R[c2], y);
                } catch (L) {
                  ve(l2, l2.return, L);
                }
              }
              a2 && h2 & 64 && Qi(d), ta(d, d.return);
              break;
            case 27:
              dn && rf(d);
            case 26:
            case 5:
              br(c2, d, a2), a2 && l2 === null && h2 & 4 && nf(d), ta(d, d.return);
              break;
            case 12:
              br(c2, d, a2);
              break;
            case 31:
              br(c2, d, a2), a2 && h2 & 4 && af(c2, d);
              break;
            case 13:
              br(c2, d, a2), a2 && h2 & 4 && Yu(c2, d);
              break;
            case 22:
              d.memoizedState === null && br(c2, d, a2), ta(d, d.return);
              break;
            case 30:
              break;
            default:
              br(c2, d, a2);
          }
          r2 = r2.sibling;
        }
      }
      function To(t2, r2) {
        var a2 = null;
        t2 !== null && t2.memoizedState !== null && t2.memoizedState.cachePool !== null && (a2 = t2.memoizedState.cachePool.pool), t2 = null, r2.memoizedState !== null && r2.memoizedState.cachePool !== null && (t2 = r2.memoizedState.cachePool.pool), t2 !== a2 && (t2 != null && t2.refCount++, a2 != null && Ra(a2));
      }
      function Qn(t2, r2) {
        t2 = null, r2.alternate !== null && (t2 = r2.alternate.memoizedState.cache), r2 = r2.memoizedState.cache, r2 !== t2 && (r2.refCount++, t2 != null && Ra(t2));
      }
      function yt(t2, r2, a2, l2) {
        if (r2.subtreeFlags & 10256) for (r2 = r2.child; r2 !== null; ) Mp(t2, r2, a2, l2), r2 = r2.sibling;
      }
      function Mp(t2, r2, a2, l2) {
        var c2 = r2.flags;
        switch (r2.tag) {
          case 0:
          case 11:
          case 15:
            yt(t2, r2, a2, l2), c2 & 2048 && Br(9, r2);
            break;
          case 1:
            yt(t2, r2, a2, l2);
            break;
          case 3:
            yt(t2, r2, a2, l2), c2 & 2048 && (t2 = null, r2.alternate !== null && (t2 = r2.alternate.memoizedState.cache), r2 = r2.memoizedState.cache, r2 !== t2 && (r2.refCount++, t2 != null && Ra(t2)));
            break;
          case 12:
            if (c2 & 2048) {
              yt(t2, r2, a2, l2), t2 = r2.stateNode;
              try {
                var d = r2.memoizedProps, h2 = d.id, y = d.onPostCommit;
                typeof y == "function" && y(h2, r2.alternate === null ? "mount" : "update", t2.passiveEffectDuration, -0);
              } catch (R) {
                ve(r2, r2.return, R);
              }
            } else yt(t2, r2, a2, l2);
            break;
          case 31:
            yt(t2, r2, a2, l2);
            break;
          case 13:
            yt(t2, r2, a2, l2);
            break;
          case 23:
            break;
          case 22:
            d = r2.stateNode, h2 = r2.alternate, r2.memoizedState !== null ? d._visibility & 2 ? yt(t2, r2, a2, l2) : oa(t2, r2) : d._visibility & 2 ? yt(t2, r2, a2, l2) : (d._visibility |= 2, ra(t2, r2, a2, l2, (r2.subtreeFlags & 10256) !== 0 || false)), c2 & 2048 && To(h2, r2);
            break;
          case 24:
            yt(t2, r2, a2, l2), c2 & 2048 && Qn(r2.alternate, r2);
            break;
          default:
            yt(t2, r2, a2, l2);
        }
      }
      function ra(t2, r2, a2, l2, c2) {
        for (c2 = c2 && ((r2.subtreeFlags & 10256) !== 0 || false), r2 = r2.child; r2 !== null; ) {
          var d = t2, h2 = r2, y = a2, R = l2, L = h2.flags;
          switch (h2.tag) {
            case 0:
            case 11:
            case 15:
              ra(d, h2, y, R, c2), Br(8, h2);
              break;
            case 23:
              break;
            case 22:
              var j2 = h2.stateNode;
              h2.memoizedState !== null ? j2._visibility & 2 ? ra(d, h2, y, R, c2) : oa(d, h2) : (j2._visibility |= 2, ra(d, h2, y, R, c2)), c2 && L & 2048 && To(h2.alternate, h2);
              break;
            case 24:
              ra(d, h2, y, R, c2), c2 && L & 2048 && Qn(h2.alternate, h2);
              break;
            default:
              ra(d, h2, y, R, c2);
          }
          r2 = r2.sibling;
        }
      }
      function oa(t2, r2) {
        if (r2.subtreeFlags & 10256) for (r2 = r2.child; r2 !== null; ) {
          var a2 = t2, l2 = r2, c2 = l2.flags;
          switch (l2.tag) {
            case 22:
              oa(a2, l2), c2 & 2048 && To(l2.alternate, l2);
              break;
            case 24:
              oa(a2, l2), c2 & 2048 && Qn(l2.alternate, l2);
              break;
            default:
              oa(a2, l2);
          }
          r2 = r2.sibling;
        }
      }
      function _o(t2, r2, a2) {
        if (t2.subtreeFlags & ga) for (t2 = t2.child; t2 !== null; ) lf(t2, r2, a2), t2 = t2.sibling;
      }
      function lf(t2, r2, a2) {
        switch (t2.tag) {
          case 26:
            if (_o(t2, r2, a2), t2.flags & ga) if (t2.memoizedState !== null) Fo(a2, Cr, t2.memoizedState, t2.memoizedProps);
            else {
              var l2 = t2.stateNode, c2 = t2.type;
              t2 = t2.memoizedProps, ((r2 & 335544128) === r2 || Yi(c2, t2)) && Vn(a2, l2, c2, t2);
            }
            break;
          case 5:
            _o(t2, r2, a2), t2.flags & ga && (l2 = t2.stateNode, c2 = t2.type, t2 = t2.memoizedProps, ((r2 & 335544128) === r2 || Yi(c2, t2)) && Vn(a2, l2, c2, t2));
            break;
          case 3:
          case 4:
            Gt ? (l2 = Cr, Cr = zc(t2.stateNode.containerInfo), _o(t2, r2, a2), Cr = l2) : _o(t2, r2, a2);
            break;
          case 22:
            t2.memoizedState === null && (l2 = t2.alternate, l2 !== null && l2.memoizedState !== null ? (l2 = ga, ga = 16777216, _o(t2, r2, a2), ga = l2) : _o(t2, r2, a2));
            break;
          default:
            _o(t2, r2, a2);
        }
      }
      function Xu(t2) {
        var r2 = t2.alternate;
        if (r2 !== null && (t2 = r2.child, t2 !== null)) {
          r2.child = null;
          do
            r2 = t2.sibling, t2.sibling = null, t2 = r2;
          while (t2 !== null);
        }
      }
      function aa(t2) {
        var r2 = t2.deletions;
        if ((t2.flags & 16) !== 0) {
          if (r2 !== null) for (var a2 = 0; a2 < r2.length; a2++) {
            var l2 = r2[a2];
            Pn = l2, ec(l2, t2);
          }
          Xu(t2);
        }
        if (t2.subtreeFlags & 10256) for (t2 = t2.child; t2 !== null; ) Ku(t2), t2 = t2.sibling;
      }
      function Ku(t2) {
        switch (t2.tag) {
          case 0:
          case 11:
          case 15:
            aa(t2), t2.flags & 2048 && Or(9, t2, t2.return);
            break;
          case 3:
            aa(t2);
            break;
          case 12:
            aa(t2);
            break;
          case 22:
            var r2 = t2.stateNode;
            t2.memoizedState !== null && r2._visibility & 2 && (t2.return === null || t2.return.tag !== 13) ? (r2._visibility &= -3, Ma(t2)) : aa(t2);
            break;
          default:
            aa(t2);
        }
      }
      function Ma(t2) {
        var r2 = t2.deletions;
        if ((t2.flags & 16) !== 0) {
          if (r2 !== null) for (var a2 = 0; a2 < r2.length; a2++) {
            var l2 = r2[a2];
            Pn = l2, ec(l2, t2);
          }
          Xu(t2);
        }
        for (t2 = t2.child; t2 !== null; ) {
          switch (r2 = t2, r2.tag) {
            case 0:
            case 11:
            case 15:
              Or(8, r2, r2.return), Ma(r2);
              break;
            case 22:
              a2 = r2.stateNode, a2._visibility & 2 && (a2._visibility &= -3, Ma(r2));
              break;
            default:
              Ma(r2);
          }
          t2 = t2.sibling;
        }
      }
      function ec(t2, r2) {
        for (; Pn !== null; ) {
          var a2 = Pn;
          switch (a2.tag) {
            case 0:
            case 11:
            case 15:
              Or(8, a2, r2);
              break;
            case 23:
            case 22:
              if (a2.memoizedState !== null && a2.memoizedState.cachePool !== null) {
                var l2 = a2.memoizedState.cachePool.pool;
                l2 != null && l2.refCount++;
              }
              break;
            case 24:
              Ra(a2.memoizedState.cache);
          }
          if (l2 = a2.child, l2 !== null) l2.return = a2, Pn = l2;
          else e: for (a2 = t2; Pn !== null; ) {
            l2 = Pn;
            var c2 = l2.sibling, d = l2.return;
            if (Up(l2), l2 === a2) {
              Pn = null;
              break e;
            }
            if (c2 !== null) {
              c2.return = d, Pn = c2;
              break e;
            }
            Pn = d;
          }
        }
      }
      function Vi(t2) {
        var r2 = nh(t2);
        if (r2 != null) {
          if (typeof r2.memoizedProps["data-testname"] != "string") throw Error(F(364));
          return r2;
        }
        if (t2 = Rf(t2), t2 === null) throw Error(F(362));
        return t2.stateNode.current;
      }
      function ms(t2, r2) {
        var a2 = t2.tag;
        switch (r2.$$typeof) {
          case Vc:
            if (t2.type === r2.value) return true;
            break;
          case qc:
            e: {
              for (r2 = r2.value, t2 = [t2, 0], a2 = 0; a2 < t2.length; ) {
                var l2 = t2[a2++], c2 = l2.tag, d = t2[a2++], h2 = r2[d];
                if (c2 !== 5 && c2 !== 26 && c2 !== 27 || !Jr(l2)) {
                  for (; h2 != null && ms(l2, h2); ) d++, h2 = r2[d];
                  if (d === r2.length) {
                    r2 = true;
                    break e;
                  } else for (l2 = l2.child; l2 !== null; ) t2.push(l2, d), l2 = l2.sibling;
                }
              }
              r2 = false;
            }
            return r2;
          case Gc:
            if ((a2 === 5 || a2 === 26 || a2 === 27) && sh(t2.stateNode, r2.value)) return true;
            break;
          case Zc:
            if ((a2 === 5 || a2 === 6 || a2 === 26 || a2 === 27) && (t2 = lh(t2), t2 !== null && 0 <= t2.indexOf(r2.value))) return true;
            break;
          case Jc:
            if ((a2 === 5 || a2 === 26 || a2 === 27) && (t2 = t2.memoizedProps["data-testname"], typeof t2 == "string" && t2.toLowerCase() === r2.value.toLowerCase())) return true;
            break;
          default:
            throw Error(F(365));
        }
        return false;
      }
      function nc(t2) {
        switch (t2.$$typeof) {
          case Vc:
            return "<" + (hu(t2.value) || "Unknown") + ">";
          case qc:
            return ":has(" + (nc(t2) || "") + ")";
          case Gc:
            return '[role="' + t2.value + '"]';
          case Zc:
            return '"' + t2.value + '"';
          case Jc:
            return '[data-testname="' + t2.value + '"]';
          default:
            throw Error(F(365));
        }
      }
      function sf(t2, r2) {
        var a2 = [];
        t2 = [t2, 0];
        for (var l2 = 0; l2 < t2.length; ) {
          var c2 = t2[l2++], d = c2.tag, h2 = t2[l2++], y = r2[h2];
          if (d !== 5 && d !== 26 && d !== 27 || !Jr(c2)) {
            for (; y != null && ms(c2, y); ) h2++, y = r2[h2];
            if (h2 === r2.length) a2.push(c2);
            else for (c2 = c2.child; c2 !== null; ) t2.push(c2, h2), c2 = c2.sibling;
          }
        }
        return a2;
      }
      function gs(t2, r2) {
        if (!Ga) throw Error(F(363));
        t2 = Vi(t2), t2 = sf(t2, r2), r2 = [], t2 = Array.from(t2);
        for (var a2 = 0; a2 < t2.length; ) {
          var l2 = t2[a2++], c2 = l2.tag;
          if (c2 === 5 || c2 === 26 || c2 === 27) Jr(l2) || r2.push(l2.stateNode);
          else for (l2 = l2.child; l2 !== null; ) t2.push(l2), l2 = l2.sibling;
        }
        return r2;
      }
      function bt() {
        return (ce & 2) !== 0 && he !== 0 ? he & -he : M2.T !== null ? ku() : kr();
      }
      function ys() {
        if (At === 0) if ((he & 536870912) === 0 || ue) {
          var t2 = js;
          js <<= 1, (js & 3932160) === 0 && (js = 262144), At = t2;
        } else At = 536870912;
        return t2 = Ft.current, t2 !== null && (t2.flags |= 32), At;
      }
      function nt(t2, r2, a2) {
        (t2 === Ne && (_e === 2 || _e === 9) || t2.cancelPendingCommit !== null) && (la(t2, 0), Ro(t2, he, At, false)), xi(t2, a2), ((ce & 2) === 0 || t2 !== Ne) && (t2 === Ne && ((ce & 2) === 0 && (ii |= a2), Xe === 4 && Ro(t2, he, At, false)), ir(t2));
      }
      function uf(t2, r2, a2) {
        if ((ce & 6) !== 0) throw Error(F(327));
        var l2 = !a2 && (r2 & 127) === 0 && (r2 & t2.expiredLanes) === 0 || Pi(t2, r2), c2 = l2 ? Gp(t2, r2) : Ji(t2, r2, true), d = l2;
        do {
          if (c2 === 0) {
            ai && !l2 && Ro(t2, r2, 0, false);
            break;
          } else {
            if (a2 = t2.current.alternate, d && !Qp(a2)) {
              c2 = Ji(t2, r2, false), d = false;
              continue;
            }
            if (c2 === 2) {
              if (d = r2, t2.errorRecoveryDisabledLanes & d) var h2 = 0;
              else h2 = t2.pendingLanes & -536870913, h2 = h2 !== 0 ? h2 : h2 & 536870912 ? 536870912 : 0;
              if (h2 !== 0) {
                r2 = h2;
                e: {
                  var y = t2;
                  c2 = $s;
                  var R = Hn && y.current.memoizedState.isDehydrated;
                  if (R && (la(y, h2).flags |= 256), h2 = Ji(y, h2, false), h2 !== 2) {
                    if (Gf && !R) {
                      y.errorRecoveryDisabledLanes |= d, ii |= d, c2 = 4;
                      break e;
                    }
                    d = xt, xt = c2, d !== null && (xt === null ? xt = d : xt.push.apply(xt, d));
                  }
                  c2 = h2;
                }
                if (d = false, c2 !== 2) continue;
              }
            }
            if (c2 === 1) {
              la(t2, 0), Ro(t2, r2, 0, true);
              break;
            }
            e: {
              switch (l2 = t2, d = c2, d) {
                case 0:
                case 1:
                  throw Error(F(345));
                case 4:
                  if ((r2 & 4194048) !== r2) break;
                case 6:
                  Ro(l2, r2, At, !ya);
                  break e;
                case 2:
                  xt = null;
                  break;
                case 3:
                case 5:
                  break;
                default:
                  throw Error(F(329));
              }
              if ((r2 & 62914560) === r2 && (c2 = Vs + 300 - ze(), 10 < c2)) {
                if (Ro(l2, r2, At, !ya), Lr(l2, 0, true) !== 0) break e;
                no = r2, l2.timeoutHandle = eh(tc.bind(null, l2, a2, xt, Xc, Yc, r2, At, ii, hl, ya, d, "Throttled", -0, 0), c2);
                break e;
              }
              tc(l2, a2, xt, Xc, Yc, r2, At, ii, hl, ya, d, null, -0, 0);
            }
          }
          break;
        } while (true);
        ir(t2);
      }
      function tc(t2, r2, a2, l2, c2, d, h2, y, R, L, j2, A, W2, V) {
        if (t2.timeoutHandle = Lo, A = r2.subtreeFlags, A & 8192 || (A & 16785408) === 16785408) {
          A = oh(), lf(r2, d, A);
          var Oe = (d & 62914560) === d ? Vs - ze() : (d & 4194048) === d ? Zf - ze() : 0;
          if (Oe = ah(A, Oe), Oe !== null) {
            no = d, t2.cancelPendingCommit = Oe(pf.bind(null, t2, r2, d, a2, l2, c2, h2, y, R, j2, A, null, W2, V)), Ro(t2, d, h2, !L);
            return;
          }
        }
        pf(t2, r2, d, a2, l2, c2, h2, y, R);
      }
      function Qp(t2) {
        for (var r2 = t2; ; ) {
          var a2 = r2.tag;
          if ((a2 === 0 || a2 === 11 || a2 === 15) && r2.flags & 16384 && (a2 = r2.updateQueue, a2 !== null && (a2 = a2.stores, a2 !== null))) for (var l2 = 0; l2 < a2.length; l2++) {
            var c2 = a2[l2], d = c2.getSnapshot;
            c2 = c2.value;
            try {
              if (!jn(d(), c2)) return false;
            } catch {
              return false;
            }
          }
          if (a2 = r2.child, r2.subtreeFlags & 16384 && a2 !== null) a2.return = r2, r2 = a2;
          else {
            if (r2 === t2) break;
            for (; r2.sibling === null; ) {
              if (r2.return === null || r2.return === t2) return true;
              r2 = r2.return;
            }
            r2.sibling.return = r2.return, r2 = r2.sibling;
          }
        }
        return true;
      }
      function Ro(t2, r2, a2, l2) {
        r2 &= ~Jf, r2 &= ~ii, t2.suspendedLanes |= r2, t2.pingedLanes &= ~r2, l2 && (t2.warmLanes |= r2), l2 = t2.expirationTimes;
        for (var c2 = r2; 0 < c2; ) {
          var d = 31 - vt(c2), h2 = 1 << d;
          l2[d] = -1, c2 &= ~h2;
        }
        a2 !== 0 && Yo(t2, a2, r2);
      }
      function ia() {
        return (ce & 6) === 0 ? (Ea(0, false), false) : true;
      }
      function bs() {
        if (de !== null) {
          if (_e === 0) var t2 = de.return;
          else t2 = de, Be = at = null, Vl(t2), Kt = null, Bs = 0, t2 = de;
          for (; t2 !== null; ) $u(t2.alternate, t2), t2 = t2.return;
          de = null;
        }
      }
      function la(t2, r2) {
        var a2 = t2.timeoutHandle;
        a2 !== Lo && (t2.timeoutHandle = Lo, Tf(a2)), a2 = t2.cancelPendingCommit, a2 !== null && (t2.cancelPendingCommit = null, a2()), no = 0, bs(), Ne = t2, de = a2 = Qr(t2.current, null), he = r2, _e = 0, Ht = null, ya = false, ai = Pi(t2, r2), Gf = false, hl = At = Jf = ii = ba = Xe = 0, xt = $s = null, Yc = false, (r2 & 8) !== 0 && (r2 |= r2 & 32);
        var l2 = t2.entangledLanes;
        if (l2 !== 0) for (t2 = t2.entanglements, l2 &= r2; 0 < l2; ) {
          var c2 = 31 - vt(l2), d = 1 << c2;
          r2 |= t2[c2], l2 &= ~d;
        }
        return Uo = r2, Bn(), a2;
      }
      function $p(t2, r2) {
        ne = null, M2.H = Os, r2 === cl || r2 === jc ? (r2 = Bl(), _e = 3) : r2 === Ac ? (r2 = Bl(), _e = 4) : _e = r2 === Mc ? 8 : r2 !== null && typeof r2 == "object" && typeof r2.then == "function" ? 6 : 1, Ht = r2, de === null && (Xe = 1, rs(t2, ut(r2, t2.current)));
      }
      function Vp() {
        var t2 = Ft.current;
        return t2 === null ? true : (he & 4194048) === he ? zr === null : (he & 62914560) === he || (he & 536870912) !== 0 ? t2 === zr : false;
      }
      function cf() {
        var t2 = M2.H;
        return M2.H = Os, t2 === null ? Os : t2;
      }
      function qi() {
        var t2 = M2.A;
        return M2.A = Zm, t2;
      }
      function Gi() {
        Xe = 4, ya || (he & 4194048) !== he && Ft.current !== null || (ai = true), (ba & 134217727) === 0 && (ii & 134217727) === 0 || Ne === null || Ro(Ne, he, At, false);
      }
      function Ji(t2, r2, a2) {
        var l2 = ce;
        ce |= 2;
        var c2 = cf(), d = qi();
        (Ne !== t2 || he !== r2) && (Xc = null, la(t2, r2)), r2 = false;
        var h2 = Xe;
        e: do
          try {
            if (_e !== 0 && de !== null) {
              var y = de, R = Ht;
              switch (_e) {
                case 8:
                  bs(), h2 = 6;
                  break e;
                case 3:
                case 2:
                case 9:
                case 6:
                  Ft.current === null && (r2 = true);
                  var L = _e;
                  if (_e = 0, Ht = null, Qa(t2, y, R, L), a2 && ai) {
                    h2 = 0;
                    break e;
                  }
                  break;
                default:
                  L = _e, _e = 0, Ht = null, Qa(t2, y, R, L);
              }
            }
            qp(), h2 = Xe;
            break;
          } catch (j2) {
            $p(t2, j2);
          }
        while (true);
        return r2 && t2.shellSuspendCounter++, Be = at = null, ce = l2, M2.H = c2, M2.A = d, de === null && (Ne = null, he = 0, Bn()), h2;
      }
      function qp() {
        for (; de !== null; ) rc(de);
      }
      function Gp(t2, r2) {
        var a2 = ce;
        ce |= 2;
        var l2 = cf(), c2 = qi();
        Ne !== t2 || he !== r2 ? (Xc = null, ml = ze() + 500, la(t2, r2)) : ai = Pi(t2, r2);
        e: do
          try {
            if (_e !== 0 && de !== null) {
              r2 = de;
              var d = Ht;
              n: switch (_e) {
                case 1:
                  _e = 0, Ht = null, Qa(t2, r2, d, 1);
                  break;
                case 2:
                case 9:
                  if (Hd(d)) {
                    _e = 0, Ht = null, ff(r2);
                    break;
                  }
                  r2 = function() {
                    _e !== 2 && _e !== 9 || Ne !== t2 || (_e = 7), ir(t2);
                  }, d.then(r2, r2);
                  break e;
                case 3:
                  _e = 7;
                  break e;
                case 4:
                  _e = 5;
                  break e;
                case 7:
                  Hd(d) ? (_e = 0, Ht = null, ff(r2)) : (_e = 0, Ht = null, Qa(t2, r2, d, 7));
                  break;
                case 5:
                  var h2 = null;
                  switch (de.tag) {
                    case 26:
                      h2 = de.memoizedState;
                    case 5:
                    case 27:
                      var y = de, R = y.type, L = y.pendingProps;
                      if (h2 ? Tc(h2) : An(y.stateNode, R, L)) {
                        _e = 0, Ht = null;
                        var j2 = y.sibling;
                        if (j2 !== null) de = j2;
                        else {
                          var A = y.return;
                          A !== null ? (de = A, Mr(A)) : de = null;
                        }
                        break n;
                      }
                  }
                  _e = 0, Ht = null, Qa(t2, r2, d, 5);
                  break;
                case 6:
                  _e = 0, Ht = null, Qa(t2, r2, d, 6);
                  break;
                case 8:
                  bs(), Xe = 6;
                  break e;
                default:
                  throw Error(F(462));
              }
            }
            df();
            break;
          } catch (W2) {
            $p(t2, W2);
          }
        while (true);
        return Be = at = null, M2.H = l2, M2.A = c2, ce = a2, de !== null ? 0 : (Ne = null, he = 0, Bn(), Xe);
      }
      function df() {
        for (; de !== null && !qm(); ) rc(de);
      }
      function rc(t2) {
        var r2 = Bu(t2.alternate, t2, Uo);
        t2.memoizedProps = t2.pendingProps, r2 === null ? Mr(t2) : de = r2;
      }
      function ff(t2) {
        var r2 = t2, a2 = r2.alternate;
        switch (r2.tag) {
          case 15:
          case 0:
            r2 = Xd(a2, r2, r2.pendingProps, r2.type, void 0, he);
            break;
          case 11:
            r2 = Xd(a2, r2, r2.pendingProps, r2.type.render, r2.ref, he);
            break;
          case 5:
            Vl(r2);
          default:
            $u(a2, r2), r2 = de = yf(r2, Uo), r2 = Bu(a2, r2, Uo);
        }
        t2.memoizedProps = t2.pendingProps, r2 === null ? Mr(t2) : de = r2;
      }
      function Qa(t2, r2, a2, l2) {
        Be = at = null, Vl(r2), Kt = null, Bs = 0;
        var c2 = r2.return;
        try {
          if (On(t2, c2, r2, a2, he)) {
            Xe = 1, rs(t2, ut(a2, t2.current)), de = null;
            return;
          }
        } catch (d) {
          if (c2 !== null) throw de = c2, d;
          Xe = 1, rs(t2, ut(a2, t2.current)), de = null;
          return;
        }
        r2.flags & 32768 ? (ue || l2 === 1 ? t2 = true : ai || (he & 536870912) !== 0 ? t2 = false : (ya = t2 = true, (l2 === 2 || l2 === 9 || l2 === 3 || l2 === 6) && (l2 = Ft.current, l2 !== null && l2.tag === 13 && (l2.flags |= 16384))), vs(r2, t2)) : Mr(r2);
      }
      function Mr(t2) {
        var r2 = t2;
        do {
          if ((r2.flags & 32768) !== 0) {
            vs(r2, ya);
            return;
          }
          t2 = r2.return;
          var a2 = Oa(r2.alternate, r2, Uo);
          if (a2 !== null) {
            de = a2;
            return;
          }
          if (r2 = r2.sibling, r2 !== null) {
            de = r2;
            return;
          }
          de = r2 = t2;
        } while (r2 !== null);
        Xe === 0 && (Xe = 5);
      }
      function vs(t2, r2) {
        do {
          var a2 = gr(t2.alternate, t2);
          if (a2 !== null) {
            a2.flags &= 32767, de = a2;
            return;
          }
          if (a2 = t2.return, a2 !== null && (a2.flags |= 32768, a2.subtreeFlags = 0, a2.deletions = null), !r2 && (t2 = t2.sibling, t2 !== null)) {
            de = t2;
            return;
          }
          de = t2 = a2;
        } while (t2 !== null);
        Xe = 6, de = null;
      }
      function pf(t2, r2, a2, l2, c2, d, h2, y, R) {
        t2.cancelPendingCommit = null;
        do
          rn();
        while (Re !== 0);
        if ((ce & 6) !== 0) throw Error(F(327));
        if (r2 !== null) {
          if (r2 === t2.current) throw Error(F(177));
          if (d = r2.lanes | r2.childLanes, d |= $f, _p(t2, a2, d, h2, y, R), t2 === Ne && (de = Ne = null, he = 0), Sa = r2, Bo = t2, no = a2, Kc = d, ed = c2, $h = l2, (r2.subtreeFlags & 10256) !== 0 || (r2.flags & 10256) !== 0 ? (t2.callbackNode = null, t2.callbackPriority = 0, Nm(Ao, function() {
            return hf(), null;
          })) : (t2.callbackNode = null, t2.callbackPriority = 0), l2 = (r2.flags & 13878) !== 0, (r2.subtreeFlags & 13878) !== 0 || l2) {
            l2 = M2.T, M2.T = null, c2 = qr(), yn(2), h2 = ce, ce |= 4;
            try {
              Wp(t2, r2, a2);
            } finally {
              ce = h2, yn(c2), M2.T = l2;
            }
          }
          Re = 1, oc(), ac(), ic();
        }
      }
      function oc() {
        if (Re === 1) {
          Re = 0;
          var t2 = Bo, r2 = Sa, a2 = (r2.flags & 13878) !== 0;
          if ((r2.subtreeFlags & 13878) !== 0 || a2) {
            a2 = M2.T, M2.T = null;
            var l2 = qr();
            yn(2);
            var c2 = ce;
            ce |= 4;
            try {
              hs(r2, t2), _s(t2.containerInfo);
            } finally {
              ce = c2, yn(l2), M2.T = a2;
            }
          }
          t2.current = r2, Re = 2;
        }
      }
      function ac() {
        if (Re === 2) {
          Re = 0;
          var t2 = Bo, r2 = Sa, a2 = (r2.flags & 8772) !== 0;
          if ((r2.subtreeFlags & 8772) !== 0 || a2) {
            a2 = M2.T, M2.T = null;
            var l2 = qr();
            yn(2);
            var c2 = ce;
            ce |= 4;
            try {
              of(t2, r2.alternate, r2);
            } finally {
              ce = c2, yn(l2), M2.T = a2;
            }
          }
          Re = 3;
        }
      }
      function ic() {
        if (Re === 4 || Re === 3) {
          Re = 0, St();
          var t2 = Bo, r2 = Sa, a2 = no, l2 = $h;
          (r2.subtreeFlags & 10256) !== 0 || (r2.flags & 10256) !== 0 ? Re = 5 : (Re = 0, Sa = Bo = null, Jp(t2, t2.pendingLanes));
          var c2 = t2.pendingLanes;
          if (c2 === 0 && (va = null), Ze(a2), r2 = r2.stateNode, on && typeof on.onCommitFiberRoot == "function") try {
            on.onCommitFiberRoot(ei, r2, void 0, (r2.current.flags & 128) === 128);
          } catch {
          }
          if (l2 !== null) {
            r2 = M2.T, c2 = qr(), yn(2), M2.T = null;
            try {
              for (var d = t2.onRecoverableError, h2 = 0; h2 < l2.length; h2++) {
                var y = l2[h2];
                d(y.value, {
                  componentStack: y.stack
                });
              }
            } finally {
              M2.T = r2, yn(c2);
            }
          }
          (no & 3) !== 0 && rn(), ir(t2), c2 = t2.pendingLanes, (a2 & 261930) !== 0 && (c2 & 42) !== 0 ? t2 === nd ? gl++ : (gl = 0, nd = t2) : gl = 0, Hn && Ih(), Ea(0, false);
        }
      }
      function Jp(t2, r2) {
        (t2.pooledCacheLanes &= r2) === 0 && (r2 = t2.pooledCache, r2 != null && (t2.pooledCache = null, Ra(r2)));
      }
      function rn() {
        return oc(), ac(), ic(), hf();
      }
      function hf() {
        if (Re !== 5) return false;
        var t2 = Bo, r2 = Kc;
        Kc = 0;
        var a2 = Ze(no), l2 = 32 > a2 ? 32 : a2;
        a2 = M2.T;
        var c2 = qr();
        try {
          yn(l2), M2.T = null, l2 = ed, ed = null;
          var d = Bo, h2 = no;
          if (Re = 0, Sa = Bo = null, no = 0, (ce & 6) !== 0) throw Error(F(331));
          var y = ce;
          if (ce |= 4, Ku(d.current), Mp(d, d.current, h2, l2), ce = y, Ea(0, false), on && typeof on.onPostCommitFiberRoot == "function") try {
            on.onPostCommitFiberRoot(ei, d);
          } catch {
          }
          return true;
        } finally {
          yn(c2), M2.T = a2, Jp(t2, r2);
        }
      }
      function mf(t2, r2, a2) {
        r2 = ut(a2, r2), r2 = Ui(t2.stateNode, r2, 2), t2 = Nr(t2, r2, 2), t2 !== null && (xi(t2, 2), ir(t2));
      }
      function ve(t2, r2, a2) {
        if (t2.tag === 3) mf(t2, t2, a2);
        else for (; r2 !== null; ) {
          if (r2.tag === 3) {
            mf(r2, t2, a2);
            break;
          } else if (r2.tag === 1) {
            var l2 = r2.stateNode;
            if (typeof r2.type.getDerivedStateFromError == "function" || typeof l2.componentDidCatch == "function" && (va === null || !va.has(l2))) {
              t2 = ut(a2, t2), a2 = os(2), l2 = Nr(r2, a2, 2), l2 !== null && (Hu(a2, l2, r2, t2), xi(l2, 2), ir(l2));
              break;
            }
          }
          r2 = r2.return;
        }
      }
      function lc(t2, r2, a2) {
        var l2 = t2.pingCache;
        if (l2 === null) {
          l2 = t2.pingCache = new Ym();
          var c2 = /* @__PURE__ */ new Set();
          l2.set(r2, c2);
        } else c2 = l2.get(r2), c2 === void 0 && (c2 = /* @__PURE__ */ new Set(), l2.set(r2, c2));
        c2.has(a2) || (Gf = true, c2.add(a2), t2 = Ss.bind(null, t2, r2, a2), r2.then(t2, t2));
      }
      function Ss(t2, r2, a2) {
        var l2 = t2.pingCache;
        l2 !== null && l2.delete(r2), t2.pingedLanes |= t2.suspendedLanes & a2, t2.warmLanes &= ~a2, Ne === t2 && (he & a2) === a2 && (Xe === 4 || Xe === 3 && (he & 62914560) === he && 300 > ze() - Vs ? (ce & 2) === 0 && la(t2, 0) : Jf |= a2, hl === he && (hl = 0)), ir(t2);
      }
      function gf(t2, r2) {
        r2 === 0 && (r2 = Ed()), t2 = Ko(t2, r2), t2 !== null && (xi(t2, r2), ir(t2));
      }
      function sc(t2) {
        var r2 = t2.memoizedState, a2 = 0;
        r2 !== null && (a2 = r2.retryLane), gf(t2, a2);
      }
      function Zp(t2, r2) {
        var a2 = 0;
        switch (t2.tag) {
          case 31:
          case 13:
            var l2 = t2.stateNode, c2 = t2.memoizedState;
            c2 !== null && (a2 = c2.retryLane);
            break;
          case 19:
            l2 = t2.stateNode;
            break;
          case 22:
            l2 = t2.stateNode._retryCache;
            break;
          default:
            throw Error(F(314));
        }
        l2 !== null && l2.delete(r2), gf(t2, a2);
      }
      function Nm(t2, r2) {
        return Ic(t2, r2);
      }
      function uc(t2, r2, a2, l2) {
        this.tag = t2, this.key = a2, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = r2, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l2, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
      }
      function ks(t2) {
        return t2 = t2.prototype, !(!t2 || !t2.isReactComponent);
      }
      function Qr(t2, r2) {
        var a2 = t2.alternate;
        return a2 === null ? (a2 = Yn(t2.tag, r2, t2.key, t2.mode), a2.elementType = t2.elementType, a2.type = t2.type, a2.stateNode = t2.stateNode, a2.alternate = t2, t2.alternate = a2) : (a2.pendingProps = r2, a2.type = t2.type, a2.flags = 0, a2.subtreeFlags = 0, a2.deletions = null), a2.flags = t2.flags & 65011712, a2.childLanes = t2.childLanes, a2.lanes = t2.lanes, a2.child = t2.child, a2.memoizedProps = t2.memoizedProps, a2.memoizedState = t2.memoizedState, a2.updateQueue = t2.updateQueue, r2 = t2.dependencies, a2.dependencies = r2 === null ? null : {
          lanes: r2.lanes,
          firstContext: r2.firstContext
        }, a2.sibling = t2.sibling, a2.index = t2.index, a2.ref = t2.ref, a2.refCleanup = t2.refCleanup, a2;
      }
      function yf(t2, r2) {
        t2.flags &= 65011714;
        var a2 = t2.alternate;
        return a2 === null ? (t2.childLanes = 0, t2.lanes = r2, t2.child = null, t2.subtreeFlags = 0, t2.memoizedProps = null, t2.memoizedState = null, t2.updateQueue = null, t2.dependencies = null, t2.stateNode = null) : (t2.childLanes = a2.childLanes, t2.lanes = a2.lanes, t2.child = a2.child, t2.subtreeFlags = 0, t2.deletions = null, t2.memoizedProps = a2.memoizedProps, t2.memoizedState = a2.memoizedState, t2.updateQueue = a2.updateQueue, t2.type = a2.type, r2 = a2.dependencies, t2.dependencies = r2 === null ? null : {
          lanes: r2.lanes,
          firstContext: r2.firstContext
        }), t2;
      }
      function ws(t2, r2, a2, l2, c2, d) {
        var h2 = 0;
        if (l2 = t2, typeof t2 == "function") ks(t2) && (h2 = 1);
        else if (typeof t2 == "string") h2 = Gt && dn ? Df(t2, a2, Dn.current) ? 26 : Ec(t2) ? 27 : 5 : Gt ? Df(t2, a2, Dn.current) ? 26 : 5 : dn && Ec(t2) ? 27 : 5;
        else e: switch (t2) {
          case gc:
            return t2 = Yn(31, a2, r2, c2), t2.elementType = gc, t2.lanes = d, t2;
          case $a:
            return Eo(a2.children, c2, d, r2);
          case kf:
            h2 = 8, c2 |= 24;
            break;
          case Cs:
            return t2 = Yn(12, a2, r2, c2 | 2), t2.elementType = Cs, t2.lanes = d, t2;
          case Va:
            return t2 = Yn(13, a2, r2, c2), t2.elementType = Va, t2.lanes = d, t2;
          case Te:
            return t2 = Yn(19, a2, r2, c2), t2.elementType = Te, t2.lanes = d, t2;
          default:
            if (typeof t2 == "object" && t2 !== null) switch (t2.$$typeof) {
              case Io:
                h2 = 10;
                break e;
              case mc:
                h2 = 9;
                break e;
              case Zi:
                h2 = 11;
                break e;
              case wf:
                h2 = 14;
                break e;
              case ua:
                h2 = 16, l2 = null;
                break e;
            }
            h2 = 29, a2 = Error(F(130, t2 === null ? "null" : typeof t2, "")), l2 = null;
        }
        return r2 = Yn(h2, a2, r2, c2), r2.elementType = t2, r2.type = l2, r2.lanes = d, r2;
      }
      function Eo(t2, r2, a2, l2) {
        return t2 = Yn(7, t2, l2, r2), t2.lanes = a2, t2;
      }
      function Ps(t2, r2, a2) {
        return t2 = Yn(6, t2, null, r2), t2.lanes = a2, t2;
      }
      function cc(t2) {
        var r2 = Yn(18, null, null, 0);
        return r2.stateNode = t2, r2;
      }
      function dc(t2, r2, a2) {
        return r2 = Yn(4, t2.children !== null ? t2.children : [], t2.key, r2), r2.lanes = a2, r2.stateNode = {
          containerInfo: t2.containerInfo,
          pendingChildren: null,
          implementation: t2.implementation
        }, r2;
      }
      function bf(t2, r2, a2, l2, c2, d, h2, y, R) {
        this.tag = 1, this.containerInfo = t2, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = Lo, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = mu(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = mu(0), this.hiddenUpdates = mu(null), this.identifierPrefix = l2, this.onUncaughtError = c2, this.onCaughtError = d, this.onRecoverableError = h2, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = R, this.incompleteTransitions = /* @__PURE__ */ new Map();
      }
      function xs(t2, r2, a2, l2, c2, d, h2, y, R, L, j2, A) {
        return t2 = new bf(t2, r2, a2, h2, R, L, j2, A, y), r2 = 1, d === true && (r2 |= 24), d = Yn(3, null, null, r2), t2.current = d, d.stateNode = t2, r2 = Fd(), r2.refCount++, t2.pooledCache = r2, r2.refCount++, d.memoizedState = {
          element: l2,
          isDehydrated: a2,
          cache: r2
        }, Ol(d), t2;
      }
      function fc(t2) {
        return t2 ? (t2 = Ka, t2) : Ka;
      }
      function vf(t2) {
        var r2 = t2._reactInternals;
        if (r2 === void 0) throw typeof t2.render == "function" ? Error(F(188)) : (t2 = Object.keys(t2).join(","), Error(F(268, t2)));
        return t2 = fu(r2), t2 = t2 !== null ? pu(t2) : null, t2 === null ? null : Ts(t2.stateNode);
      }
      function pc(t2, r2, a2, l2, c2, d) {
        c2 = fc(c2), l2.context === null ? l2.context = c2 : l2.pendingContext = c2, l2 = Et(r2), l2.payload = {
          element: a2
        }, d = d === void 0 ? null : d, d !== null && (l2.callback = d), a2 = Nr(t2, l2, r2), a2 !== null && (nt(a2, t2, r2), Ml(a2, t2, r2));
      }
      function Sf(t2, r2) {
        if (t2 = t2.memoizedState, t2 !== null && t2.dehydrated !== null) {
          var a2 = t2.retryLane;
          t2.retryLane = a2 !== 0 && a2 < r2 ? a2 : r2;
        }
      }
      function vr(t2, r2) {
        Sf(t2, r2), (t2 = t2.alternate) && Sf(t2, r2);
      }
      var ie = {}, Fm = React__default, tt = import_scheduler.default, Lt = Object.assign, hc = Symbol.for("react.element"), zs = Symbol.for("react.transitional.element"), sa = Symbol.for("react.portal"), $a = Symbol.for("react.fragment"), kf = Symbol.for("react.strict_mode"), Cs = Symbol.for("react.profiler"), mc = Symbol.for("react.consumer"), Io = Symbol.for("react.context"), Zi = Symbol.for("react.forward_ref"), Va = Symbol.for("react.suspense"), Te = Symbol.for("react.suspense_list"), wf = Symbol.for("react.memo"), ua = Symbol.for("react.lazy");
      var gc = Symbol.for("react.activity");
      var $r = Symbol.for("react.memo_cache_sentinel");
      var Pf = Symbol.iterator, xf = Symbol.for("react.client.reference"), ca = Array.isArray, M2 = Fm.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Yp = m2.rendererVersion, zf = m2.rendererPackageName, Cf = m2.extraDevToolsConfig, Ts = m2.getPublicInstance, Hm = m2.getRootHostContext, Xp = m2.getChildHostContext, Am = m2.prepareForCommit, _s = m2.resetAfterCommit, Vr = m2.createInstance;
      m2.cloneMutableInstance;
      var yc = m2.appendInitialChild, Kp = m2.finalizeInitialChildren, Rs = m2.shouldSetTextContent, bc = m2.createTextInstance;
      m2.cloneMutableTextInstance;
      var eh = m2.scheduleTimeout, Tf = m2.cancelTimeout, Lo = m2.noTimeout, qt = m2.isPrimaryRenderer;
      m2.warnsIfNotActing;
      var $n = m2.supportsMutation, Sr = m2.supportsPersistence, Hn = m2.supportsHydration, nh = m2.getInstanceFromNode;
      m2.beforeActiveInstanceBlur;
      var jm = m2.preparePortalMount;
      m2.prepareScopeUpdate, m2.getInstanceFromScope;
      var yn = m2.setCurrentUpdatePriority, qr = m2.getCurrentUpdatePriority, kr = m2.resolveUpdatePriority;
      m2.trackSchedulerEvent, m2.resolveEventType, m2.resolveEventTimeStamp;
      var _f = m2.shouldAttemptEagerTransition, th = m2.detachDeletedInstance;
      m2.requestPostPaintCallback;
      var rh = m2.maySuspendCommit, Dm = m2.maySuspendCommitOnUpdate, Yi = m2.maySuspendCommitInSyncRender, An = m2.preloadInstance, oh = m2.startSuspendingCommit, Vn = m2.suspendInstance;
      m2.suspendOnActiveViewTransition;
      var ah = m2.waitForCommitToBeReady;
      m2.getSuspendedCommitReason;
      var rt = m2.NotPendingTransition, da = m2.HostTransitionContext, qa = m2.resetFormInstance;
      m2.bindToConsole;
      var ih = m2.supportsMicrotasks, Gr = m2.scheduleMicrotask, Ga = m2.supportsTestSelectors, Rf = m2.findFiberRoot, wr = m2.getBoundingRect, lh = m2.getTextContent, Jr = m2.isHiddenSubtree, sh = m2.matchAccessibilityRole, Es = m2.setFocusIfFocusable, Ja = m2.setupIntersectionObserver, uh = m2.appendChild, ch = m2.appendChildToContainer, Is = m2.commitTextUpdate, dh = m2.commitMount, vc = m2.commitUpdate, fh = m2.insertBefore, ph = m2.insertInContainerBefore, Ef = m2.removeChild, If = m2.removeChildFromContainer, Sc = m2.resetTextContent, hh = m2.hideInstance, kc = m2.hideTextInstance, Wm = m2.unhideInstance, mh = m2.unhideTextInstance;
      m2.cancelViewTransitionName, m2.cancelRootViewTransitionName, m2.restoreRootViewTransitionName, m2.cloneRootViewTransitionContainer, m2.removeRootViewTransitionClone, m2.measureClonedInstance, m2.hasInstanceChanged, m2.hasInstanceAffectedParent, m2.startViewTransition, m2.startGestureTransition, m2.stopViewTransition, m2.getCurrentGestureOffset, m2.createViewTransitionInstance;
      var Nt = m2.clearContainer;
      m2.createFragmentInstance, m2.updateFragmentInstanceFiber, m2.commitNewChildToFragmentInstance, m2.deleteChildFromFragmentInstance;
      var gh = m2.cloneInstance, We = m2.createContainerChildSet, Lf = m2.appendChildToContainerChildSet, yh = m2.finalizeContainerChildren, bh = m2.replaceContainerChildren, No = m2.cloneHiddenInstance, Ls = m2.cloneHiddenTextInstance, Ns = m2.isSuspenseInstancePending, Fs = m2.isSuspenseInstanceFallback, Za = m2.getSuspenseInstanceFallbackErrorDetails, Xi = m2.registerSuspenseInstanceRetry, vh = m2.canHydrateFormStateMarker, Sh = m2.isFormStateMarkerMatching, Nf = m2.getNextHydratableSibling, kh = m2.getNextHydratableSiblingAfterSingleton, wc = m2.getFirstHydratableChild, Pc = m2.getFirstHydratableChildWithinContainer, Ff = m2.getFirstHydratableChildWithinActivityInstance, wh = m2.getFirstHydratableChildWithinSuspenseInstance, Um = m2.getFirstHydratableChildWithinSingleton, Bm = m2.canHydrateInstance, Ph = m2.canHydrateTextInstance, xh = m2.canHydrateActivityInstance, Om = m2.canHydrateSuspenseInstance, Ki = m2.hydrateInstance, xc = m2.hydrateTextInstance, zh = m2.hydrateActivityInstance, Hf = m2.hydrateSuspenseInstance, Ch = m2.getNextHydratableInstanceAfterActivityInstance, Th = m2.getNextHydratableInstanceAfterSuspenseInstance, _h = m2.commitHydratedInstance, Mm = m2.commitHydratedContainer, Rh = m2.commitHydratedActivityInstance, el = m2.commitHydratedSuspenseInstance, Eh = m2.finalizeHydratedChildren, Ih = m2.flushHydrationEvents;
      m2.clearActivityBoundary;
      var Se = m2.clearSuspenseBoundary;
      m2.clearActivityBoundaryFromContainer;
      var Af = m2.clearSuspenseBoundaryFromContainer, Qm = m2.hideDehydratedBoundary, Lh = m2.unhideDehydratedBoundary, Nh = m2.shouldDeleteUnhydratedTailInstances;
      m2.diffHydratedPropsForDevWarnings, m2.diffHydratedTextForDevWarnings, m2.describeHydratableInstanceForDevWarnings;
      var $m = m2.validateHydratableInstance, jf = m2.validateHydratableTextInstance, Gt = m2.supportsResources, Df = m2.isHostHoistableType, zc = m2.getHoistableRoot, nl = m2.getResource, Fh = m2.acquireResource, Hh = m2.releaseResource, Ya = m2.hydrateHoistable, Cc = m2.mountHoistable, Wf = m2.unmountHoistable, Ah = m2.createHoistableInstance, jh = m2.prepareToCommitHoistables, Vm = m2.mayResourceSuspendCommit, Tc = m2.preloadResource, Fo = m2.suspendResource, dn = m2.supportsSingletons, _c = m2.resolveSingletonInstance, Rc = m2.acquireSingletonInstance, fa = m2.releaseSingletonInstance, Ec = m2.isHostSingletonType, Xa = m2.isSingletonScope, Hs = [], tl = -1, Ka = {}, vt = Math.clz32 ? Math.clz32 : Em, Dh = Math.log, Wh = Math.LN2, As = 256, js = 262144, rl = 4194304, Ic = tt.unstable_scheduleCallback, le = tt.unstable_cancelCallback, qm = tt.unstable_shouldYield, St = tt.unstable_requestPaint, ze = tt.unstable_now, Uh = tt.unstable_ImmediatePriority, Ho = tt.unstable_UserBlockingPriority, Ao = tt.unstable_NormalPriority, ol = tt.unstable_IdlePriority, Lc = tt.log, Uf = tt.unstable_setDisableYieldValue, ei = null, on = null, jn = typeof Object.is == "function" ? Object.is : Im, Nc = typeof reportError == "function" ? reportError : function(t2) {
        if (typeof window == "object" && typeof window.ErrorEvent == "function") {
          var r2 = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: typeof t2 == "object" && t2 !== null && typeof t2.message == "string" ? String(t2.message) : String(t2),
            error: t2
          });
          if (!window.dispatchEvent(r2)) return;
        } else if (typeof process == "object" && typeof process.emit == "function") {
          process.emit("uncaughtException", t2);
          return;
        }
        console.error(t2);
      }, Bf = Object.prototype.hasOwnProperty, al, kt, Ds = false, Bh = /* @__PURE__ */ new WeakMap(), ni = [], il = 0, fn = null, x2 = 0, Jt = [], Zt = 0, jo = null, ot = 1, Zr = "", Dn = Ir(null), Ws = Ir(null), pa = Ir(null), Fc = Ir(null), bn = null, Ue = null, ue = false, Do = null, Yt = false, Of = Error(F(519)), Yr = Ir(null), at = null, Be = null, Xr = typeof AbortController < "u" ? AbortController : function() {
        var t2 = [], r2 = this.signal = {
          aborted: false,
          addEventListener: function(a2, l2) {
            t2.push(l2);
          }
        };
        this.abort = function() {
          r2.aborted = true, t2.forEach(function(a2) {
            return a2();
          });
        };
      }, qn = tt.unstable_scheduleCallback, Gm = tt.unstable_NormalPriority, qe = {
        $$typeof: Io,
        Consumer: null,
        Provider: null,
        _currentValue: null,
        _currentValue2: null,
        _threadCount: 0
      }, an = null, wt = null, Mf = false, ll = false, ti = false, Pr = 0, Us = null, Qf = 0, sl = 0, ul = null, Hc = M2.S;
      M2.S = function(t2, r2) {
        Zf = ze(), typeof r2 == "object" && r2 !== null && typeof r2.then == "function" && Np(t2, r2), Hc !== null && Hc(t2, r2);
      };
      var ha = Ir(null), cl = Error(F(460)), Ac = Error(F(474)), jc = Error(F(542)), Dc = {
        then: function() {
        }
      }, Xt = null, Kt = null, Bs = 0, ri = Ad(true), Oh = Ad(false), er = [], xr = 0, $f = 0, ma = false, Vf = false, Kr = Ir(null), Wc = Ir(0), Ft = Ir(null), zr = null, ln = Ir(0), Wo = 0, ne = null, Ie = null, pn = null, Uc = false, dl = false, oi = false, Bc = 0, fl = 0, pl = null, Jm = 0, Os = {
        readContext: In,
        use: Ee,
        useCallback: Ve,
        useContext: Ve,
        useEffect: Ve,
        useImperativeHandle: Ve,
        useLayoutEffect: Ve,
        useInsertionEffect: Ve,
        useMemo: Ve,
        useReducer: Ve,
        useRef: Ve,
        useState: Ve,
        useDebugValue: Ve,
        useDeferredValue: Ve,
        useTransition: Ve,
        useSyncExternalStore: Ve,
        useId: Ve,
        useHostTransitionStatus: Ve,
        useFormState: Ve,
        useActionState: Ve,
        useOptimistic: Ve,
        useMemoCache: Ve,
        useCacheRefresh: Ve
      };
      Os.useEffectEvent = Ve;
      var Mh = {
        readContext: In,
        use: Ee,
        useCallback: function(t2, r2) {
          return Ln().memoizedState = [t2, r2 === void 0 ? null : r2], t2;
        },
        useContext: In,
        useEffect: Bd,
        useImperativeHandle: function(t2, r2, a2) {
          a2 = a2 != null ? a2.concat([t2]) : null, Xl(4194308, 4, jp.bind(null, r2, t2), a2);
        },
        useLayoutEffect: function(t2, r2) {
          return Xl(4194308, 4, t2, r2);
        },
        useInsertionEffect: function(t2, r2) {
          Xl(4, 2, t2, r2);
        },
        useMemo: function(t2, r2) {
          var a2 = Ln();
          r2 = r2 === void 0 ? null : r2;
          var l2 = t2();
          if (oi) {
            pe(true);
            try {
              t2();
            } finally {
              pe(false);
            }
          }
          return a2.memoizedState = [l2, r2], l2;
        },
        useReducer: function(t2, r2, a2) {
          var l2 = Ln();
          if (a2 !== void 0) {
            var c2 = a2(r2);
            if (oi) {
              pe(true);
              try {
                a2(r2);
              } finally {
                pe(false);
              }
            }
          } else c2 = r2;
          return l2.memoizedState = l2.baseState = c2, t2 = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: t2,
            lastRenderedState: c2
          }, l2.queue = t2, t2 = t2.dispatch = Nn.bind(null, ne, t2), [l2.memoizedState, t2];
        },
        useRef: function(t2) {
          var r2 = Ln();
          return t2 = {
            current: t2
          }, r2.memoizedState = t2;
        },
        useState: function(t2) {
          t2 = Xn(t2);
          var r2 = t2.queue, a2 = Nu.bind(null, ne, r2);
          return r2.dispatch = a2, [t2.memoizedState, a2];
        },
        useDebugValue: Qd,
        useDeferredValue: function(t2, r2) {
          var a2 = Ln();
          return Iu(a2, t2, r2);
        },
        useTransition: function() {
          var t2 = Xn(false);
          return t2 = $d.bind(null, ne, t2.queue, true, false), Ln().memoizedState = t2, [false, t2];
        },
        useSyncExternalStore: function(t2, r2, a2) {
          var l2 = ne, c2 = Ln();
          if (ue) {
            if (a2 === void 0) throw Error(F(407));
            a2 = a2();
          } else {
            if (a2 = r2(), Ne === null) throw Error(F(349));
            (he & 127) !== 0 || Hp(l2, r2, a2);
          }
          c2.memoizedState = a2;
          var d = {
            value: a2,
            getSnapshot: r2
          };
          return c2.queue = d, Bd(ql.bind(null, l2, d, t2), [t2]), l2.flags |= 2048, Kn(9, {
            destroy: void 0
          }, jr.bind(null, l2, d, a2, r2), null), a2;
        },
        useId: function() {
          var t2 = Ln(), r2 = Ne.identifierPrefix;
          if (ue) {
            var a2 = Zr, l2 = ot;
            a2 = (l2 & ~(1 << 32 - vt(l2) - 1)).toString(32) + a2, r2 = "_" + r2 + "R_" + a2, a2 = Bc++, 0 < a2 && (r2 += "H" + a2.toString(32)), r2 += "_";
          } else a2 = Jm++, r2 = "_" + r2 + "r_" + a2.toString(32) + "_";
          return t2.memoizedState = r2;
        },
        useHostTransitionStatus: Lu,
        useFormState: pr,
        useActionState: pr,
        useOptimistic: function(t2) {
          var r2 = Ln();
          r2.memoizedState = r2.baseState = t2;
          var a2 = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: null,
            lastRenderedState: null
          };
          return r2.queue = a2, r2 = Wi.bind(null, ne, true, a2), a2.dispatch = r2, [t2, r2];
        },
        useMemoCache: Hi,
        useCacheRefresh: function() {
          return Ln().memoizedState = Dp.bind(null, ne);
        },
        useEffectEvent: function(t2) {
          var r2 = Ln(), a2 = {
            impl: t2
          };
          return r2.memoizedState = a2, function() {
            if ((ce & 2) !== 0) throw Error(F(440));
            return a2.impl.apply(void 0, arguments);
          };
        }
      }, qf = {
        readContext: In,
        use: Ee,
        useCallback: Eu,
        useContext: In,
        useEffect: Tu,
        useImperativeHandle: Md,
        useInsertionEffect: Od,
        useLayoutEffect: Ru,
        useMemo: Kl,
        useReducer: Ai,
        useRef: Wa,
        useState: function() {
          return Ai(Ar);
        },
        useDebugValue: Qd,
        useDeferredValue: function(t2, r2) {
          var a2 = He();
          return es(a2, Ie.memoizedState, t2, r2);
        },
        useTransition: function() {
          var t2 = Ai(Ar)[0], r2 = He().memoizedState;
          return [typeof t2 == "boolean" ? t2 : sr(t2), r2];
        },
        useSyncExternalStore: ur,
        useId: xo,
        useHostTransitionStatus: Lu,
        useFormState: Ud,
        useActionState: Ud,
        useOptimistic: function(t2, r2) {
          var a2 = He();
          return mt(a2, Ie, t2, r2);
        },
        useMemoCache: Hi,
        useCacheRefresh: qd
      };
      qf.useEffectEvent = _u;
      var Qh = {
        readContext: In,
        use: Ee,
        useCallback: Eu,
        useContext: In,
        useEffect: Tu,
        useImperativeHandle: Md,
        useInsertionEffect: Od,
        useLayoutEffect: Ru,
        useMemo: Kl,
        useReducer: Da,
        useRef: Wa,
        useState: function() {
          return Da(Ar);
        },
        useDebugValue: Qd,
        useDeferredValue: function(t2, r2) {
          var a2 = He();
          return Ie === null ? Iu(a2, t2, r2) : es(a2, Ie.memoizedState, t2, r2);
        },
        useTransition: function() {
          var t2 = Da(Ar)[0], r2 = He().memoizedState;
          return [typeof t2 == "boolean" ? t2 : sr(t2), r2];
        },
        useSyncExternalStore: ur,
        useId: xo,
        useHostTransitionStatus: Lu,
        useFormState: Yl,
        useActionState: Yl,
        useOptimistic: function(t2, r2) {
          var a2 = He();
          return Ie !== null ? mt(a2, Ie, t2, r2) : (a2.baseState = t2, [t2, a2.queue.dispatch]);
        },
        useMemoCache: Hi,
        useCacheRefresh: qd
      };
      Qh.useEffectEvent = _u;
      var Oc = {
        enqueueSetState: function(t2, r2, a2) {
          t2 = t2._reactInternals;
          var l2 = bt(), c2 = Et(l2);
          c2.payload = r2, a2 != null && (c2.callback = a2), r2 = Nr(t2, c2, l2), r2 !== null && (nt(r2, t2, l2), Ml(r2, t2, l2));
        },
        enqueueReplaceState: function(t2, r2, a2) {
          t2 = t2._reactInternals;
          var l2 = bt(), c2 = Et(l2);
          c2.tag = 1, c2.payload = r2, a2 != null && (c2.callback = a2), r2 = Nr(t2, c2, l2), r2 !== null && (nt(r2, t2, l2), Ml(r2, t2, l2));
        },
        enqueueForceUpdate: function(t2, r2) {
          t2 = t2._reactInternals;
          var a2 = bt(), l2 = Et(a2);
          l2.tag = 2, r2 != null && (l2.callback = r2), r2 = Nr(t2, l2, a2), r2 !== null && (nt(r2, t2, a2), Ml(r2, t2, a2));
        }
      }, Mc = Error(F(461)), hn = false, Qc = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0,
        hydrationErrors: null
      }, eo = false, sn = false, Ms = false, $c = typeof WeakSet == "function" ? WeakSet : Set, Pn = null, mn = null, Pt = false, Cr = null, ga = 8192, Zm = {
        getCacheForType: function(t2) {
          var r2 = In(qe), a2 = r2.data.get(t2);
          return a2 === void 0 && (a2 = t2(), r2.data.set(t2, a2)), a2;
        },
        cacheSignal: function() {
          return In(qe).controller.signal;
        }
      }, Vc = 0, qc = 1, Gc = 2, Jc = 3, Zc = 4;
      if (typeof Symbol == "function" && Symbol.for) {
        var Qs = Symbol.for;
        Vc = Qs("selector.component"), qc = Qs("selector.has_pseudo_class"), Gc = Qs("selector.role"), Jc = Qs("selector.test_id"), Zc = Qs("selector.text");
      }
      var Ym = typeof WeakMap == "function" ? WeakMap : Map, ce = 0, Ne = null, de = null, he = 0, _e = 0, Ht = null, ya = false, ai = false, Gf = false, Uo = 0, Xe = 0, ba = 0, ii = 0, Jf = 0, At = 0, hl = 0, $s = null, xt = null, Yc = false, Vs = 0, Zf = 0, ml = 1 / 0, Xc = null, va = null, Re = 0, Bo = null, Sa = null, no = 0, Kc = 0, ed = null, $h = null, gl = 0, nd = null;
      return ie.attemptContinuousHydration = function(t2) {
        if (t2.tag === 13 || t2.tag === 31) {
          var r2 = Ko(t2, 67108864);
          r2 !== null && nt(r2, t2, 67108864), vr(t2, 67108864);
        }
      }, ie.attemptHydrationAtCurrentPriority = function(t2) {
        if (t2.tag === 13 || t2.tag === 31) {
          var r2 = bt();
          r2 = st(r2);
          var a2 = Ko(t2, r2);
          a2 !== null && nt(a2, t2, r2), vr(t2, r2);
        }
      }, ie.attemptSynchronousHydration = function(t2) {
        switch (t2.tag) {
          case 3:
            if (t2 = t2.stateNode, t2.current.memoizedState.isDehydrated) {
              var r2 = Zo(t2.pendingLanes);
              if (r2 !== 0) {
                for (t2.pendingLanes |= 2, t2.entangledLanes |= 2; r2; ) {
                  var a2 = 1 << 31 - vt(r2);
                  t2.entanglements[1] |= a2, r2 &= ~a2;
                }
                ir(t2), (ce & 6) === 0 && (ml = ze() + 500, Ea(0, false));
              }
            }
            break;
          case 31:
          case 13:
            r2 = Ko(t2, 2), r2 !== null && nt(r2, t2, 2), ia(), vr(t2, 2);
        }
      }, ie.batchedUpdates = function(t2, r2) {
        return t2(r2);
      }, ie.createComponentSelector = function(t2) {
        return {
          $$typeof: Vc,
          value: t2
        };
      }, ie.createContainer = function(t2, r2, a2, l2, c2, d, h2, y, R, L) {
        return xs(t2, r2, false, null, a2, l2, d, null, h2, y, R, L);
      }, ie.createHasPseudoClassSelector = function(t2) {
        return {
          $$typeof: qc,
          value: t2
        };
      }, ie.createHydrationContainer = function(t2, r2, a2, l2, c2, d, h2, y, R, L, j2, A, W2, V) {
        var _r2;
        return t2 = xs(a2, l2, true, t2, c2, d, y, V, R, L, j2, A), t2.context = fc(null), a2 = t2.current, l2 = bt(), l2 = st(l2), c2 = Et(l2), c2.callback = (_r2 = r2) != null ? _r2 : null, Nr(a2, c2, l2), r2 = l2, t2.current.lanes = r2, xi(t2, r2), ir(t2), t2;
      }, ie.createPortal = function(t2, r2, a2) {
        var l2 = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
          $$typeof: sa,
          key: l2 == null ? null : "" + l2,
          children: t2,
          containerInfo: r2,
          implementation: a2
        };
      }, ie.createRoleSelector = function(t2) {
        return {
          $$typeof: Gc,
          value: t2
        };
      }, ie.createTestNameSelector = function(t2) {
        return {
          $$typeof: Jc,
          value: t2
        };
      }, ie.createTextSelector = function(t2) {
        return {
          $$typeof: Zc,
          value: t2
        };
      }, ie.defaultOnCaughtError = function(t2) {
        console.error(t2);
      }, ie.defaultOnRecoverableError = function(t2) {
        Nc(t2);
      }, ie.defaultOnUncaughtError = function(t2) {
        Nc(t2);
      }, ie.deferredUpdates = function(t2) {
        var r2 = M2.T, a2 = qr();
        try {
          return yn(32), M2.T = null, t2();
        } finally {
          yn(a2), M2.T = r2;
        }
      }, ie.discreteUpdates = function(t2, r2, a2, l2, c2) {
        var d = M2.T, h2 = qr();
        try {
          return yn(2), M2.T = null, t2(r2, a2, l2, c2);
        } finally {
          yn(h2), M2.T = d, ce === 0 && (ml = ze() + 500);
        }
      }, ie.findAllNodes = gs, ie.findBoundingRects = function(t2, r2) {
        if (!Ga) throw Error(F(363));
        r2 = gs(t2, r2), t2 = [];
        for (var a2 = 0; a2 < r2.length; a2++) t2.push(wr(r2[a2]));
        for (r2 = t2.length - 1; 0 < r2; r2--) {
          a2 = t2[r2];
          for (var l2 = a2.x, c2 = l2 + a2.width, d = a2.y, h2 = d + a2.height, y = r2 - 1; 0 <= y; y--) if (r2 !== y) {
            var R = t2[y], L = R.x, j2 = L + R.width, A = R.y, W2 = A + R.height;
            if (l2 >= L && d >= A && c2 <= j2 && h2 <= W2) {
              t2.splice(r2, 1);
              break;
            } else if (l2 !== L || a2.width !== R.width || W2 < d || A > h2) {
              if (!(d !== A || a2.height !== R.height || j2 < l2 || L > c2)) {
                L > l2 && (R.width += L - l2, R.x = l2), j2 < c2 && (R.width = c2 - L), t2.splice(r2, 1);
                break;
              }
            } else {
              A > d && (R.height += A - d, R.y = d), W2 < h2 && (R.height = h2 - A), t2.splice(r2, 1);
              break;
            }
          }
        }
        return t2;
      }, ie.findHostInstance = vf, ie.findHostInstanceWithNoPortals = function(t2) {
        return t2 = fu(t2), t2 = t2 !== null ? lt(t2) : null, t2 === null ? null : Ts(t2.stateNode);
      }, ie.findHostInstanceWithWarning = function(t2) {
        return vf(t2);
      }, ie.flushPassiveEffects = rn, ie.flushSyncFromReconciler = function(t2) {
        var r2 = ce;
        ce |= 1;
        var a2 = M2.T, l2 = qr();
        try {
          if (yn(2), M2.T = null, t2) return t2();
        } finally {
          yn(l2), M2.T = a2, ce = r2, (ce & 6) === 0 && Ea(0, false);
        }
      }, ie.flushSyncWork = ia, ie.focusWithin = function(t2, r2) {
        if (!Ga) throw Error(F(363));
        for (t2 = Vi(t2), r2 = sf(t2, r2), r2 = Array.from(r2), t2 = 0; t2 < r2.length; ) {
          var a2 = r2[t2++], l2 = a2.tag;
          if (!Jr(a2)) {
            if ((l2 === 5 || l2 === 26 || l2 === 27) && Es(a2.stateNode)) return true;
            for (a2 = a2.child; a2 !== null; ) r2.push(a2), a2 = a2.sibling;
          }
        }
        return false;
      }, ie.getFindAllNodesFailureDescription = function(t2, r2) {
        if (!Ga) throw Error(F(363));
        var a2 = 0, l2 = [];
        t2 = [Vi(t2), 0];
        for (var c2 = 0; c2 < t2.length; ) {
          var d = t2[c2++], h2 = d.tag, y = t2[c2++], R = r2[y];
          if ((h2 !== 5 && h2 !== 26 && h2 !== 27 || !Jr(d)) && (ms(d, R) && (l2.push(nc(R)), y++, y > a2 && (a2 = y)), y < r2.length)) for (d = d.child; d !== null; ) t2.push(d, y), d = d.sibling;
        }
        if (a2 < r2.length) {
          for (t2 = []; a2 < r2.length; a2++) t2.push(nc(r2[a2]));
          return `findAllNodes was able to match part of the selector:
  ` + (l2.join(" > ") + `

No matching component was found for:
  `) + t2.join(" > ");
        }
        return null;
      }, ie.getPublicRootInstance = function(t2) {
        if (t2 = t2.current, !t2.child) return null;
        switch (t2.child.tag) {
          case 27:
          case 5:
            return Ts(t2.child.stateNode);
          default:
            return t2.child.stateNode;
        }
      }, ie.injectIntoDevTools = function() {
        var t2 = {
          bundleType: 0,
          version: Yp,
          rendererPackageName: zf,
          currentDispatcherRef: M2,
          reconcilerVersion: "19.2.0"
        };
        if (Cf !== null && (t2.rendererConfig = Cf), typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u") t2 = false;
        else {
          var r2 = __REACT_DEVTOOLS_GLOBAL_HOOK__;
          if (r2.isDisabled || !r2.supportsFiber) t2 = true;
          else {
            try {
              ei = r2.inject(t2), on = r2;
            } catch {
            }
            t2 = !!r2.checkDCE;
          }
        }
        return t2;
      }, ie.isAlreadyRendering = function() {
        return (ce & 6) !== 0;
      }, ie.observeVisibleRects = function(t2, r2, a2, l2) {
        if (!Ga) throw Error(F(363));
        t2 = gs(t2, r2);
        var c2 = Ja(t2, a2, l2).disconnect;
        return {
          disconnect: function() {
            c2();
          }
        };
      }, ie.shouldError = function() {
        return null;
      }, ie.shouldSuspend = function() {
        return false;
      }, ie.startHostTransition = function(t2, r2, a2, l2) {
        if (t2.tag !== 5) throw Error(F(476));
        var c2 = Vd(t2).queue;
        $d(t2, c2, r2, rt, a2 === null ? _d : function() {
          var d = Vd(t2);
          return d.next === null && (d = t2.alternate.memoizedState), ea(t2, d.next.queue, {}, bt()), a2(l2);
        });
      }, ie.updateContainer = function(t2, r2, a2, l2) {
        var c2 = r2.current, d = bt();
        return pc(c2, d, t2, r2, a2, l2), d;
      }, ie.updateContainerSync = function(t2, r2, a2, l2) {
        return pc(r2.current, 2, t2, r2, a2, l2), 2;
      }, ie;
    }, Tt.exports.default = Tt.exports, Object.defineProperty(Tt.exports, "__esModule", {
      value: true
    });
  }(Og)), Og.exports;
}
var Mg = {
  exports: {}
};
Mg.exports;
var Eb;
function n0() {
  return Eb || (Eb = 1, true ? Rm.exports = Kb() : Rm.exports = e0()), Rm.exports;
}
var t0 = n0();
var r0 = Xb(t0);
function createReconciler(config) {
  const reconciler2 = r0(config);
  reconciler2.injectIntoDevTools();
  return reconciler2;
}
var NoEventPriority = 0;
var catalogue = {};
var PREFIX_REGEX = /^three(?=[A-Z])/;
var toPascalCase = (type) => `${type[0].toUpperCase()}${type.slice(1)}`;
var i2 = 0;
var isConstructor = (object) => typeof object === "function";
function extend(objects) {
  if (isConstructor(objects)) {
    const Component3 = `${i2++}`;
    catalogue[Component3] = objects;
    return Component3;
  } else {
    Object.assign(catalogue, objects);
  }
}
function validateInstance(type, props) {
  const name = toPascalCase(type);
  const target = catalogue[name];
  if (type !== "primitive" && !target) throw new Error(`R3F: ${name} is not part of the THREE namespace! Did you forget to extend? See: https://docs.pmnd.rs/react-three-fiber/api/objects#using-3rd-party-objects-declaratively`);
  if (type === "primitive" && !props.object) throw new Error(`R3F: Primitives without 'object' are invalid!`);
  if (props.args !== void 0 && !Array.isArray(props.args)) throw new Error("R3F: The args prop must be an array!");
}
function createInstance(type, props, root) {
  var _props$object;
  type = toPascalCase(type) in catalogue ? type : type.replace(PREFIX_REGEX, "");
  validateInstance(type, props);
  if (type === "primitive" && (_props$object = props.object) != null && _props$object.__r3f) delete props.object.__r3f;
  return prepare(props.object, root, type, props);
}
function hideInstance(instance) {
  if (!instance.isHidden) {
    var _instance$parent;
    if (instance.props.attach && (_instance$parent = instance.parent) != null && _instance$parent.object) {
      detach(instance.parent, instance);
    } else if (isObject3D(instance.object)) {
      instance.object.visible = false;
    }
    instance.isHidden = true;
    invalidateInstance(instance);
  }
}
function unhideInstance(instance) {
  if (instance.isHidden) {
    var _instance$parent2;
    if (instance.props.attach && (_instance$parent2 = instance.parent) != null && _instance$parent2.object) {
      attach(instance.parent, instance);
    } else if (isObject3D(instance.object) && instance.props.visible !== false) {
      instance.object.visible = true;
    }
    instance.isHidden = false;
    invalidateInstance(instance);
  }
}
function handleContainerEffects(parent, child, beforeChild) {
  const state2 = child.root.getState();
  if (!parent.parent && parent.object !== state2.scene) return;
  if (!child.object) {
    var _child$props$object, _child$props$args;
    const target = catalogue[toPascalCase(child.type)];
    child.object = (_child$props$object = child.props.object) != null ? _child$props$object : new target(...(_child$props$args = child.props.args) != null ? _child$props$args : []);
    child.object.__r3f = child;
  }
  applyProps(child.object, child.props);
  if (child.props.attach) {
    attach(parent, child);
  } else if (isObject3D(child.object) && isObject3D(parent.object)) {
    const childIndex = parent.object.children.indexOf(beforeChild == null ? void 0 : beforeChild.object);
    if (beforeChild && childIndex !== -1) {
      const existingIndex = parent.object.children.indexOf(child.object);
      if (existingIndex !== -1) {
        parent.object.children.splice(existingIndex, 1);
        const adjustedIndex = existingIndex < childIndex ? childIndex - 1 : childIndex;
        parent.object.children.splice(adjustedIndex, 0, child.object);
      } else {
        child.object.parent = parent.object;
        parent.object.children.splice(childIndex, 0, child.object);
        child.object.dispatchEvent({
          type: "added"
        });
        parent.object.dispatchEvent({
          type: "childadded",
          child: child.object
        });
      }
    } else {
      parent.object.add(child.object);
    }
  }
  for (const childInstance of child.children) handleContainerEffects(child, childInstance);
  invalidateInstance(child);
}
function appendChild(parent, child) {
  if (!child) return;
  child.parent = parent;
  parent.children.push(child);
  handleContainerEffects(parent, child);
}
function insertBefore(parent, child, beforeChild) {
  if (!child || !beforeChild) return;
  child.parent = parent;
  const childIndex = parent.children.indexOf(beforeChild);
  if (childIndex !== -1) parent.children.splice(childIndex, 0, child);
  else parent.children.push(child);
  handleContainerEffects(parent, child, beforeChild);
}
function disposeOnIdle(object) {
  if (typeof object.dispose === "function") {
    const handleDispose = () => {
      try {
        object.dispose();
      } catch {
      }
    };
    if (typeof IS_REACT_ACT_ENVIRONMENT !== "undefined") handleDispose();
    else (0, import_scheduler.unstable_scheduleCallback)(import_scheduler.unstable_IdlePriority, handleDispose);
  }
}
function removeChild(parent, child, dispose2) {
  if (!child) return;
  child.parent = null;
  const childIndex = parent.children.indexOf(child);
  if (childIndex !== -1) parent.children.splice(childIndex, 1);
  if (child.props.attach) {
    detach(parent, child);
  } else if (isObject3D(child.object) && isObject3D(parent.object)) {
    parent.object.remove(child.object);
    removeInteractivity(findInitialRoot(child), child.object);
  }
  const shouldDispose = child.props.dispose !== null && dispose2 !== false;
  for (let i3 = child.children.length - 1; i3 >= 0; i3--) {
    const node = child.children[i3];
    removeChild(child, node, shouldDispose);
  }
  child.children.length = 0;
  delete child.object.__r3f;
  if (shouldDispose && child.type !== "primitive" && child.object.type !== "Scene") {
    disposeOnIdle(child.object);
  }
  if (dispose2 === void 0) invalidateInstance(child);
}
function setFiberRef(fiber, publicInstance) {
  for (const _fiber of [fiber, fiber.alternate]) {
    if (_fiber !== null) {
      if (typeof _fiber.ref === "function") {
        _fiber.refCleanup == null ? void 0 : _fiber.refCleanup();
        const cleanup = _fiber.ref(publicInstance);
        if (typeof cleanup === "function") _fiber.refCleanup = cleanup;
      } else if (_fiber.ref) {
        _fiber.ref.current = publicInstance;
      }
    }
  }
}
var reconstructed = [];
function swapInstances() {
  for (const [instance] of reconstructed) {
    const parent = instance.parent;
    if (parent) {
      if (instance.props.attach) {
        detach(parent, instance);
      } else if (isObject3D(instance.object) && isObject3D(parent.object)) {
        parent.object.remove(instance.object);
      }
      for (const child of instance.children) {
        if (child.props.attach) {
          detach(instance, child);
        } else if (isObject3D(child.object) && isObject3D(instance.object)) {
          instance.object.remove(child.object);
        }
      }
    }
    if (instance.isHidden) unhideInstance(instance);
    if (instance.object.__r3f) delete instance.object.__r3f;
    if (instance.type !== "primitive") disposeOnIdle(instance.object);
  }
  for (const [instance, props, fiber] of reconstructed) {
    instance.props = props;
    const parent = instance.parent;
    if (parent) {
      var _instance$props$objec, _instance$props$args;
      const target = catalogue[toPascalCase(instance.type)];
      instance.object = (_instance$props$objec = instance.props.object) != null ? _instance$props$objec : new target(...(_instance$props$args = instance.props.args) != null ? _instance$props$args : []);
      instance.object.__r3f = instance;
      setFiberRef(fiber, instance.object);
      applyProps(instance.object, instance.props);
      if (instance.props.attach) {
        attach(parent, instance);
      } else if (isObject3D(instance.object) && isObject3D(parent.object)) {
        parent.object.add(instance.object);
      }
      for (const child of instance.children) {
        if (child.props.attach) {
          attach(instance, child);
        } else if (isObject3D(child.object) && isObject3D(instance.object)) {
          instance.object.add(child.object);
        }
      }
      invalidateInstance(instance);
    }
  }
  reconstructed.length = 0;
}
var handleTextInstance = () => {
};
var NO_CONTEXT = {};
var currentUpdatePriority = NoEventPriority;
var NoFlags = 0;
var Update = 4;
var reconciler = /* @__PURE__ */ createReconciler({
  isPrimaryRenderer: false,
  warnsIfNotActing: false,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  createInstance,
  removeChild,
  appendChild,
  appendInitialChild: appendChild,
  insertBefore,
  appendChildToContainer(container, child) {
    const scene = container.getState().scene.__r3f;
    if (!child || !scene) return;
    appendChild(scene, child);
  },
  removeChildFromContainer(container, child) {
    const scene = container.getState().scene.__r3f;
    if (!child || !scene) return;
    removeChild(scene, child);
  },
  insertInContainerBefore(container, child, beforeChild) {
    const scene = container.getState().scene.__r3f;
    if (!child || !beforeChild || !scene) return;
    insertBefore(scene, child, beforeChild);
  },
  getRootHostContext: () => NO_CONTEXT,
  getChildHostContext: () => NO_CONTEXT,
  commitUpdate(instance, type, oldProps, newProps, fiber) {
    var _newProps$args, _oldProps$args, _newProps$args2;
    validateInstance(type, newProps);
    let reconstruct = false;
    if (instance.type === "primitive" && oldProps.object !== newProps.object) reconstruct = true;
    else if (((_newProps$args = newProps.args) == null ? void 0 : _newProps$args.length) !== ((_oldProps$args = oldProps.args) == null ? void 0 : _oldProps$args.length)) reconstruct = true;
    else if ((_newProps$args2 = newProps.args) != null && _newProps$args2.some((value, index) => {
      var _oldProps$args2;
      return value !== ((_oldProps$args2 = oldProps.args) == null ? void 0 : _oldProps$args2[index]);
    })) reconstruct = true;
    if (reconstruct) {
      reconstructed.push([instance, {
        ...newProps
      }, fiber]);
    } else {
      const changedProps = diffProps(instance, newProps);
      if (Object.keys(changedProps).length) {
        Object.assign(instance.props, changedProps);
        applyProps(instance.object, changedProps);
      }
    }
    const isTailSibling = fiber.sibling === null || (fiber.flags & Update) === NoFlags;
    if (isTailSibling) swapInstances();
  },
  finalizeInitialChildren: () => false,
  commitMount() {
  },
  getPublicInstance: (instance) => instance == null ? void 0 : instance.object,
  prepareForCommit: () => null,
  preparePortalMount: (container) => prepare(container.getState().scene, container, "", {}),
  resetAfterCommit: () => {
  },
  shouldSetTextContent: () => false,
  clearContainer: () => false,
  hideInstance,
  unhideInstance,
  createTextInstance: handleTextInstance,
  hideTextInstance: handleTextInstance,
  unhideTextInstance: handleTextInstance,
  scheduleTimeout: typeof setTimeout === "function" ? setTimeout : void 0,
  cancelTimeout: typeof clearTimeout === "function" ? clearTimeout : void 0,
  noTimeout: -1,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur() {
  },
  afterActiveInstanceBlur() {
  },
  detachDeletedInstance() {
  },
  prepareScopeUpdate() {
  },
  getInstanceFromScope: () => null,
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: () => {
  },
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  requestPostPaintCallback() {
  },
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  // true indicates already loaded
  suspendInstance() {
  },
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  // The reconciler types use the internal ReactContext with all the hidden properties
  // so we have to cast from the public React.Context type
  HostTransitionContext: /* @__PURE__ */ React2.createContext(null),
  setCurrentUpdatePriority(newPriority) {
    currentUpdatePriority = newPriority;
  },
  getCurrentUpdatePriority() {
    return currentUpdatePriority;
  },
  resolveUpdatePriority() {
    var _window$event;
    if (currentUpdatePriority !== NoEventPriority) return currentUpdatePriority;
    switch (typeof window !== "undefined" && ((_window$event = window.event) == null ? void 0 : _window$event.type)) {
      case "click":
      case "contextmenu":
      case "dblclick":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
        return e;
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "pointerenter":
      case "pointerleave":
      case "wheel":
        return o2;
      default:
        return r;
    }
  },
  resetFormInstance() {
  },
  // @ts-ignore DefinitelyTyped is not up to date
  rendererPackageName: "@react-three/fiber",
  rendererVersion: packageData.version,
  // https://github.com/facebook/react/pull/31975
  // https://github.com/facebook/react/pull/31999
  applyViewTransitionName(_instance, _name, _className) {
  },
  restoreViewTransitionName(_instance, _props) {
  },
  cancelViewTransitionName(_instance, _name, _props) {
  },
  cancelRootViewTransitionName(_rootContainer) {
  },
  restoreRootViewTransitionName(_rootContainer) {
  },
  InstanceMeasurement: null,
  measureInstance: (_instance) => null,
  wasInstanceInViewport: (_measurement) => true,
  hasInstanceChanged: (_oldMeasurement, _newMeasurement) => false,
  hasInstanceAffectedParent: (_oldMeasurement, _newMeasurement) => false,
  // https://github.com/facebook/react/pull/32002
  // https://github.com/facebook/react/pull/34486
  suspendOnActiveViewTransition(_state, _container) {
  },
  // https://github.com/facebook/react/pull/32451
  // https://github.com/facebook/react/pull/32760
  startGestureTransition: () => null,
  startViewTransition: () => null,
  stopViewTransition(_transition) {
  },
  // https://github.com/facebook/react/pull/32038
  createViewTransitionInstance: (_name) => null,
  // https://github.com/facebook/react/pull/32379
  // https://github.com/facebook/react/pull/32786
  getCurrentGestureOffset(_provider) {
    throw new Error("startGestureTransition is not yet supported in react-three-fiber.");
  },
  // https://github.com/facebook/react/pull/32500
  cloneMutableInstance(instance, _keepChildren) {
    return instance;
  },
  cloneMutableTextInstance(textInstance) {
    return textInstance;
  },
  cloneRootViewTransitionContainer(_rootContainer) {
    throw new Error("Not implemented.");
  },
  removeRootViewTransitionClone(_rootContainer, _clone) {
    throw new Error("Not implemented.");
  },
  // https://github.com/facebook/react/pull/32465
  createFragmentInstance: (_fiber) => null,
  updateFragmentInstanceFiber(_fiber, _instance) {
  },
  commitNewChildToFragmentInstance(_child, _fragmentInstance) {
  },
  deleteChildFromFragmentInstance(_child, _fragmentInstance) {
  },
  // https://github.com/facebook/react/pull/32653
  measureClonedInstance: (_instance) => null,
  // https://github.com/facebook/react/pull/32819
  maySuspendCommitOnUpdate: (_type, _oldProps, _newProps) => false,
  maySuspendCommitInSyncRender: (_type, _props) => false,
  // https://github.com/facebook/react/pull/34486
  startSuspendingCommit: () => null,
  // https://github.com/facebook/react/pull/34522
  getSuspendedCommitReason: (_state, _rootContainer) => null
});
var _roots = /* @__PURE__ */ new Map();
var shallowLoose = {
  objects: "shallow",
  strict: false
};
function computeInitialSize(canvas, size) {
  if (!size && typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement && canvas.parentElement) {
    const {
      width,
      height,
      top,
      left
    } = canvas.parentElement.getBoundingClientRect();
    return {
      width,
      height,
      top,
      left
    };
  } else if (!size && typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return {
      width: canvas.width,
      height: canvas.height,
      top: 0,
      left: 0
    };
  }
  return {
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    ...size
  };
}
function createRoot(canvas) {
  const prevRoot = _roots.get(canvas);
  const prevFiber = prevRoot == null ? void 0 : prevRoot.fiber;
  const prevStore = prevRoot == null ? void 0 : prevRoot.store;
  if (prevRoot) console.warn("R3F.createRoot should only be called once!");
  const logRecoverableError = typeof reportError === "function" ? (
    // In modern browsers, reportError will dispatch an error event,
    // emulating an uncaught JavaScript error.
    reportError
  ) : (
    // In older browsers and test environments, fallback to console.error.
    console.error
  );
  const store = prevStore || createStore2(invalidate, advance);
  const fiber = prevFiber || reconciler.createContainer(
    store,
    // container
    t,
    // tag
    null,
    // hydration callbacks
    false,
    // isStrictMode
    null,
    // concurrentUpdatesByDefaultOverride
    "",
    // identifierPrefix
    logRecoverableError,
    // onUncaughtError
    logRecoverableError,
    // onCaughtError
    logRecoverableError,
    // onRecoverableError
    null
    // transitionCallbacks
  );
  if (!prevRoot) _roots.set(canvas, {
    fiber,
    store
  });
  let onCreated;
  let lastCamera;
  let configured = false;
  let pending = null;
  return {
    async configure(props = {}) {
      let resolve2;
      pending = new Promise((_resolve) => resolve2 = _resolve);
      let {
        gl: glConfig,
        size: propsSize,
        scene: sceneOptions,
        events,
        onCreated: onCreatedCallback,
        shadows = false,
        linear = false,
        flat = false,
        legacy = false,
        orthographic = false,
        frameloop = "always",
        dpr = [1, 2],
        performance: performance2,
        raycaster: raycastOptions,
        camera: cameraOptions,
        onPointerMissed
      } = props;
      let state2 = store.getState();
      let gl = state2.gl;
      if (!state2.gl) {
        const defaultProps = {
          canvas,
          powerPreference: "high-performance",
          antialias: true,
          alpha: true
        };
        const customRenderer = typeof glConfig === "function" ? await glConfig(defaultProps) : glConfig;
        if (isRenderer(customRenderer)) {
          gl = customRenderer;
        } else {
          gl = new THREE.WebGLRenderer({
            ...defaultProps,
            ...glConfig
          });
        }
        state2.set({
          gl
        });
      }
      let raycaster = state2.raycaster;
      if (!raycaster) state2.set({
        raycaster: raycaster = new THREE.Raycaster()
      });
      const {
        params,
        ...options
      } = raycastOptions || {};
      if (!is.equ(options, raycaster, shallowLoose)) applyProps(raycaster, {
        ...options
      });
      if (!is.equ(params, raycaster.params, shallowLoose)) applyProps(raycaster, {
        params: {
          ...raycaster.params,
          ...params
        }
      });
      if (!state2.camera || state2.camera === lastCamera && !is.equ(lastCamera, cameraOptions, shallowLoose)) {
        lastCamera = cameraOptions;
        const isCamera = cameraOptions == null ? void 0 : cameraOptions.isCamera;
        const camera = isCamera ? cameraOptions : orthographic ? new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1e3) : new THREE.PerspectiveCamera(75, 0, 0.1, 1e3);
        if (!isCamera) {
          camera.position.z = 5;
          if (cameraOptions) {
            applyProps(camera, cameraOptions);
            if (!camera.manual) {
              if ("aspect" in cameraOptions || "left" in cameraOptions || "right" in cameraOptions || "bottom" in cameraOptions || "top" in cameraOptions) {
                camera.manual = true;
                camera.updateProjectionMatrix();
              }
            }
          }
          if (!state2.camera && !(cameraOptions != null && cameraOptions.rotation)) camera.lookAt(0, 0, 0);
        }
        state2.set({
          camera
        });
        raycaster.camera = camera;
      }
      if (!state2.scene) {
        let scene;
        if (sceneOptions != null && sceneOptions.isScene) {
          scene = sceneOptions;
          prepare(scene, store, "", {});
        } else {
          scene = new THREE.Scene();
          prepare(scene, store, "", {});
          if (sceneOptions) applyProps(scene, sceneOptions);
        }
        state2.set({
          scene
        });
      }
      if (events && !state2.events.handlers) state2.set({
        events: events(store)
      });
      const size = computeInitialSize(canvas, propsSize);
      if (!is.equ(size, state2.size, shallowLoose)) {
        state2.setSize(size.width, size.height, size.top, size.left);
      }
      if (dpr && state2.viewport.dpr !== calculateDpr(dpr)) state2.setDpr(dpr);
      if (state2.frameloop !== frameloop) state2.setFrameloop(frameloop);
      if (!state2.onPointerMissed) state2.set({
        onPointerMissed
      });
      if (performance2 && !is.equ(performance2, state2.performance, shallowLoose)) state2.set((state3) => ({
        performance: {
          ...state3.performance,
          ...performance2
        }
      }));
      if (!state2.xr) {
        var _gl$xr;
        const handleXRFrame = (timestamp, frame2) => {
          const state3 = store.getState();
          if (state3.frameloop === "never") return;
          advance(timestamp, true, state3, frame2);
        };
        const handleSessionChange = () => {
          const state3 = store.getState();
          state3.gl.xr.enabled = state3.gl.xr.isPresenting;
          state3.gl.xr.setAnimationLoop(state3.gl.xr.isPresenting ? handleXRFrame : null);
          if (!state3.gl.xr.isPresenting) invalidate(state3);
        };
        const xr = {
          connect() {
            const gl2 = store.getState().gl;
            gl2.xr.addEventListener("sessionstart", handleSessionChange);
            gl2.xr.addEventListener("sessionend", handleSessionChange);
          },
          disconnect() {
            const gl2 = store.getState().gl;
            gl2.xr.removeEventListener("sessionstart", handleSessionChange);
            gl2.xr.removeEventListener("sessionend", handleSessionChange);
          }
        };
        if (typeof ((_gl$xr = gl.xr) == null ? void 0 : _gl$xr.addEventListener) === "function") xr.connect();
        state2.set({
          xr
        });
      }
      if (gl.shadowMap) {
        const oldEnabled = gl.shadowMap.enabled;
        const oldType = gl.shadowMap.type;
        gl.shadowMap.enabled = !!shadows;
        if (is.boo(shadows)) {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        } else if (is.str(shadows)) {
          var _types$shadows;
          const types = {
            basic: THREE.BasicShadowMap,
            percentage: THREE.PCFShadowMap,
            soft: THREE.PCFSoftShadowMap,
            variance: THREE.VSMShadowMap
          };
          gl.shadowMap.type = (_types$shadows = types[shadows]) != null ? _types$shadows : THREE.PCFSoftShadowMap;
        } else if (is.obj(shadows)) {
          Object.assign(gl.shadowMap, shadows);
        }
        if (oldEnabled !== gl.shadowMap.enabled || oldType !== gl.shadowMap.type) gl.shadowMap.needsUpdate = true;
      }
      THREE.ColorManagement.enabled = !legacy;
      if (!configured) {
        gl.outputColorSpace = linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
        gl.toneMapping = flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      }
      if (state2.legacy !== legacy) state2.set(() => ({
        legacy
      }));
      if (state2.linear !== linear) state2.set(() => ({
        linear
      }));
      if (state2.flat !== flat) state2.set(() => ({
        flat
      }));
      if (glConfig && !is.fun(glConfig) && !isRenderer(glConfig) && !is.equ(glConfig, gl, shallowLoose)) applyProps(gl, glConfig);
      onCreated = onCreatedCallback;
      configured = true;
      resolve2();
      return this;
    },
    render(children) {
      if (!configured && !pending) this.configure();
      pending.then(() => {
        reconciler.updateContainer(/* @__PURE__ */ jsx(Provider, {
          store,
          children,
          onCreated,
          rootElement: canvas
        }), fiber, null, () => void 0);
      });
      return store;
    },
    unmount() {
      unmountComponentAtNode(canvas);
    }
  };
}
function Provider({
  store,
  children,
  onCreated,
  rootElement
}) {
  useIsomorphicLayoutEffect(() => {
    const state2 = store.getState();
    state2.set((state3) => ({
      internal: {
        ...state3.internal,
        active: true
      }
    }));
    if (onCreated) onCreated(state2);
    if (!store.getState().events.connected) state2.events.connect == null ? void 0 : state2.events.connect(rootElement);
  }, []);
  return /* @__PURE__ */ jsx(context.Provider, {
    value: store,
    children
  });
}
function unmountComponentAtNode(canvas, callback) {
  const root = _roots.get(canvas);
  const fiber = root == null ? void 0 : root.fiber;
  if (fiber) {
    const state2 = root == null ? void 0 : root.store.getState();
    if (state2) state2.internal.active = false;
    reconciler.updateContainer(null, fiber, null, () => {
      if (state2) {
        setTimeout(() => {
          try {
            var _state$gl, _state$gl$renderLists, _state$gl2, _state$gl3;
            state2.events.disconnect == null ? void 0 : state2.events.disconnect();
            (_state$gl = state2.gl) == null ? void 0 : (_state$gl$renderLists = _state$gl.renderLists) == null ? void 0 : _state$gl$renderLists.dispose == null ? void 0 : _state$gl$renderLists.dispose();
            (_state$gl2 = state2.gl) == null ? void 0 : _state$gl2.forceContextLoss == null ? void 0 : _state$gl2.forceContextLoss();
            if ((_state$gl3 = state2.gl) != null && _state$gl3.xr) state2.xr.disconnect();
            dispose(state2.scene);
            _roots.delete(canvas);
            if (callback) callback(canvas);
          } catch (e2) {
          }
        }, 500);
      }
    });
  }
}
function createPortal(children, container, state2) {
  return /* @__PURE__ */ jsx(Portal, {
    children,
    container,
    state: state2
  });
}
function Portal({
  state: state2 = {},
  children,
  container
}) {
  const {
    events,
    size,
    ...rest
  } = state2;
  const previousRoot = useStore();
  const [raycaster] = React2.useState(() => new THREE.Raycaster());
  const [pointer] = React2.useState(() => new THREE.Vector2());
  const inject = useMutableCallback((rootState, injectState) => {
    let viewport = void 0;
    if (injectState.camera && size) {
      const camera = injectState.camera;
      viewport = rootState.viewport.getCurrentViewport(camera, new THREE.Vector3(), size);
      if (camera !== rootState.camera) updateCamera(camera, size);
    }
    return {
      // The intersect consists of the previous root state
      ...rootState,
      ...injectState,
      // Portals have their own scene, which forms the root, a raycaster and a pointer
      scene: container,
      raycaster,
      pointer,
      mouse: pointer,
      // Their previous root is the layer before it
      previousRoot,
      // Events, size and viewport can be overridden by the inject layer
      events: {
        ...rootState.events,
        ...injectState.events,
        ...events
      },
      size: {
        ...rootState.size,
        ...size
      },
      viewport: {
        ...rootState.viewport,
        ...viewport
      },
      // Layers are allowed to override events
      setEvents: (events2) => injectState.set((state3) => ({
        ...state3,
        events: {
          ...state3.events,
          ...events2
        }
      }))
    };
  });
  const usePortalStore = React2.useMemo(() => {
    const store = createWithEqualityFn((set, get) => ({
      ...rest,
      set,
      get
    }));
    const onMutate = (prev) => store.setState((state3) => inject.current(prev, state3));
    onMutate(previousRoot.getState());
    previousRoot.subscribe(onMutate);
    return store;
  }, [previousRoot, container]);
  return (
    // @ts-ignore, reconciler types are not maintained
    /* @__PURE__ */ jsx(Fragment2, {
      children: reconciler.createPortal(/* @__PURE__ */ jsx(context.Provider, {
        value: usePortalStore,
        children
      }), usePortalStore, null)
    })
  );
}
function flushSync(fn) {
  return reconciler.flushSyncFromReconciler(fn);
}
function createSubs(callback, subs) {
  const sub = {
    callback
  };
  subs.add(sub);
  return () => void subs.delete(sub);
}
var globalEffects = /* @__PURE__ */ new Set();
var globalAfterEffects = /* @__PURE__ */ new Set();
var globalTailEffects = /* @__PURE__ */ new Set();
var addEffect = (callback) => createSubs(callback, globalEffects);
var addAfterEffect = (callback) => createSubs(callback, globalAfterEffects);
var addTail = (callback) => createSubs(callback, globalTailEffects);
function run(effects, timestamp) {
  if (!effects.size) return;
  for (const {
    callback
  } of effects.values()) {
    callback(timestamp);
  }
}
function flushGlobalEffects(type, timestamp) {
  switch (type) {
    case "before":
      return run(globalEffects, timestamp);
    case "after":
      return run(globalAfterEffects, timestamp);
    case "tail":
      return run(globalTailEffects, timestamp);
  }
}
var subscribers;
var subscription;
function update(timestamp, state2, frame2) {
  let delta = state2.clock.getDelta();
  if (state2.frameloop === "never" && typeof timestamp === "number") {
    delta = timestamp - state2.clock.elapsedTime;
    state2.clock.oldTime = state2.clock.elapsedTime;
    state2.clock.elapsedTime = timestamp;
  }
  subscribers = state2.internal.subscribers;
  for (let i3 = 0; i3 < subscribers.length; i3++) {
    subscription = subscribers[i3];
    subscription.ref.current(subscription.store.getState(), delta, frame2);
  }
  if (!state2.internal.priority && state2.gl.render) state2.gl.render(state2.scene, state2.camera);
  state2.internal.frames = Math.max(0, state2.internal.frames - 1);
  return state2.frameloop === "always" ? 1 : state2.internal.frames;
}
var running = false;
var useFrameInProgress = false;
var repeat;
var frame;
var state;
function loop(timestamp) {
  frame = requestAnimationFrame(loop);
  running = true;
  repeat = 0;
  flushGlobalEffects("before", timestamp);
  useFrameInProgress = true;
  for (const root of _roots.values()) {
    var _state$gl$xr;
    state = root.store.getState();
    if (state.internal.active && (state.frameloop === "always" || state.internal.frames > 0) && !((_state$gl$xr = state.gl.xr) != null && _state$gl$xr.isPresenting)) {
      repeat += update(timestamp, state);
    }
  }
  useFrameInProgress = false;
  flushGlobalEffects("after", timestamp);
  if (repeat === 0) {
    flushGlobalEffects("tail", timestamp);
    running = false;
    return cancelAnimationFrame(frame);
  }
}
function invalidate(state2, frames = 1) {
  var _state$gl$xr2;
  if (!state2) return _roots.forEach((root) => invalidate(root.store.getState(), frames));
  if ((_state$gl$xr2 = state2.gl.xr) != null && _state$gl$xr2.isPresenting || !state2.internal.active || state2.frameloop === "never") return;
  if (frames > 1) {
    state2.internal.frames = Math.min(60, state2.internal.frames + frames);
  } else {
    if (useFrameInProgress) {
      state2.internal.frames = 2;
    } else {
      state2.internal.frames = 1;
    }
  }
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}
function advance(timestamp, runGlobalEffects = true, state2, frame2) {
  if (runGlobalEffects) flushGlobalEffects("before", timestamp);
  if (!state2) for (const root of _roots.values()) update(timestamp, root.store.getState());
  else update(timestamp, state2, frame2);
  if (runGlobalEffects) flushGlobalEffects("after", timestamp);
}
var DOM_EVENTS = {
  onClick: ["click", false],
  onContextMenu: ["contextmenu", false],
  onDoubleClick: ["dblclick", false],
  onWheel: ["wheel", true],
  onPointerDown: ["pointerdown", true],
  onPointerUp: ["pointerup", true],
  onPointerLeave: ["pointerleave", true],
  onPointerMove: ["pointermove", true],
  onPointerCancel: ["pointercancel", true],
  onLostPointerCapture: ["lostpointercapture", true]
};
function createPointerEvents(store) {
  const {
    handlePointer
  } = createEvents(store);
  return {
    priority: 1,
    enabled: true,
    compute(event, state2, previous) {
      state2.pointer.set(event.offsetX / state2.size.width * 2 - 1, -(event.offsetY / state2.size.height) * 2 + 1);
      state2.raycaster.setFromCamera(state2.pointer, state2.camera);
    },
    connected: void 0,
    handlers: Object.keys(DOM_EVENTS).reduce((acc, key) => ({
      ...acc,
      [key]: handlePointer(key)
    }), {}),
    update: () => {
      var _internal$lastEvent;
      const {
        events,
        internal
      } = store.getState();
      if ((_internal$lastEvent = internal.lastEvent) != null && _internal$lastEvent.current && events.handlers) events.handlers.onPointerMove(internal.lastEvent.current);
    },
    connect: (target) => {
      const {
        set,
        events
      } = store.getState();
      events.disconnect == null ? void 0 : events.disconnect();
      set((state2) => ({
        events: {
          ...state2.events,
          connected: target
        }
      }));
      if (events.handlers) {
        for (const name in events.handlers) {
          const event = events.handlers[name];
          const [eventName, passive] = DOM_EVENTS[name];
          target.addEventListener(eventName, event, {
            passive
          });
        }
      }
    },
    disconnect: () => {
      const {
        set,
        events
      } = store.getState();
      if (events.connected) {
        if (events.handlers) {
          for (const name in events.handlers) {
            const event = events.handlers[name];
            const [eventName] = DOM_EVENTS[name];
            events.connected.removeEventListener(eventName, event);
          }
        }
        set((state2) => ({
          events: {
            ...state2.events,
            connected: void 0
          }
        }));
      }
    }
  };
}

// node_modules/@react-three/fiber/dist/react-three-fiber.esm.js
import * as React3 from "/virtual/react.js";
import * as THREE2 from "/vendor/three.js";

// node_modules/react-use-measure/dist/index.js
import { useState as T, useRef as p2, useEffect as u, useMemo as M } from "/virtual/react.js";
function g(n, t2) {
  let o3;
  return (...i3) => {
    window.clearTimeout(o3), o3 = window.setTimeout(() => n(...i3), t2);
  };
}
function j({ debounce: n, scroll: t2, polyfill: o3, offsetSize: i3 } = { debounce: 0, scroll: false, offsetSize: false }) {
  const a2 = o3 || (typeof window == "undefined" ? class {
  } : window.ResizeObserver);
  if (!a2) throw new Error("This browser does not support ResizeObserver out of the box. See: https://github.com/react-spring/react-use-measure/#resize-observer-polyfills");
  const [c2, h2] = T({ left: 0, top: 0, width: 0, height: 0, bottom: 0, right: 0, x: 0, y: 0 }), e2 = p2({ element: null, scrollContainers: null, resizeObserver: null, lastBounds: c2, orientationHandler: null }), d = n ? typeof n == "number" ? n : n.scroll : null, f = n ? typeof n == "number" ? n : n.resize : null, w = p2(false);
  u(() => (w.current = true, () => void (w.current = false)));
  const [z, m2, s] = M(() => {
    const r2 = () => {
      if (!e2.current.element) return;
      const { left: y, top: C, width: H, height: O, bottom: S, right: x2, x: B, y: R } = e2.current.element.getBoundingClientRect(), l2 = { left: y, top: C, width: H, height: O, bottom: S, right: x2, x: B, y: R };
      e2.current.element instanceof HTMLElement && i3 && (l2.height = e2.current.element.offsetHeight, l2.width = e2.current.element.offsetWidth), Object.freeze(l2), w.current && !D(e2.current.lastBounds, l2) && h2(e2.current.lastBounds = l2);
    };
    return [r2, f ? g(r2, f) : r2, d ? g(r2, d) : r2];
  }, [h2, i3, d, f]);
  function v() {
    e2.current.scrollContainers && (e2.current.scrollContainers.forEach((r2) => r2.removeEventListener("scroll", s, true)), e2.current.scrollContainers = null), e2.current.resizeObserver && (e2.current.resizeObserver.disconnect(), e2.current.resizeObserver = null), e2.current.orientationHandler && ("orientation" in screen && "removeEventListener" in screen.orientation ? screen.orientation.removeEventListener("change", e2.current.orientationHandler) : "onorientationchange" in window && window.removeEventListener("orientationchange", e2.current.orientationHandler));
  }
  function b2() {
    e2.current.element && (e2.current.resizeObserver = new a2(s), e2.current.resizeObserver.observe(e2.current.element), t2 && e2.current.scrollContainers && e2.current.scrollContainers.forEach((r2) => r2.addEventListener("scroll", s, { capture: true, passive: true })), e2.current.orientationHandler = () => {
      s();
    }, "orientation" in screen && "addEventListener" in screen.orientation ? screen.orientation.addEventListener("change", e2.current.orientationHandler) : "onorientationchange" in window && window.addEventListener("orientationchange", e2.current.orientationHandler));
  }
  const L = (r2) => {
    !r2 || r2 === e2.current.element || (v(), e2.current.element = r2, e2.current.scrollContainers = E(r2), b2());
  };
  return X(s, !!t2), W(m2), u(() => {
    v(), b2();
  }, [t2, s, m2]), u(() => v, []), [L, c2, z];
}
function W(n) {
  u(() => {
    const t2 = n;
    return window.addEventListener("resize", t2), () => void window.removeEventListener("resize", t2);
  }, [n]);
}
function X(n, t2) {
  u(() => {
    if (t2) {
      const o3 = n;
      return window.addEventListener("scroll", o3, { capture: true, passive: true }), () => void window.removeEventListener("scroll", o3, true);
    }
  }, [n, t2]);
}
function E(n) {
  const t2 = [];
  if (!n || n === document.body) return t2;
  const { overflow: o3, overflowX: i3, overflowY: a2 } = window.getComputedStyle(n);
  return [o3, i3, a2].some((c2) => c2 === "auto" || c2 === "scroll") && t2.push(n), [...t2, ...E(n.parentElement)];
}
var k = ["x", "y", "top", "bottom", "left", "right", "width", "height"];
var D = (n, t2) => k.every((o3) => n[o3] === t2[o3]);

// node_modules/@react-three/fiber/dist/react-three-fiber.esm.js
import { jsx as jsx2 } from "/virtual/react.js/jsx-runtime";
var import_scheduler2 = __toESM(require_scheduler());
function CanvasImpl({
  ref,
  children,
  fallback,
  resize,
  style,
  gl,
  events = createPointerEvents,
  eventSource,
  eventPrefix,
  shadows,
  linear,
  flat,
  legacy,
  orthographic,
  frameloop,
  dpr,
  performance: performance2,
  raycaster,
  camera,
  scene,
  onPointerMissed,
  onCreated,
  ...props
}) {
  React3.useMemo(() => extend(THREE2), []);
  const Bridge = useBridge();
  const [containerRef, containerRect] = j({
    scroll: true,
    debounce: {
      scroll: 50,
      resize: 0
    },
    ...resize
  });
  const canvasRef = React3.useRef(null);
  const divRef = React3.useRef(null);
  React3.useImperativeHandle(ref, () => canvasRef.current);
  const handlePointerMissed = useMutableCallback(onPointerMissed);
  const [block, setBlock] = React3.useState(false);
  const [error, setError] = React3.useState(false);
  if (block) throw block;
  if (error) throw error;
  const root = React3.useRef(null);
  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (containerRect.width > 0 && containerRect.height > 0 && canvas) {
      if (!root.current) root.current = createRoot(canvas);
      async function run2() {
        await root.current.configure({
          gl,
          scene,
          events,
          shadows,
          linear,
          flat,
          legacy,
          orthographic,
          frameloop,
          dpr,
          performance: performance2,
          raycaster,
          camera,
          size: containerRect,
          // Pass mutable reference to onPointerMissed so it's free to update
          onPointerMissed: (...args) => handlePointerMissed.current == null ? void 0 : handlePointerMissed.current(...args),
          onCreated: (state2) => {
            state2.events.connect == null ? void 0 : state2.events.connect(eventSource ? isRef(eventSource) ? eventSource.current : eventSource : divRef.current);
            if (eventPrefix) {
              state2.setEvents({
                compute: (event, state3) => {
                  const x2 = event[eventPrefix + "X"];
                  const y = event[eventPrefix + "Y"];
                  state3.pointer.set(x2 / state3.size.width * 2 - 1, -(y / state3.size.height) * 2 + 1);
                  state3.raycaster.setFromCamera(state3.pointer, state3.camera);
                }
              });
            }
            onCreated == null ? void 0 : onCreated(state2);
          }
        });
        root.current.render(/* @__PURE__ */ jsx2(Bridge, {
          children: /* @__PURE__ */ jsx2(ErrorBoundary, {
            set: setError,
            children: /* @__PURE__ */ jsx2(React3.Suspense, {
              fallback: /* @__PURE__ */ jsx2(Block, {
                set: setBlock
              }),
              children: children != null ? children : null
            })
          })
        }));
      }
      run2();
    }
  });
  React3.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) return () => unmountComponentAtNode(canvas);
  }, []);
  const pointerEvents = eventSource ? "none" : "auto";
  return /* @__PURE__ */ jsx2("div", {
    ref: divRef,
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      pointerEvents,
      ...style
    },
    ...props,
    children: /* @__PURE__ */ jsx2("div", {
      ref: containerRef,
      style: {
        width: "100%",
        height: "100%"
      },
      children: /* @__PURE__ */ jsx2("canvas", {
        ref: canvasRef,
        style: {
          display: "block"
        },
        children: fallback
      })
    })
  });
}
function Canvas(props) {
  return /* @__PURE__ */ jsx2(m, {
    children: /* @__PURE__ */ jsx2(CanvasImpl, {
      ...props
    })
  });
}
export {
  Canvas,
  threeTypes as ReactThreeFiber,
  _roots,
  act2 as act,
  addAfterEffect,
  addEffect,
  addTail,
  advance,
  applyProps,
  buildGraph,
  context,
  createEvents,
  createPortal,
  createRoot,
  dispose,
  createPointerEvents as events,
  extend,
  flushGlobalEffects,
  flushSync,
  getRootState,
  invalidate,
  reconciler,
  unmountComponentAtNode,
  useFrame,
  useGraph,
  useInstanceHandle,
  useLoader,
  useStore,
  useThree
};
