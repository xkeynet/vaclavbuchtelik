'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — SWIPE ENGINE
   PREVIOUS + CURRENT + NEXT
   CINEMATIC MOTION + INPUT BUFFER
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
    cinematicTailStrength: 0.16
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

    let enabled = false;
    let destroyed = false;
    let dragging = false;
    let animating = false;
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

    /* =========================================================
       BUFFERED GESTURE
       ========================================================= */

    let bufferTracking = false;
    let bufferAxis = null;
    let bufferStartX = 0;
    let bufferStartY = 0;
    let bufferLastY = 0;
    let bufferLastTime = 0;
    let bufferDragY = 0;
    let bufferVelocityY = 0;
    let bufferedDirection = 0;

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
       MOTION STATE
       ========================================================= */

    const cancelMotion = () => {
      motionToken++;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const resetGestureState = () => {
      dragging = false;
      axis = null;
      pointerId = null;
      dragY = 0;
      velocityY = 0;
    };

    const resetBufferGesture = () => {
      bufferTracking = false;
      bufferAxis = null;

      bufferStartX = 0;
      bufferStartY = 0;
      bufferLastY = 0;
      bufferLastTime = 0;

      bufferDragY = 0;
      bufferVelocityY = 0;
    };

    const clearBuffer = () => {
      resetBufferGesture();
      bufferedDirection = 0;
    };

    const resetGeometry = () => {
      if (destroyed || !hasLayers()) return;

      cancelMotion();

      viewportHeight = getViewportHeight(viewport);
      dragY = 0;
      velocityY = 0;

      prepareLayers(false);
      renderTrack(0);
    };

    const prepareMotion = () => {
      viewportHeight = getViewportHeight(viewport);
      prepareLayers(true);
    };

    /* =========================================================
       RAF MOTION
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

        const elapsed = now - startedAt;
        const progress = clamp(elapsed / Math.max(1, duration), 0, 1);
        const eased = easing(progress);

        dragY = from + distance * eased;
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
       CINEMATIC COMMIT DURATION
       ========================================================= */

    const getCommitDuration = remainingDistance => {
      const distanceRatio = clamp(
        remainingDistance / Math.max(1, viewportHeight),
        0,
        1
      );

      const releaseSpeed = Math.abs(velocityY);

      const velocityReduction = clamp(
        releaseSpeed * config.commitVelocityInfluence * 100,
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
       BUFFERED INPUT
       ========================================================= */

    const beginBufferedGesture = (x, y) => {
      if (destroyed || !enabled || !animating) return false;

      bufferTracking = true;
      bufferAxis = null;

      bufferStartX = x;
      bufferStartY = y;

      bufferLastY = y;
      bufferLastTime = performance.now();

      bufferDragY = 0;
      bufferVelocityY = 0;

      return true;
    };

    const updateBufferedGesture = (x, y) => {
      if (
        destroyed ||
        !enabled ||
        !animating ||
        !bufferTracking
      ) {
        return false;
      }

      const dx = x - bufferStartX;
      const dy = y - bufferStartY;

      if (!bufferAxis) {
        if (
          Math.abs(dx) < config.axisLockPx &&
          Math.abs(dy) < config.axisLockPx
        ) {
          return false;
        }

        bufferAxis = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';

        if (bufferAxis !== 'vertical') {
          resetBufferGesture();
          return false;
        }
      }

      const now = performance.now();
      const dt = Math.max(1, now - bufferLastTime);
      const instantVelocity = (y - bufferLastY) / dt;

      bufferVelocityY =
        bufferVelocityY * (1 - config.velocitySmoothing) +
        instantVelocity * config.velocitySmoothing;

      bufferLastY = y;
      bufferLastTime = now;
      bufferDragY = dy;

      return true;
    };

    const endBufferedGesture = cancelled => {
      if (!bufferTracking) return;

      const distance = Math.abs(bufferDragY);

      const threshold = Math.max(
        config.commitMinDistancePx,
        viewportHeight * config.commitDistanceRatio
      );

      const distanceCommit = distance >= threshold;

      const flickCommit =
        distance >= config.flickMinDistancePx &&
        Math.abs(bufferVelocityY) >= config.flickVelocityPxMs &&
        Math.sign(bufferVelocityY) === Math.sign(bufferDragY);

      if (
        !cancelled &&
        bufferAxis === 'vertical' &&
        bufferDragY !== 0 &&
        (distanceCommit || flickCommit)
      ) {
        bufferedDirection = bufferDragY < 0 ? 1 : -1;
      }

      resetBufferGesture();
    };

    /* =========================================================
       COMMIT
       ========================================================= */

    const runBufferedCommit = () => {
      if (
        destroyed ||
        !enabled ||
        animating ||
        !isDirection(bufferedDirection)
      ) {
        return;
      }

      const direction = bufferedDirection;
      bufferedDirection = 0;

      dragY = 0;
      velocityY = 0;

      commit(direction);
    };

    const finishCommit = direction => {
      dragY = 0;
      velocityY = 0;
      dragging = false;
      axis = null;
      animating = false;

      /*
       * gallery.js owns PREVIOUS / CURRENT / NEXT recycling.
       * After recycling it returns the current references
       * through setLayers().
       */
      onCommit?.(direction);

      if (destroyed || !hasLayers()) return;

      viewportHeight = getViewportHeight(viewport);
      renderTrack(0);

      if (isDirection(bufferedDirection)) {
        prepareLayers(true);
        requestAnimationFrame(runBufferedCommit);
        return;
      }

      prepareLayers(false);
    };

    function commit(direction) {
      if (
        destroyed ||
        !enabled ||
        !hasLayers() ||
        !isDirection(direction)
      ) {
        return false;
      }

      if (animating) {
        bufferedDirection = direction;
        return true;
      }

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      viewportHeight = getViewportHeight(viewport);

      const destination = direction > 0 ? -viewportHeight : viewportHeight;
      const from = clamp(dragY, -viewportHeight, viewportHeight);
      const remainingDistance = Math.abs(destination - from);

      animating = true;
      dragging = false;

      animate({
        from,
        to: destination,
        duration: getCommitDuration(remainingDistance),
        easing: cinematicEase,
        complete: () => finishCommit(direction)
      });

      return true;
    }

    /* =========================================================
       SNAP BACK
       ========================================================= */

    const finishSnapBack = () => {
      dragY = 0;
      velocityY = 0;
      dragging = false;
      axis = null;
      animating = false;

      renderTrack(0);

      if (isDirection(bufferedDirection)) {
        prepareLayers(true);
        requestAnimationFrame(runBufferedCommit);
        return;
      }

      prepareLayers(false);
    };

    const snapBack = () => {
      if (destroyed || !enabled || animating) return;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      viewportHeight = getViewportHeight(viewport);

      const from = clamp(dragY, -viewportHeight, viewportHeight);
      const distanceRatio = Math.abs(from) / Math.max(1, viewportHeight);

      const duration = clamp(
        config.snapMinDurationMs +
          distanceRatio *
            (config.snapMaxDurationMs - config.snapMinDurationMs),
        config.snapMinDurationMs,
        config.snapMaxDurationMs
      );

      animating = true;
      dragging = false;

      animate({
        from,
        to: 0,
        duration,
        easing: easeOutCubic,
        complete: finishSnapBack
      });
    };

    /* =========================================================
       GESTURE
       ========================================================= */

    const beginGesture = (x, y) => {
      if (destroyed || !enabled) return false;

      if (animating) {
        return beginBufferedGesture(x, y);
      }

      cancelMotion();
      prepareMotion();

      dragging = true;
      axis = null;

      startX = x;
      startY = y;

      lastY = y;
      lastTime = performance.now();

      dragY = 0;
      velocityY = 0;

      return true;
    };

    const updateGesture = (x, y) => {
      if (destroyed || !enabled) return false;

      if (animating) {
        return updateBufferedGesture(x, y);
      }

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

    const endGesture = cancelled => {
      if (destroyed || !enabled) return;

      if (animating) {
        endBufferedGesture(cancelled);
        return;
      }

      if (!dragging) return;

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

      resetGestureState();
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
        (!dragging && !bufferTracking)
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
        (!dragging && !bufferTracking)
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

      pointerId = null;
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

      if (hasLayers()) resetGeometry();
    };

    const enable = () => {
      if (destroyed) return;

      enabled = true;
      animating = false;

      clearBuffer();
      resetGestureState();
      resetGeometry();
    };

    const disable = () => {
      if (destroyed) return;

      enabled = false;
      animating = false;

      cancelMotion();
      clearBuffer();
      resetGestureState();

      if (hasLayers()) {
        viewportHeight = getViewportHeight(viewport);
        prepareLayers(false);
        renderTrack(0);
      }
    };

    const reset = () => {
      if (destroyed) return;

      animating = false;

      clearBuffer();
      resetGestureState();
      resetGeometry();
    };

    const resize = () => {
      if (destroyed || !hasLayers()) return;

      viewportHeight = getViewportHeight(viewport);

      if (!dragging && !animating) {
        resetGeometry();
      }
    };

    const destroy = () => {
      if (destroyed) return;

      enabled = false;
      destroyed = true;
      animating = false;

      cancelMotion();
      clearBuffer();

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
      pointerId = null;
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
