'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — SWIPE ENGINE
   PREVIOUS + CURRENT + NEXT
   ========================================================= */

(() => {
  const DEFAULTS = {
    axisLockPx: 4,
    commitDistanceRatio: 0.10,
    commitMinDistancePx: 28,
    flickMinDistancePx: 10,
    flickVelocityPxMs: 0.20,
    velocitySmoothing: 0.42,

    commitBaseSpeedPxMs: 2.10,
    commitMinSpeedPxMs: 1.65,
    commitMaxSpeedPxMs: 5.20,
    commitMinDurationMs: 150,
    commitMaxDurationMs: 380,

    snapMinDurationMs: 150,
    snapMaxDurationMs: 280,
    maxQueuedSwipes: 6
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const isDirection = direction => direction === 1 || direction === -1;

  const getViewportHeight = viewport => Math.max(
    1,
    viewport?.clientHeight || 0,
    window.visualViewport?.height || 0,
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0
  );

  const create = options => {
    if (!options?.viewport) throw new Error('[VB Swipe] viewport is required.');

    const viewport = options.viewport;
    const exclude = typeof options.exclude === 'string' ? options.exclude : '';
    const onCommit = typeof options.onCommit === 'function' ? options.onCommit : null;
    const config = { ...DEFAULTS, ...(options.config || {}) };

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

    const queue = [];

    /* =========================================================
       LAYERS
       ========================================================= */

    const layers = () => [previous, current, next].filter(Boolean);
    const hasLayers = () => Boolean(previous && current && next);

    const setTransform = (layer, y) => {
      if (layer) layer.style.transform = `translate3d(0,${y.toFixed(3)}px,0)`;
    };

    const setWillChange = value => {
      layers().forEach(layer => {
        layer.style.willChange = value;
        layer.style.transition = 'none';
      });
    };

    const renderTrack = offset => {
      setTransform(previous, -viewportHeight + offset);
      setTransform(current, offset);
      setTransform(next, viewportHeight + offset);
    };

    /* =========================================================
       STATE / GEOMETRY
       ========================================================= */

    const cancelFrame = () => {
      motionToken++;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const resetGesture = () => {
      dragging = false;
      axis = null;
      pointerId = null;
      dragY = 0;
      velocityY = 0;
    };

    const resetGeometry = () => {
      if (destroyed || !hasLayers()) return;

      cancelFrame();
      viewportHeight = getViewportHeight(viewport);
      setWillChange('auto');
      dragY = 0;
      velocityY = 0;
      renderTrack(0);
    };

    const prepareMotion = () => {
      viewportHeight = getViewportHeight(viewport);
      setWillChange('transform');
    };

    /* =========================================================
       QUEUE
       ========================================================= */

    const enqueue = direction => {
      if (!isDirection(direction)) return;

      if (queue.length >= config.maxQueuedSwipes) queue.shift();
      queue.push(direction);
    };

    const runQueue = () => {
      if (destroyed || !enabled || animating || !queue.length) return;

      const direction = queue.shift();

      dragY = 0;
      velocityY = direction > 0 ? -config.commitMaxSpeedPxMs : config.commitMaxSpeedPxMs;

      prepareMotion();
      commit(direction, true);
    };

    /* =========================================================
       ANIMATION
       ========================================================= */

    const animate = (from, to, duration, easing, complete) => {
      cancelFrame();

      const token = motionToken;
      const startedAt = performance.now();
      const distance = to - from;

      setWillChange('transform');

      const frame = now => {
        if (destroyed || !enabled || !animating || token !== motionToken) {
          raf = 0;
          return;
        }

        const progress = clamp((now - startedAt) / Math.max(1, duration), 0, 1);
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

    const getCommitDuration = (remainingDistance, queued) => {
      const speed = clamp(
        Math.max(
          queued ? config.commitMaxSpeedPxMs : config.commitBaseSpeedPxMs,
          Math.abs(velocityY) * 1.45
        ),
        config.commitMinSpeedPxMs,
        config.commitMaxSpeedPxMs
      );

      return clamp(
        remainingDistance / Math.max(config.commitMinSpeedPxMs, speed),
        config.commitMinDurationMs,
        config.commitMaxDurationMs
      );
    };

    /* =========================================================
       COMMIT
       ========================================================= */

    const finishCommit = direction => {
      dragY = 0;
      velocityY = 0;
      dragging = false;
      axis = null;
      animating = false;

      /*
       * gallery.js owns recycling:
       * PREVIOUS <- CURRENT <- NEXT
       * and then returns the new layer references via setLayers().
       */
      onCommit?.(direction);

      if (destroyed || !hasLayers()) return;

      viewportHeight = getViewportHeight(viewport);
      renderTrack(0);
      setWillChange(queue.length ? 'transform' : 'auto');

      if (queue.length) requestAnimationFrame(runQueue);
    };

    function commit(direction, queued = false) {
      if (destroyed || !enabled || !hasLayers() || !isDirection(direction)) return false;

      if (animating) {
        enqueue(direction);
        return true;
      }

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      viewportHeight = getViewportHeight(viewport);
      animating = true;
      dragging = false;

      const destination = direction > 0 ? -viewportHeight : viewportHeight;
      const from = clamp(dragY, -viewportHeight, viewportHeight);
      const remainingDistance = Math.abs(destination - from);
      const duration = getCommitDuration(remainingDistance, queued);

      animate(from, destination, duration, easeOutQuint, () => finishCommit(direction));
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
      setWillChange(queue.length ? 'transform' : 'auto');

      if (queue.length) requestAnimationFrame(runQueue);
    };

    const snapBack = () => {
      if (destroyed || !enabled || animating) return;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      viewportHeight = getViewportHeight(viewport);
      animating = true;
      dragging = false;

      const from = clamp(dragY, -viewportHeight, viewportHeight);
      const ratio = Math.abs(from) / Math.max(1, viewportHeight);
      const duration = clamp(
        config.snapMinDurationMs + ratio * 130,
        config.snapMinDurationMs,
        config.snapMaxDurationMs
      );

      animate(from, 0, duration, easeOutCubic, finishSnapBack);
    };

    /* =========================================================
       GESTURE
       ========================================================= */

    const beginGesture = (x, y) => {
      if (destroyed || !enabled || animating) return false;

      cancelFrame();
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
      if (destroyed || !enabled || !dragging || animating) return false;

      const dx = x - startX;
      const dy = y - startY;

      if (!axis) {
        if (Math.abs(dx) < config.axisLockPx && Math.abs(dy) < config.axisLockPx) return false;

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
      if (destroyed || !enabled || !dragging || animating) return;

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
       INPUT
       ========================================================= */

    const isExcludedTarget = target =>
      Boolean(exclude && target instanceof Element && target.closest(exclude));

    const handleTouchStart = event => {
      if (
        destroyed ||
        !enabled ||
        animating ||
        event.touches.length !== 1 ||
        isExcludedTarget(event.target)
      ) return;

      const touch = event.touches[0];
      beginGesture(touch.clientX, touch.clientY);
    };

    const handleTouchMove = event => {
      if (destroyed || !enabled || !dragging || event.touches.length !== 1) return;

      const touch = event.touches[0];

      if (updateGesture(touch.clientX, touch.clientY)) event.preventDefault();
    };

    const handleTouchEnd = () => endGesture(false);
    const handleTouchCancel = () => endGesture(true);

    const handlePointerDown = event => {
      if (
        destroyed ||
        !enabled ||
        animating ||
        event.pointerType === 'touch' ||
        event.button !== 0 ||
        isExcludedTarget(event.target)
      ) return;

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
        !dragging
      ) return;

      if (updateGesture(event.clientX, event.clientY)) event.preventDefault();
    };

    const releasePointer = event => {
      if (viewport.hasPointerCapture?.(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }

      pointerId = null;
    };

    const handlePointerUp = event => {
      if (event.pointerType === 'touch' || pointerId !== event.pointerId) return;

      releasePointer(event);
      endGesture(false);
    };

    const handlePointerCancel = event => {
      if (event.pointerType === 'touch' || pointerId !== event.pointerId) return;

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
      queue.length = 0;

      resetGesture();
      resetGeometry();
    };

    const disable = () => {
      if (destroyed) return;

      enabled = false;
      animating = false;
      queue.length = 0;

      cancelFrame();
      resetGesture();

      if (hasLayers()) {
        viewportHeight = getViewportHeight(viewport);
        setWillChange('auto');
        renderTrack(0);
      }
    };

    const reset = () => {
      if (destroyed) return;

      animating = false;
      queue.length = 0;

      resetGesture();
      resetGeometry();
    };

    const resize = () => {
      if (destroyed || !hasLayers()) return;

      viewportHeight = getViewportHeight(viewport);

      if (!dragging && !animating) resetGeometry();
    };

    const destroy = () => {
      if (destroyed) return;

      enabled = false;
      destroyed = true;
      animating = false;
      queue.length = 0;

      cancelFrame();

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

    viewportHeight = getViewportHeight(viewport);
    resetGeometry();

    return { setLayers, enable, disable, reset, resize, commit, destroy };
  };

  window.VBSwipe = Object.freeze({ create });
})();
