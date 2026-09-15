'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — SWIPE ENGINE
   PREVIOUS + CURRENT + NEXT
   INTERRUPTIBLE CINEMATIC MOTION
   ========================================================= */

(() => {
  const DEFAULTS = {
    axisLockPx: 4,

    commitDistanceRatio: 0.10,
    commitMinDistancePx: 28,
    flickMinDistancePx: 10,
    flickVelocityPxMs: 0.20,
    velocitySmoothing: 0.38,

    commitMinDurationMs: 420,
    commitMaxDurationMs: 680,
    commitDistanceDurationMs: 560,
    commitVelocityInfluence: 0.18,

    snapMinDurationMs: 260,
    snapMaxDurationMs: 420,

    cinematicPower: 4.2,
    cinematicTailStrength: 0.16,

    takeoverMinDistancePx: 6
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const isDirection = direction => direction === 1 || direction === -1;

  const getViewportHeight = viewport => Math.max(
    1,
    viewport?.clientHeight || 0,
    window.visualViewport?.height || 0,
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0
  );

  /* =========================================================
     EASING
     ========================================================= */

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const createCinematicEase = (power, tailStrength) => {
    const p = Math.max(2, power);
    const tail = clamp(tailStrength, 0, 0.4);

    return t => {
      const base = 1 - Math.pow(1 - t, p);
      const tailShape = Math.sin(Math.PI * t) * (1 - t);
      return clamp(base - tailShape * tail, 0, 1);
    };
  };

  /* =========================================================
     CREATE
     ========================================================= */

  const create = options => {
    if (!options?.viewport) throw new Error('[VB Swipe] viewport is required.');

    const viewport = options.viewport;
    const exclude = typeof options.exclude === 'string' ? options.exclude : '';
    const onCommit = typeof options.onCommit === 'function' ? options.onCommit : null;
    const config = { ...DEFAULTS, ...(options.config || {}) };

    const cinematicEase = createCinematicEase(
      config.cinematicPower,
      config.cinematicTailStrength
    );

    let previous = options.layers?.previous || null;
    let current = options.layers?.current || null;
    let next = options.layers?.next || null;

    /* =========================================================
       STATE
       ========================================================= */

    let enabled = false;
    let destroyed = false;

    let dragging = false;
    let animating = false;
    let takingOver = false;

    let axis = null;
    let pointerId = null;

    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;

    let dragY = 0;
    let velocityY = 0;
    let viewportHeight = 1;

    let raf = 0;
    let motionToken = 0;

    let motionDirection = 0;
    let takeoverOrigin = 0;

    /* =========================================================
       LAYERS
       ========================================================= */

    const layers = () => [previous, current, next].filter(Boolean);
    const hasLayers = () => Boolean(previous && current && next);

    const setTransform = (layer, y) => {
      if (!layer) return;
      layer.style.transform = `translate3d(0,${y.toFixed(3)}px,0)`;
    };

    const prepareLayers = active => {
      layers().forEach(layer => {
        layer.style.transition = 'none';
        layer.style.willChange = active ? 'transform' : 'auto';
      });
    };

    const renderTrack = offset => {
      setTransform(previous, -viewportHeight + offset);
      setTransform(current, offset);
      setTransform(next, viewportHeight + offset);
    };

    /* =========================================================
       MOTION
       ========================================================= */

    const cancelMotion = () => {
      motionToken++;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const resetGesture = () => {
      dragging = false;
      takingOver = false;
      axis = null;

      startX = 0;
      startY = 0;
      lastY = 0;
      lastTime = 0;

      velocityY = 0;
      takeoverOrigin = 0;
    };

    const resetPointer = () => {
      pointerId = null;
    };

    const resetGeometry = () => {
      if (destroyed || !hasLayers()) return;

      cancelMotion();

      viewportHeight = getViewportHeight(viewport);

      dragY = 0;
      velocityY = 0;
      motionDirection = 0;

      resetGesture();
      prepareLayers(false);
      renderTrack(0);
    };

    const prepareMotion = () => {
      viewportHeight = getViewportHeight(viewport);
      prepareLayers(true);
    };

    /* =========================================================
       CINEMATIC RAF
       ========================================================= */

    const animate = ({ from, to, duration, easing, complete }) => {
      cancelMotion();

      const token = motionToken;
      const startedAt = performance.now();
      const distance = to - from;

      prepareLayers(true);

      const frame = now => {
        if (
          destroyed ||
          !enabled ||
          !animating ||
          token !== motionToken
        ) {
          raf = 0;
          return;
        }

        const progress = clamp(
          (now - startedAt) / Math.max(1, duration),
          0,
          1
        );

        dragY = from + distance * easing(progress);
        renderTrack(dragY);

        if (progress < 1) {
          raf = requestAnimationFrame(frame);
          return;
        }

        raf = 0;
        dragY = to;
        renderTrack(to);

        complete?.();
      };

      raf = requestAnimationFrame(frame);
    };

    /* =========================================================
       DURATION
       ========================================================= */

    const getCommitDuration = remainingDistance => {
      const distanceRatio = clamp(
        remainingDistance / Math.max(1, viewportHeight),
        0,
        1
      );

      const velocityReduction = clamp(
        Math.abs(velocityY) * config.commitVelocityInfluence * 100,
        0,
        110
      );

      const duration =
        config.commitMinDurationMs +
        distanceRatio *
          (config.commitDistanceDurationMs - config.commitMinDurationMs) -
        velocityReduction;

      return clamp(
        duration,
        config.commitMinDurationMs,
        config.commitMaxDurationMs
      );
    };

    /* =========================================================
       RECYCLE
       ========================================================= */

    const recycle = direction => {
      if (!isDirection(direction)) return false;

      dragY = 0;
      velocityY = 0;

      onCommit?.(direction);

      if (destroyed || !hasLayers()) return false;

      viewportHeight = getViewportHeight(viewport);
      renderTrack(0);

      return true;
    };

    /* =========================================================
       COMMIT
       ========================================================= */

    const finishCommit = direction => {
      animating = false;
      motionDirection = 0;

      recycle(direction);

      if (destroyed || !hasLayers()) return;

      resetGesture();
      prepareLayers(false);
    };

    const commit = direction => {
      if (
        destroyed ||
        !enabled ||
        !hasLayers() ||
        !isDirection(direction)
      ) {
        return false;
      }

      if (animating) return false;

      viewportHeight = getViewportHeight(viewport);

      const destination = direction > 0 ? -viewportHeight : viewportHeight;
      const from = clamp(dragY, -viewportHeight, viewportHeight);
      const remainingDistance = Math.abs(destination - from);

      animating = true;
      dragging = false;
      takingOver = false;
      motionDirection = direction;

      animate({
        from,
        to: destination,
        duration: getCommitDuration(remainingDistance),
        easing: cinematicEase,
        complete: () => finishCommit(direction)
      });

      return true;
    };

    /* =========================================================
       SNAP BACK
       ========================================================= */

    const finishSnapBack = () => {
      animating = false;
      motionDirection = 0;

      dragY = 0;
      velocityY = 0;

      resetGesture();
      renderTrack(0);
      prepareLayers(false);
    };

    const snapBack = () => {
      if (destroyed || !enabled || animating) return;

      viewportHeight = getViewportHeight(viewport);

      const from = clamp(dragY, -viewportHeight, viewportHeight);
      const ratio = Math.abs(from) / Math.max(1, viewportHeight);

      const duration = clamp(
        config.snapMinDurationMs +
          ratio * (config.snapMaxDurationMs - config.snapMinDurationMs),
        config.snapMinDurationMs,
        config.snapMaxDurationMs
      );

      animating = true;
      dragging = false;
      takingOver = false;
      motionDirection = 0;

      animate({
        from,
        to: 0,
        duration,
        easing: easeOutCubic,
        complete: finishSnapBack
      });
    };

    /* =========================================================
       TAKEOVER
       ========================================================= */

    const beginTakeover = (x, y) => {
      if (
        destroyed ||
        !enabled ||
        !animating ||
        !isDirection(motionDirection)
      ) {
        return false;
      }

      /*
       * Do not stop the cinematic motion on touchstart.
       * The finger first proves that this is a vertical gesture.
       * This prevents a simple tap from freezing the animation.
       */
      takingOver = true;
      dragging = false;
      axis = null;

      startX = x;
      startY = y;

      lastY = y;
      lastTime = performance.now();

      takeoverOrigin = dragY;
      velocityY = 0;

      return true;
    };

    const activateTakeover = y => {
      const direction = motionDirection;

      /*
       * Capture the exact rendered position before cancelling RAF.
       */
      takeoverOrigin = dragY;

      cancelMotion();

      animating = false;
      motionDirection = 0;
      dragging = true;

      /*
       * The old card has already committed logically once the user
       * starts another intentional swipe in the same direction.
       * Finish its boundary atomically, recycle, then transfer the
       * remaining finger movement to the new CURRENT.
       */
      if (!recycle(direction)) return false;

      startY = y;
      lastY = y;
      lastTime = performance.now();

      dragY = 0;
      velocityY = 0;

      prepareMotion();

      return true;
    };

    const updateTakeover = (x, y) => {
      if (!takingOver || !isDirection(motionDirection)) return false;

      const dx = x - startX;
      const dy = y - startY;

      if (!axis) {
        if (
          Math.abs(dx) < config.axisLockPx &&
          Math.abs(dy) < config.axisLockPx
        ) {
          return false;
        }

        axis = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';

        if (axis !== 'vertical') {
          takingOver = false;
          axis = null;
          return false;
        }
      }

      const gestureDirection = dy < 0 ? 1 : -1;

      /*
       * Same-direction gesture = continuous swipe.
       * Opposite direction does not destroy the running cinematic
       * commit; the original motion is allowed to finish normally.
       */
      if (
        gestureDirection !== motionDirection ||
        Math.abs(dy) < config.takeoverMinDistancePx
      ) {
        return true;
      }

      if (!activateTakeover(y)) return false;

      /*
       * Preserve the part of this gesture that already happened
       * before takeover instead of throwing it away.
       */
      const transferredDistance =
        Math.sign(dy) * Math.max(0, Math.abs(dy) - config.takeoverMinDistancePx);

      startY = y - transferredDistance;
      dragY = clamp(transferredDistance, -viewportHeight, viewportHeight);

      renderTrack(dragY);

      return true;
    };

    /* =========================================================
       NORMAL GESTURE
       ========================================================= */

    const beginGesture = (x, y) => {
      if (destroyed || !enabled) return false;

      if (animating) return beginTakeover(x, y);

      cancelMotion();
      prepareMotion();

      dragging = true;
      takingOver = false;
      axis = null;

      startX = x;
      startY = y;

      lastY = y;
      lastTime = performance.now();

      dragY = 0;
      velocityY = 0;

      return true;
    };

    const updateDrag = (x, y) => {
      if (!dragging) return false;

      const dx = x - startX;
      const dy = y - startY;

      if (!axis) {
        if (
          Math.abs(dx) < config.axisLockPx &&
          Math.abs(dy) < config.axisLockPx
        ) {
          return false;
        }

        axis = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';

        if (axis !== 'vertical') {
          dragging = false;
          resetGeometry();
          return false;
        }
      }

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const instantVelocity = (y - lastY) / dt;

      velocityY =
        velocityY * (1 - config.velocitySmoothing) +
        instantVelocity * config.velocitySmoothing;

      lastY = y;
      lastTime = now;

      dragY = clamp(dy, -viewportHeight, viewportHeight);
      renderTrack(dragY);

      return true;
    };

    const updateGesture = (x, y) => {
      if (destroyed || !enabled) return false;

      if (takingOver && animating) return updateTakeover(x, y);
      if (dragging && !animating) return updateDrag(x, y);

      return false;
    };

    /* =========================================================
       END GESTURE
       ========================================================= */

    const endGesture = cancelled => {
      if (destroyed || !enabled) return;

      /*
       * Finger was placed during cinematic motion but never took
       * control. Leave the existing animation untouched.
       */
      if (takingOver && animating) {
        takingOver = false;
        axis = null;
        return;
      }

      if (!dragging || animating) return;

      const distance = Math.abs(dragY);

      const threshold = Math.max(
        config.commitMinDistancePx,
        viewportHeight * config.commitDistanceRatio
      );

      const distanceCommit = distance >= threshold;

      const flickCommit =
        distance >= config.flickMinDistancePx &&
        Math.abs(velocityY) >= config.flickVelocityPxMs &&
        Math.sign(velocityY) === Math.sign(dragY);

      if (
        !cancelled &&
        axis === 'vertical' &&
        dragY !== 0 &&
        (distanceCommit || flickCommit)
      ) {
        commit(dragY < 0 ? 1 : -1);
        return;
      }

      if (axis === 'vertical' && dragY !== 0) {
        snapBack();
        return;
      }

      resetGesture();
      resetGeometry();
    };

    /* =========================================================
       EXCLUDED TARGET
       ========================================================= */

    const isExcludedTarget = target =>
      Boolean(
        exclude &&
        target instanceof Element &&
        target.closest(exclude)
      );

    /* =========================================================
       TOUCH
       ========================================================= */

    const handleTouchStart = event => {
      if (
        destroyed ||
        !enabled ||
        event.touches.length !== 1 ||
        isExcludedTarget(event.target)
      ) {
        return;
      }

      const touch = event.touches[0];
      beginGesture(touch.clientX, touch.clientY);
    };

    const handleTouchMove = event => {
      if (
        destroyed ||
        !enabled ||
        event.touches.length !== 1 ||
        (!dragging && !takingOver)
      ) {
        return;
      }

      const touch = event.touches[0];

      if (updateGesture(touch.clientX, touch.clientY)) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = () => endGesture(false);
    const handleTouchCancel = () => endGesture(true);

    /* =========================================================
       POINTER
       ========================================================= */

    const handlePointerDown = event => {
      if (
        destroyed ||
        !enabled ||
        event.pointerType === 'touch' ||
        event.button !== 0 ||
        isExcludedTarget(event.target)
      ) {
        return;
      }

      if (!beginGesture(event.clientX, event.clientY)) return;

      pointerId = event.pointerId;
      viewport.setPointerCapture?.(pointerId);

      event.preventDefault();
    };

    const handlePointerMove = event => {
      if (
        destroyed ||
        !enabled ||
        event.pointerType === 'touch' ||
        pointerId !== event.pointerId ||
        (!dragging && !takingOver)
      ) {
        return;
      }

      if (updateGesture(event.clientX, event.clientY)) {
        event.preventDefault();
      }
    };

    const releasePointer = event => {
      if (viewport.hasPointerCapture?.(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }

      resetPointer();
    };

    const handlePointerUp = event => {
      if (
        event.pointerType === 'touch' ||
        pointerId !== event.pointerId
      ) {
        return;
      }

      releasePointer(event);
      endGesture(false);
    };

    const handlePointerCancel = event => {
      if (
        event.pointerType === 'touch' ||
        pointerId !== event.pointerId
      ) {
        return;
      }

      releasePointer(event);
      endGesture(true);
    };

    /* =========================================================
       LISTENERS
       ========================================================= */

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerup', handlePointerUp);
    viewport.addEventListener('pointercancel', handlePointerCancel);

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const setLayers = nextLayers => {
      if (destroyed) return;

      previous = nextLayers?.previous || previous;
      current = nextLayers?.current || current;
      next = nextLayers?.next || next;

      /*
       * During recycle the swipe engine owns the motion state.
       * Do not cancel an active takeover from inside onCommit().
       */
      if (hasLayers()) {
        viewportHeight = getViewportHeight(viewport);
        renderTrack(0);
      }
    };

    const enable = () => {
      if (destroyed) return;

      enabled = true;
      animating = false;
      motionDirection = 0;

      resetPointer();
      resetGesture();
      resetGeometry();
    };

    const disable = () => {
      if (destroyed) return;

      enabled = false;
      animating = false;
      motionDirection = 0;

      cancelMotion();
      resetPointer();
      resetGesture();

      if (hasLayers()) {
        viewportHeight = getViewportHeight(viewport);
        dragY = 0;

        prepareLayers(false);
        renderTrack(0);
      }
    };

    const reset = () => {
      if (destroyed) return;

      animating = false;
      motionDirection = 0;

      resetPointer();
      resetGesture();
      resetGeometry();
    };

    const resize = () => {
      if (destroyed || !hasLayers()) return;

      viewportHeight = getViewportHeight(viewport);

      if (!dragging && !animating && !takingOver) {
        resetGeometry();
      }
    };

    const destroy = () => {
      if (destroyed) return;

      enabled = false;
      destroyed = true;

      animating = false;
      dragging = false;
      takingOver = false;
      motionDirection = 0;

      cancelMotion();

      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
      viewport.removeEventListener('touchcancel', handleTouchCancel);

      viewport.removeEventListener('pointerdown', handlePointerDown);
      viewport.removeEventListener('pointermove', handlePointerMove);
      viewport.removeEventListener('pointerup', handlePointerUp);
      viewport.removeEventListener('pointercancel', handlePointerCancel);

      layers().forEach(layer => {
        layer.style.transition = '';
        layer.style.willChange = '';
        layer.style.transform = '';
      });

      previous = null;
      current = null;
      next = null;

      resetPointer();
    };

    /* =========================================================
       INITIAL GEOMETRY
       ========================================================= */

    viewportHeight = getViewportHeight(viewport);
    resetGeometry();

    return { setLayers, enable, disable, reset, resize, commit, destroy };
  };

  /* =========================================================
     GLOBAL
     ========================================================= */

  window.VBSwipe = Object.freeze({ create });
})();
