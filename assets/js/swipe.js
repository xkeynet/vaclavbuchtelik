'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — SWIPE ENGINE
   PREVIOUS + CURRENT + NEXT
   ========================================================= */

(() => {
  const DEFAULTS = {
    axisLockPx: 3,
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

    queueAxisLockPx: 3,
    queueFlickMinDistancePx: 9,
    queueCommitMinDistancePx: 22,
    maxQueuedSwipes: 12
  };

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const easeOutQuint = t =>
    1 - Math.pow(1 - t, 5);

  const easeOutCubic = t =>
    1 - Math.pow(1 - t, 3);

  const getViewportHeight = viewport =>
    Math.max(
      1,
      viewport?.clientHeight || 0,
      window.visualViewport?.height || 0,
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0
    );

  const isValidDirection = direction =>
    direction === 1 || direction === -1;

  /* =========================================================
     CREATE
     ========================================================= */

  const create = options => {
    if (!options?.viewport) {
      throw new Error(
        '[VB Swipe] viewport is required.'
      );
    }

    const viewport = options.viewport;
    const exclude =
      typeof options.exclude === 'string'
        ? options.exclude
        : '';

    const onCommit =
      typeof options.onCommit === 'function'
        ? options.onCommit
        : null;

    const config = {
      ...DEFAULTS,
      ...(options.config || {})
    };

    let previous =
      options.layers?.previous || null;

    let current =
      options.layers?.current || null;

    let next =
      options.layers?.next || null;

    /* =========================================================
       STATE
       ========================================================= */

    let enabled = false;
    let destroyed = false;

    let dragging = false;
    let animating = false;

    let axisLocked = false;
    let verticalGesture = false;

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

    let queueTracking = false;
    let queueAxisLocked = false;
    let queueVerticalGesture = false;

    let queueStartX = 0;
    let queueStartY = 0;

    let queueLastY = 0;
    let queueLastTime = 0;

    let queueDragY = 0;
    let queueVelocityY = 0;

    const swipeQueue = [];

    /* =========================================================
       LAYERS
       ========================================================= */

    const layers = () =>
      [previous, current, next].filter(Boolean);

    const hasLayers = () =>
      Boolean(previous && current && next);

    const setTransform = (layer, y) => {
      if (!layer) return;

      layer.style.transform =
        `translate3d(0,${y.toFixed(3)}px,0)`;
    };

    const disableTransitions = () => {
      layers().forEach(layer => {
        layer.style.transition = 'none';
      });
    };

    const setWillChange = value => {
      layers().forEach(layer => {
        layer.style.willChange = value;
      });
    };

    /* =========================================================
       MOTION
       ========================================================= */

    const clearMotion = () => {
      motionToken++;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const renderTrack = offset => {
      const height =
        viewportHeight ||
        getViewportHeight(viewport);

      setTransform(
        previous,
        -height + offset
      );

      setTransform(
        current,
        offset
      );

      setTransform(
        next,
        height + offset
      );
    };

    const resetGeometry = () => {
      if (
        destroyed ||
        !hasLayers()
      ) {
        return;
      }

      clearMotion();

      viewportHeight =
        getViewportHeight(viewport);

      disableTransitions();
      setWillChange('auto');

      dragY = 0;
      velocityY = 0;

      renderTrack(0);
    };

    const prepareMotionGeometry = () => {
      viewportHeight =
        getViewportHeight(viewport);

      disableTransitions();
      setWillChange('transform');
    };

    /* =========================================================
       DRAG RAF
       ========================================================= */

    const renderDrag = () => {
      raf = 0;

      if (
        destroyed ||
        !enabled ||
        !dragging ||
        !verticalGesture ||
        animating
      ) {
        return;
      }

      dragY = clamp(
        dragY,
        -viewportHeight,
        viewportHeight
      );

      renderTrack(dragY);
    };

    const requestDragRender = () => {
      if (!raf) {
        raf =
          requestAnimationFrame(
            renderDrag
          );
      }
    };

    /* =========================================================
       QUEUE
       ========================================================= */

    const resetQueueGesture = () => {
      queueTracking = false;
      queueAxisLocked = false;
      queueVerticalGesture = false;

      queueStartX = 0;
      queueStartY = 0;

      queueLastY = 0;
      queueLastTime = 0;

      queueDragY = 0;
      queueVelocityY = 0;
    };

    const clearQueue = () => {
      swipeQueue.length = 0;
      resetQueueGesture();
    };

    const enqueue = direction => {
      if (!isValidDirection(direction)) {
        return;
      }

      if (
        swipeQueue.length >=
        config.maxQueuedSwipes
      ) {
        swipeQueue.shift();
      }

      swipeQueue.push(direction);
    };

    const beginQueuedGesture = (x, y) => {
      queueTracking = true;
      queueAxisLocked = false;
      queueVerticalGesture = false;

      queueStartX = x;
      queueStartY = y;

      queueLastY = y;
      queueLastTime =
        performance.now();

      queueDragY = 0;
      queueVelocityY = 0;
    };

    const updateQueuedGesture = (x, y) => {
      if (!queueTracking) {
        return false;
      }

      const rawX =
        x - queueStartX;

      const rawY =
        y - queueStartY;

      if (!queueAxisLocked) {
        if (
          Math.abs(rawX) <
            config.queueAxisLockPx &&
          Math.abs(rawY) <
            config.queueAxisLockPx
        ) {
          return false;
        }

        queueAxisLocked = true;

        queueVerticalGesture =
          Math.abs(rawY) >
          Math.abs(rawX);

        if (!queueVerticalGesture) {
          resetQueueGesture();
          return false;
        }
      }

      if (!queueVerticalGesture) {
        return false;
      }

      const now =
        performance.now();

      const dt =
        Math.max(
          1,
          now - queueLastTime
        );

      const instantVelocity =
        (y - queueLastY) / dt;

      queueVelocityY =
        queueVelocityY *
          (1 - config.velocitySmoothing) +
        instantVelocity *
          config.velocitySmoothing;

      queueLastY = y;
      queueLastTime = now;
      queueDragY = rawY;

      return true;
    };

    const endQueuedGesture = cancelled => {
      if (!queueTracking) {
        return;
      }

      const distance =
        Math.abs(queueDragY);

      const velocity =
        Math.abs(queueVelocityY);

      const distanceCommit =
        distance >=
        config.queueCommitMinDistancePx;

      const flickCommit =
        distance >=
          config.queueFlickMinDistancePx &&
        velocity >=
          config.flickVelocityPxMs &&
        Math.sign(queueVelocityY) ===
          Math.sign(queueDragY);

      if (
        !cancelled &&
        queueVerticalGesture &&
        queueDragY !== 0 &&
        (
          distanceCommit ||
          flickCommit
        )
      ) {
        enqueue(
          queueDragY < 0
            ? 1
            : -1
        );
      }

      resetQueueGesture();
    };

    /* =========================================================
       ANIMATION
       ========================================================= */

    const animateTrack = ({
      from,
      to,
      duration,
      easing,
      onComplete
    }) => {
      clearMotion();

      const token =
        motionToken;

      const startedAt =
        performance.now();

      const distance =
        to - from;

      disableTransitions();
      setWillChange('transform');

      const frame = now => {
        if (
          destroyed ||
          token !== motionToken ||
          !enabled ||
          !animating
        ) {
          raf = 0;
          return;
        }

        const progress =
          clamp(
            (now - startedAt) /
              Math.max(1, duration),
            0,
            1
          );

        const position =
          from +
          distance *
            easing(progress);

        dragY = position;
        renderTrack(position);

        if (progress < 1) {
          raf =
            requestAnimationFrame(
              frame
            );

          return;
        }

        raf = 0;

        dragY = to;
        renderTrack(to);

        onComplete?.();
      };

      raf =
        requestAnimationFrame(frame);
    };

    /* =========================================================
       COMMIT DURATION
       ========================================================= */

    const getCommitDuration = (
      remainingDistance,
      releaseVelocity,
      queued
    ) => {
      const velocity =
        Math.abs(releaseVelocity);

      const speed =
        clamp(
          Math.max(
            queued
              ? config.commitMaxSpeedPxMs
              : config.commitBaseSpeedPxMs,

            velocity * 1.45
          ),
          config.commitMinSpeedPxMs,
          config.commitMaxSpeedPxMs
        );

      return clamp(
        remainingDistance /
          Math.max(
            config.commitMinSpeedPxMs,
            speed
          ),
        config.commitMinDurationMs,
        config.commitMaxDurationMs
      );
    };

    /* =========================================================
       FINISH COMMIT
       IMPORTANT:
       GALLERY OWNS LAYER RECYCLING.
       SWIPE ENGINE ONLY ANIMATES.
       ========================================================= */

    const finishCommit = direction => {
      disableTransitions();

      dragY = 0;
      velocityY = 0;

      dragging = false;
      axisLocked = false;
      verticalGesture = false;

      animating = false;

      /*
       * gallery.js recycles layer references inside
       * onCommit(). After that it calls setLayers().
       */
      onCommit?.(direction);

      /*
       * setLayers() may already have reset geometry.
       * Reset once more against the current references
       * to guarantee PREVIOUS/CURRENT/NEXT positions.
       */
      viewportHeight =
        getViewportHeight(viewport);

      renderTrack(0);

      setWillChange(
        swipeQueue.length
          ? 'transform'
          : 'auto'
      );

      if (swipeQueue.length) {
        requestAnimationFrame(
          runQueuedCommit
        );
      }
    };

    /* =========================================================
       COMMIT
       ========================================================= */

    const commit = (
      direction,
      queued = false
    ) => {
      if (
        destroyed ||
        !enabled ||
        !hasLayers() ||
        !isValidDirection(direction)
      ) {
        return false;
      }

      if (animating) {
        enqueue(direction);
        return true;
      }

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      viewportHeight =
        getViewportHeight(viewport);

      animating = true;
      dragging = false;

      const destination =
        direction > 0
          ? -viewportHeight
          : viewportHeight;

      const from =
        clamp(
          dragY,
          -viewportHeight,
          viewportHeight
        );

      const remainingDistance =
        Math.abs(
          destination - from
        );

      const duration =
        getCommitDuration(
          remainingDistance,
          velocityY,
          queued
        );

      animateTrack({
        from,
        to: destination,
        duration,
        easing: easeOutQuint,
        onComplete: () =>
          finishCommit(direction)
      });

      return true;
    };

    /* =========================================================
       QUEUED COMMIT
       ========================================================= */

    function runQueuedCommit() {
      if (
        destroyed ||
        !enabled ||
        animating ||
        !swipeQueue.length
      ) {
        return;
      }

      const direction =
        swipeQueue.shift();

      viewportHeight =
        getViewportHeight(viewport);

      dragY = 0;

      velocityY =
        direction > 0
          ? -config.commitMaxSpeedPxMs
          : config.commitMaxSpeedPxMs;

      prepareMotionGeometry();

      commit(
        direction,
        true
      );
    }

    /* =========================================================
       SNAP BACK
       ========================================================= */

    const finishSnapBack = () => {
      disableTransitions();

      dragY = 0;
      velocityY = 0;

      dragging = false;
      axisLocked = false;
      verticalGesture = false;

      animating = false;

      renderTrack(0);

      setWillChange(
        swipeQueue.length
          ? 'transform'
          : 'auto'
      );

      if (swipeQueue.length) {
        requestAnimationFrame(
          runQueuedCommit
        );
      }
    };

    const snapBack = () => {
      if (
        destroyed ||
        !enabled ||
        animating
      ) {
        return;
      }

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      viewportHeight =
        getViewportHeight(viewport);

      animating = true;
      dragging = false;

      const from =
        clamp(
          dragY,
          -viewportHeight,
          viewportHeight
        );

      const distanceRatio =
        Math.abs(from) /
        Math.max(
          1,
          viewportHeight
        );

      const duration =
        clamp(
          config.snapMinDurationMs +
            distanceRatio * 130,
          config.snapMinDurationMs,
          config.snapMaxDurationMs
        );

      animateTrack({
        from,
        to: 0,
        duration,
        easing: easeOutCubic,
        onComplete:
          finishSnapBack
      });
    };

    /* =========================================================
       GESTURE
       ========================================================= */

    const beginGesture = (x, y) => {
      if (
        destroyed ||
        !enabled
      ) {
        return false;
      }

      if (animating) {
        beginQueuedGesture(x, y);
        return true;
      }

      clearMotion();
      prepareMotionGeometry();

      dragging = true;
      axisLocked = false;
      verticalGesture = false;

      startX = x;
      startY = y;

      lastY = y;
      lastTime =
        performance.now();

      dragY = 0;
      velocityY = 0;

      return true;
    };

    const updateGesture = (x, y) => {
      if (
        destroyed ||
        !enabled
      ) {
        return false;
      }

      if (animating) {
        return updateQueuedGesture(
          x,
          y
        );
      }

      if (!dragging) {
        return false;
      }

      const rawX =
        x - startX;

      const rawY =
        y - startY;

      if (!axisLocked) {
        if (
          Math.abs(rawX) <
            config.axisLockPx &&
          Math.abs(rawY) <
            config.axisLockPx
        ) {
          return false;
        }

        axisLocked = true;

        verticalGesture =
          Math.abs(rawY) >
          Math.abs(rawX);

        if (!verticalGesture) {
          dragging = false;
          resetGeometry();
          return false;
        }
      }

      if (!verticalGesture) {
        return false;
      }

      const now =
        performance.now();

      const dt =
        Math.max(
          1,
          now - lastTime
        );

      const instantVelocity =
        (y - lastY) / dt;

      velocityY =
        velocityY *
          (1 - config.velocitySmoothing) +
        instantVelocity *
          config.velocitySmoothing;

      lastY = y;
      lastTime = now;

      dragY =
        clamp(
          rawY,
          -viewportHeight,
          viewportHeight
        );

      requestDragRender();

      return true;
    };

    const endGesture = cancelled => {
      if (
        destroyed ||
        !enabled
      ) {
        return;
      }

      if (animating) {
        endQueuedGesture(
          cancelled
        );

        return;
      }

      if (!dragging) {
        return;
      }

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;

        if (verticalGesture) {
          renderTrack(dragY);
        }
      }

      const distance =
        Math.abs(dragY);

      const threshold =
        Math.max(
          config.commitMinDistancePx,
          viewportHeight *
            config.commitDistanceRatio
        );

      const distanceCommit =
        distance >= threshold;

      const flickCommit =
        distance >=
          config.flickMinDistancePx &&
        Math.abs(velocityY) >=
          config.flickVelocityPxMs &&
        Math.sign(velocityY) ===
          Math.sign(dragY);

      const direction =
        dragY < 0
          ? 1
          : -1;

      if (
        !cancelled &&
        verticalGesture &&
        dragY !== 0 &&
        (
          distanceCommit ||
          flickCommit
        )
      ) {
        commit(direction);
        return;
      }

      if (
        verticalGesture &&
        dragY !== 0
      ) {
        snapBack();
        return;
      }

      dragY = 0;
      velocityY = 0;

      dragging = false;
      axisLocked = false;
      verticalGesture = false;

      resetGeometry();

      if (swipeQueue.length) {
        requestAnimationFrame(
          runQueuedCommit
        );
      }
    };

    /* =========================================================
       EXCLUDED TARGET
       ========================================================= */

    const isExcludedTarget = target => {
      if (
        !exclude ||
        !(target instanceof Element)
      ) {
        return false;
      }

      return Boolean(
        target.closest(exclude)
      );
    };

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

      const touch =
        event.touches[0];

      beginGesture(
        touch.clientX,
        touch.clientY
      );
    };

    const handleTouchMove = event => {
      if (
        destroyed ||
        !enabled ||
        event.touches.length !== 1 ||
        (
          !dragging &&
          !queueTracking
        )
      ) {
        return;
      }

      const touch =
        event.touches[0];

      const consumed =
        updateGesture(
          touch.clientX,
          touch.clientY
        );

      if (consumed) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      endGesture(false);
    };

    const handleTouchCancel = () => {
      endGesture(true);
    };

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

      if (
        !beginGesture(
          event.clientX,
          event.clientY
        )
      ) {
        return;
      }

      pointerId =
        event.pointerId;

      viewport.setPointerCapture?.(
        pointerId
      );

      event.preventDefault();
    };

    const handlePointerMove = event => {
      if (
        destroyed ||
        !enabled ||
        event.pointerType === 'touch' ||
        pointerId !==
          event.pointerId ||
        (
          !dragging &&
          !queueTracking
        )
      ) {
        return;
      }

      const consumed =
        updateGesture(
          event.clientX,
          event.clientY
        );

      if (consumed) {
        event.preventDefault();
      }
    };

    const releasePointer = event => {
      if (
        viewport.hasPointerCapture?.(
          event.pointerId
        )
      ) {
        viewport.releasePointerCapture(
          event.pointerId
        );
      }

      pointerId = null;
    };

    const handlePointerUp = event => {
      if (
        event.pointerType === 'touch' ||
        pointerId !==
          event.pointerId
      ) {
        return;
      }

      releasePointer(event);
      endGesture(false);
    };

    const handlePointerCancel = event => {
      if (
        event.pointerType === 'touch' ||
        pointerId !==
          event.pointerId
      ) {
        return;
      }

      releasePointer(event);
      endGesture(true);
    };

    /* =========================================================
       LISTENERS
       ========================================================= */

    viewport.addEventListener(
      'touchstart',
      handleTouchStart,
      { passive: true }
    );

    viewport.addEventListener(
      'touchmove',
      handleTouchMove,
      { passive: false }
    );

    viewport.addEventListener(
      'touchend',
      handleTouchEnd,
      { passive: true }
    );

    viewport.addEventListener(
      'touchcancel',
      handleTouchCancel,
      { passive: true }
    );

    viewport.addEventListener(
      'pointerdown',
      handlePointerDown
    );

    viewport.addEventListener(
      'pointermove',
      handlePointerMove
    );

    viewport.addEventListener(
      'pointerup',
      handlePointerUp
    );

    viewport.addEventListener(
      'pointercancel',
      handlePointerCancel
    );

    /* =========================================================
       PUBLIC API — SET LAYERS
       ========================================================= */

    const setLayers = nextLayers => {
      if (destroyed) {
        return;
      }

      previous =
        nextLayers?.previous ||
        previous;

      current =
        nextLayers?.current ||
        current;

      next =
        nextLayers?.next ||
        next;

      if (hasLayers()) {
        resetGeometry();
      }
    };

    /* =========================================================
       PUBLIC API — ENABLE
       ========================================================= */

    const enable = () => {
      if (destroyed) {
        return;
      }

      enabled = true;

      clearMotion();
      clearQueue();

      dragging = false;
      animating = false;

      axisLocked = false;
      verticalGesture = false;

      pointerId = null;

      dragY = 0;
      velocityY = 0;

      viewportHeight =
        getViewportHeight(viewport);

      resetGeometry();
    };

    /* =========================================================
       PUBLIC API — DISABLE
       ========================================================= */

    const disable = () => {
      if (destroyed) {
        return;
      }

      enabled = false;

      clearMotion();
      clearQueue();

      dragging = false;
      animating = false;

      axisLocked = false;
      verticalGesture = false;

      pointerId = null;

      dragY = 0;
      velocityY = 0;

      if (hasLayers()) {
        disableTransitions();
        setWillChange('auto');

        viewportHeight =
          getViewportHeight(viewport);

        renderTrack(0);
      }
    };

    /* =========================================================
       PUBLIC API — RESET
       ========================================================= */

    const reset = () => {
      if (destroyed) {
        return;
      }

      clearMotion();
      clearQueue();

      dragging = false;
      animating = false;

      axisLocked = false;
      verticalGesture = false;

      pointerId = null;

      dragY = 0;
      velocityY = 0;

      resetGeometry();
    };

    /* =========================================================
       PUBLIC API — RESIZE
       ========================================================= */

    const resize = () => {
      if (
        destroyed ||
        !hasLayers()
      ) {
        return;
      }

      if (
        dragging ||
        animating
      ) {
        viewportHeight =
          getViewportHeight(viewport);

        return;
      }

      viewportHeight =
        getViewportHeight(viewport);

      resetGeometry();
    };

    /* =========================================================
       DESTROY
       ========================================================= */

    const destroy = () => {
      if (destroyed) {
        return;
      }

      enabled = false;
      destroyed = true;

      clearMotion();
      clearQueue();

      viewport.removeEventListener(
        'touchstart',
        handleTouchStart
      );

      viewport.removeEventListener(
        'touchmove',
        handleTouchMove
      );

      viewport.removeEventListener(
        'touchend',
        handleTouchEnd
      );

      viewport.removeEventListener(
        'touchcancel',
        handleTouchCancel
      );

      viewport.removeEventListener(
        'pointerdown',
        handlePointerDown
      );

      viewport.removeEventListener(
        'pointermove',
        handlePointerMove
      );

      viewport.removeEventListener(
        'pointerup',
        handlePointerUp
      );

      viewport.removeEventListener(
        'pointercancel',
        handlePointerCancel
      );

      layers().forEach(layer => {
        layer.style.transition = '';
        layer.style.willChange = '';
      });

      previous = null;
      current = null;
      next = null;

      pointerId = null;
    };

    /* =========================================================
       INITIAL GEOMETRY
       ========================================================= */

    viewportHeight =
      getViewportHeight(viewport);

    resetGeometry();

    /* =========================================================
       API
       ========================================================= */

    return {
      setLayers,
      enable,
      disable,
      reset,
      resize,
      commit,
      destroy
    };
  };

  /* =========================================================
     GLOBAL
     ========================================================= */

  window.VBSwipe = Object.freeze({
    create
  });
})();
