'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY
   CINEMATIC FULLSCREEN ARTWORK SWIPE
   PREVIOUS + CURRENT + NEXT
   RAF MOTION ENGINE
   ========================================================= */

(() => {
  /* =========================================================
     MOTION
     ========================================================= */

  const AXIS_LOCK_PX = 6;
  const COMMIT_DISTANCE_RATIO = 0.18;
  const COMMIT_MIN_DISTANCE_PX = 54;
  const FLICK_MIN_DISTANCE_PX = 22;
  const FLICK_VELOCITY_PX_MS = 0.38;

  const VELOCITY_SMOOTHING = 0.34;
  const COMMIT_BASE_SPEED_PX_MS = 1.45;
  const COMMIT_MIN_SPEED_PX_MS = 1.10;
  const COMMIT_MAX_SPEED_PX_MS = 3.20;
  const COMMIT_MIN_DURATION_MS = 220;
  const COMMIT_MAX_DURATION_MS = 520;

  const SNAP_MIN_DURATION_MS = 180;
  const SNAP_MAX_DURATION_MS = 340;

  /* =========================================================
     STATE
     ========================================================= */

  let art = [];

  let gallery = null;
  let viewport = null;
  let backButton = null;

  let layerPrev = null;
  let layerCurrent = null;
  let layerNext = null;

  let currentIndex = 0;

  let isOpen = false;
  let isAnimating = false;
  let dragging = false;
  let axisLocked = false;
  let verticalGesture = false;

  let pointerId = null;

  let startX = 0;
  let startY = 0;

  let lastY = 0;
  let lastTime = 0;
  let velocityY = 0;

  let dragY = 0;
  let viewportHeight = 1;

  let raf = 0;
  let motionToken = 0;

  let previousBodyOverflow = '';
  let previousHtmlOverflow = '';
  let previousBodyTouchAction = '';

  const preloadedImages = new Map();

  /* =========================================================
     HELPERS
     ========================================================= */

  const createElement = (tag, className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  const normalizeIndex = index => {
    if (!art.length) return 0;
    return ((index % art.length) + art.length) % art.length;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const getViewportHeight = () => Math.max(
    1,
    window.visualViewport?.height || 0,
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0
  );

  const setTransform = (layer, y) => {
    if (!layer) return;
    layer.style.transform = `translate3d(0,${y.toFixed(3)}px,0)`;
  };

  const disableTransitions = () => {
    [layerPrev, layerCurrent, layerNext].forEach(layer => {
      if (!layer) return;
      layer.style.transition = 'none';
    });
  };

  const setWillChange = value => {
    [layerPrev, layerCurrent, layerNext].forEach(layer => {
      if (layer) layer.style.willChange = value;
    });
  };

  const clearMotion = () => {
    motionToken++;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  /* =========================================================
     EASING
     ========================================================= */

  const easeOutQuint = t => 1 - Math.pow(1 - t, 5);

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  /* =========================================================
     IMAGE PRELOAD
     ========================================================= */

  const preloadArtwork = artwork => {
    if (!artwork?.src || preloadedImages.has(artwork.src)) return;

    const image = new Image();

    image.decoding = 'async';
    image.src = artwork.src;

    preloadedImages.set(artwork.src, image);

    if (typeof image.decode === 'function') {
      image.decode().catch(() => {});
    }
  };

  const preloadAround = index => {
    if (!art.length) return;

    [
      normalizeIndex(index - 2),
      normalizeIndex(index - 1),
      normalizeIndex(index),
      normalizeIndex(index + 1),
      normalizeIndex(index + 2)
    ].forEach(i => preloadArtwork(art[i]));
  };

  /* =========================================================
     LAYER
     ========================================================= */

  const createLayer = position => {
    const layer = createElement(
      'article',
      `gallery-viewer__layer gallery-viewer__layer--${position}`
    );

    const media = createElement('div', 'gallery-viewer__media');
    const image = createElement('img', 'gallery-viewer__image');
    const meta = createElement('div', 'gallery-viewer__meta');
    const title = createElement('div', 'gallery-viewer__title');
    const details = createElement('div', 'gallery-viewer__details');

    layer.dataset.position = position;

    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;

    media.appendChild(image);
    meta.append(title, details);
    layer.append(media, meta);

    return layer;
  };

  const setLayerArtwork = (layer, artwork, index) => {
    if (!layer || !artwork) return;

    const image = layer.querySelector('.gallery-viewer__image');
    const title = layer.querySelector('.gallery-viewer__title');
    const details = layer.querySelector('.gallery-viewer__details');

    layer.dataset.index = String(index);
    layer.dataset.artId = String(artwork.id ?? '');

    if (image) {
      const absoluteSrc = new URL(artwork.src, window.location.href).href;

      if (image.src !== absoluteSrc) {
        image.src = artwork.src;
      }

      image.alt = artwork.title || '';
    }

    if (title) title.textContent = artwork.title || '';

    if (details) {
      details.textContent = artwork.details || '';
      details.hidden = !artwork.details;
    }
  };

  /* =========================================================
     CONTENT
     ========================================================= */

  const syncContent = () => {
    if (!art.length) return;

    const previousIndex = normalizeIndex(currentIndex - 1);
    const nextIndex = normalizeIndex(currentIndex + 1);

    setLayerArtwork(layerPrev, art[previousIndex], previousIndex);
    setLayerArtwork(layerCurrent, art[currentIndex], currentIndex);
    setLayerArtwork(layerNext, art[nextIndex], nextIndex);

    preloadAround(currentIndex);
  };

  /* =========================================================
     GEOMETRY
     ========================================================= */

  const renderTrack = offset => {
    const height = viewportHeight || getViewportHeight();

    setTransform(layerPrev, -height + offset);
    setTransform(layerCurrent, offset);
    setTransform(layerNext, height + offset);
  };

  const resetLayerGeometry = () => {
    if (!layerPrev || !layerCurrent || !layerNext) return;

    viewportHeight = getViewportHeight();

    disableTransitions();
    setWillChange('auto');

    renderTrack(0);
  };

  const prepareMotionGeometry = () => {
    viewportHeight = getViewportHeight();

    disableTransitions();
    setWillChange('transform');
  };

  /* =========================================================
     DRAG RENDER
     ========================================================= */

  const renderDrag = () => {
    raf = 0;

    if (!dragging || !verticalGesture) return;

    const height = viewportHeight || getViewportHeight();
    renderTrack(clamp(dragY, -height, height));
  };

  const requestDragRender = () => {
    if (!raf) raf = requestAnimationFrame(renderDrag);
  };

  /* =========================================================
     RAF ANIMATION
     ========================================================= */

  const animateTrack = ({
    from,
    to,
    duration,
    easing,
    onComplete
  }) => {
    clearMotion();

    const token = motionToken;
    const startedAt = performance.now();
    const distance = to - from;

    disableTransitions();
    setWillChange('transform');

    const frame = now => {
      if (
        token !== motionToken ||
        !isOpen ||
        !isAnimating
      ) {
        raf = 0;
        return;
      }

      const elapsed = now - startedAt;
      const progress = clamp(elapsed / duration, 0, 1);
      const eased = easing(progress);
      const position = from + distance * eased;

      dragY = position;
      renderTrack(position);

      if (progress < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }

      raf = 0;
      dragY = to;
      renderTrack(to);

      requestAnimationFrame(() => {
        if (
          token !== motionToken ||
          !isOpen ||
          !isAnimating
        ) {
          return;
        }

        onComplete?.();
      });
    };

    raf = requestAnimationFrame(frame);
  };

  /* =========================================================
     RECYCLE
     ========================================================= */

  const recycleForward = () => {
    const oldPrevious = layerPrev;

    layerPrev = layerCurrent;
    layerCurrent = layerNext;
    layerNext = oldPrevious;

    currentIndex = normalizeIndex(currentIndex + 1);
  };

  const recycleBackward = () => {
    const oldNext = layerNext;

    layerNext = layerCurrent;
    layerCurrent = layerPrev;
    layerPrev = oldNext;

    currentIndex = normalizeIndex(currentIndex - 1);
  };

  const finishCommit = direction => {
    if (direction > 0) {
      recycleForward();
    } else {
      recycleBackward();
    }

    /*
       The recycled DOM layers are repositioned first.
       Content is then updated while all transitions are disabled.
    */

    disableTransitions();

    viewportHeight = getViewportHeight();
    renderTrack(0);

    syncContent();

    dragY = 0;
    velocityY = 0;
    dragging = false;
    axisLocked = false;
    verticalGesture = false;
    isAnimating = false;

    setWillChange('auto');

    window.dispatchEvent(
      new CustomEvent('vb:gallery-slide-change', {
        detail: {
          index: currentIndex,
          artwork: art[currentIndex]
        }
      })
    );
  };

  /* =========================================================
     COMMIT DURATION
     ========================================================= */

  const getCommitDuration = (remainingDistance, releaseVelocity) => {
    const velocity = Math.abs(releaseVelocity);

    const speed = clamp(
      Math.max(
        COMMIT_BASE_SPEED_PX_MS,
        velocity * 1.35
      ),
      COMMIT_MIN_SPEED_PX_MS,
      COMMIT_MAX_SPEED_PX_MS
    );

    const duration = remainingDistance / speed;

    return clamp(
      duration,
      COMMIT_MIN_DURATION_MS,
      COMMIT_MAX_DURATION_MS
    );
  };

  /* =========================================================
     COMMIT
     ========================================================= */

  const commit = direction => {
    if (
      !isOpen ||
      isAnimating ||
      !layerCurrent ||
      !layerPrev ||
      !layerNext
    ) {
      return;
    }

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    isAnimating = true;
    dragging = false;

    const height = viewportHeight || getViewportHeight();
    const destination = direction > 0 ? -height : height;

    const from = clamp(dragY, -height, height);
    const remainingDistance = Math.abs(destination - from);

    const duration = getCommitDuration(
      remainingDistance,
      velocityY
    );

    animateTrack({
      from,
      to: destination,
      duration,
      easing: easeOutQuint,
      onComplete: () => finishCommit(direction)
    });
  };

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
    isAnimating = false;

    renderTrack(0);
    setWillChange('auto');
  };

  const snapBack = () => {
    if (!isOpen || isAnimating) return;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    isAnimating = true;
    dragging = false;

    const height = viewportHeight || getViewportHeight();
    const from = clamp(dragY, -height, height);

    const distanceRatio = Math.abs(from) / Math.max(1, height);

    const duration = clamp(
      SNAP_MIN_DURATION_MS +
      distanceRatio * 180,
      SNAP_MIN_DURATION_MS,
      SNAP_MAX_DURATION_MS
    );

    animateTrack({
      from,
      to: 0,
      duration,
      easing: easeOutCubic,
      onComplete: finishSnapBack
    });
  };

  /* =========================================================
     GESTURE
     ========================================================= */

  const beginGesture = (x, y) => {
    if (!isOpen || isAnimating) return false;

    clearMotion();
    prepareMotionGeometry();

    dragging = true;
    axisLocked = false;
    verticalGesture = false;

    startX = x;
    startY = y;

    lastY = y;
    lastTime = performance.now();

    velocityY = 0;
    dragY = 0;

    return true;
  };

  const updateGesture = (x, y) => {
    if (!dragging || isAnimating) return false;

    const rawX = x - startX;
    const rawY = y - startY;

    if (!axisLocked) {
      if (
        Math.abs(rawX) < AXIS_LOCK_PX &&
        Math.abs(rawY) < AXIS_LOCK_PX
      ) {
        return false;
      }

      axisLocked = true;
      verticalGesture = Math.abs(rawY) > Math.abs(rawX);

      if (!verticalGesture) {
        dragging = false;
        resetLayerGeometry();
        return false;
      }
    }

    if (!verticalGesture) return false;

    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    const instantVelocity = (y - lastY) / dt;

    velocityY =
      velocityY * (1 - VELOCITY_SMOOTHING) +
      instantVelocity * VELOCITY_SMOOTHING;

    lastY = y;
    lastTime = now;

    const height = viewportHeight || getViewportHeight();

    dragY = clamp(rawY, -height, height);

    requestDragRender();

    return true;
  };

  const endGesture = cancelled => {
    if (!dragging || isAnimating) return;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;

      if (verticalGesture) {
        renderTrack(dragY);
      }
    }

    const distance = Math.abs(dragY);
    const height = viewportHeight || getViewportHeight();

    const distanceThreshold = Math.max(
      COMMIT_MIN_DISTANCE_PX,
      height * COMMIT_DISTANCE_RATIO
    );

    const distanceCommit = distance >= distanceThreshold;

    const flickCommit =
      distance >= FLICK_MIN_DISTANCE_PX &&
      Math.abs(velocityY) >= FLICK_VELOCITY_PX_MS &&
      Math.sign(velocityY) === Math.sign(dragY);

    const direction = dragY < 0 ? 1 : -1;

    if (
      !cancelled &&
      verticalGesture &&
      dragY !== 0 &&
      (distanceCommit || flickCommit)
    ) {
      commit(direction);
      return;
    }

    if (verticalGesture && dragY !== 0) {
      snapBack();
      return;
    }

    dragY = 0;
    velocityY = 0;
    dragging = false;
    axisLocked = false;
    verticalGesture = false;

    resetLayerGeometry();
  };

  /* =========================================================
     TOUCH
     ========================================================= */

  const handleTouchStart = event => {
    if (
      !isOpen ||
      isAnimating ||
      event.touches.length !== 1 ||
      event.target.closest('.gallery-viewer__back')
    ) {
      return;
    }

    const touch = event.touches[0];

    beginGesture(
      touch.clientX,
      touch.clientY
    );
  };

  const handleTouchMove = event => {
    if (
      !dragging ||
      isAnimating ||
      event.touches.length !== 1
    ) {
      return;
    }

    const touch = event.touches[0];

    const consumed = updateGesture(
      touch.clientX,
      touch.clientY
    );

    if (consumed) event.preventDefault();
  };

  const handleTouchEnd = () => {
    endGesture(false);
  };

  const handleTouchCancel = () => {
    endGesture(true);
  };

  /* =========================================================
     POINTER / DESKTOP
     ========================================================= */

  const handlePointerDown = event => {
    if (
      !isOpen ||
      isAnimating ||
      event.pointerType === 'touch' ||
      event.button !== 0 ||
      event.target.closest('.gallery-viewer__back')
    ) {
      return;
    }

    if (!beginGesture(event.clientX, event.clientY)) return;

    pointerId = event.pointerId;

    viewport?.setPointerCapture?.(event.pointerId);

    event.preventDefault();
  };

  const handlePointerMove = event => {
    if (
      !dragging ||
      isAnimating ||
      event.pointerType === 'touch' ||
      pointerId !== event.pointerId
    ) {
      return;
    }

    const consumed = updateGesture(
      event.clientX,
      event.clientY
    );

    if (consumed) event.preventDefault();
  };

  const releasePointer = event => {
    if (viewport?.hasPointerCapture?.(event.pointerId)) {
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
     BACK ARROW
     ========================================================= */

  const createBackButton = () => {
    const button = createElement(
      'button',
      'gallery-viewer__back'
    );

    const image = createElement(
      'img',
      'gallery-viewer__back-icon'
    );

    button.type = 'button';
    button.setAttribute(
      'aria-label',
      'Back to menu'
    );

    image.src = '/assets/icons/arrow-left.svg';
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;

    button.appendChild(image);

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      closeGallery();
    });

    return button;
  };

  /* =========================================================
     VIEWER BUILD
     ========================================================= */

  const buildGallery = () => {
    if (gallery) return;

    gallery = createElement(
      'section',
      'gallery-viewer'
    );

    gallery.id = 'galleryViewer';

    gallery.setAttribute(
      'aria-label',
      'Artwork gallery'
    );

    gallery.setAttribute(
      'aria-hidden',
      'true'
    );

    viewport = createElement(
      'div',
      'gallery-viewer__viewport'
    );

    layerPrev = createLayer('previous');
    layerCurrent = createLayer('current');
    layerNext = createLayer('next');

    backButton = createBackButton();

    viewport.append(
      layerPrev,
      layerCurrent,
      layerNext
    );

    gallery.append(
      viewport,
      backButton
    );

    document.body.appendChild(gallery);

    resetLayerGeometry();

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
  };

  /* =========================================================
     KEYBOARD
     ========================================================= */

  const keyboardCommit = direction => {
    if (!isOpen || isAnimating) return;

    viewportHeight = getViewportHeight();
    dragY = 0;
    velocityY = 0;

    prepareMotionGeometry();
    commit(direction);
  };

  const handleKeyDown = event => {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeGallery();
      return;
    }

    if (
      event.key === 'ArrowDown' ||
      event.key === 'PageDown'
    ) {
      event.preventDefault();
      keyboardCommit(1);
      return;
    }

    if (
      event.key === 'ArrowUp' ||
      event.key === 'PageUp'
    ) {
      event.preventDefault();
      keyboardCommit(-1);
    }
  };

  /* =========================================================
     OPEN
     ========================================================= */

  const openGallery = (requestedIndex = 0) => {
    art = Array.isArray(window.ART)
      ? window.ART
      : [];

    if (!art.length) {
      console.error(
        '[VB Gallery] window.ART is empty or art.js is not loaded.'
      );

      return;
    }

    buildGallery();

    if (!gallery) return;

    const parsedIndex = Number(requestedIndex);

    currentIndex = Number.isInteger(parsedIndex)
      ? normalizeIndex(parsedIndex)
      : 0;

    clearMotion();

    isAnimating = false;
    dragging = false;
    axisLocked = false;
    verticalGesture = false;

    pointerId = null;

    dragY = 0;
    velocityY = 0;
    viewportHeight = getViewportHeight();

    syncContent();
    resetLayerGeometry();

    previousBodyOverflow =
      document.body.style.overflow;

    previousHtmlOverflow =
      document.documentElement.style.overflow;

    previousBodyTouchAction =
      document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    gallery.setAttribute(
      'aria-hidden',
      'false'
    );

    gallery.classList.add(
      'is-open'
    );

    isOpen = true;

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    requestAnimationFrame(() => {
      if (!gallery || !isOpen) return;

      gallery.classList.add(
        'is-visible'
      );
    });

    window.dispatchEvent(
      new CustomEvent('vb:gallery-opened', {
        detail: {
          index: currentIndex,
          artwork: art[currentIndex]
        }
      })
    );
  };

  /* =========================================================
     CLOSE
     ========================================================= */

  function closeGallery() {
    if (!gallery || !isOpen) return;

    clearMotion();

    isOpen = false;
    isAnimating = false;
    dragging = false;
    axisLocked = false;
    verticalGesture = false;

    pointerId = null;

    dragY = 0;
    velocityY = 0;

    gallery.classList.remove(
      'is-visible'
    );

    window.removeEventListener(
      'keydown',
      handleKeyDown
    );

    document.body.style.overflow =
      previousBodyOverflow;

    document.documentElement.style.overflow =
      previousHtmlOverflow;

    document.body.style.touchAction =
      previousBodyTouchAction;

    window.setTimeout(() => {
      if (!gallery || isOpen) return;

      gallery.classList.remove(
        'is-open'
      );

      gallery.setAttribute(
        'aria-hidden',
        'true'
      );

      resetLayerGeometry();
    }, 220);

    window.dispatchEvent(
      new CustomEvent('vb:gallery-closed')
    );
  }

  /* =========================================================
     APP EVENTS
     ========================================================= */

  const handleGalleryOpenRequest = event => {
    const requestedIndex = Number(
      event.detail?.index
    );

    openGallery(
      Number.isInteger(requestedIndex)
        ? requestedIndex
        : 0
    );
  };

  window.addEventListener(
    'vb:gallery-open-view',
    handleGalleryOpenRequest
  );

  /* =========================================================
     RESIZE
     ========================================================= */

  const handleResize = () => {
    if (
      !gallery ||
      !isOpen ||
      dragging ||
      isAnimating
    ) {
      return;
    }

    viewportHeight = getViewportHeight();
    resetLayerGeometry();
  };

  window.addEventListener(
    'resize',
    handleResize,
    { passive: true }
  );

  window.addEventListener(
    'orientationchange',
    handleResize,
    { passive: true }
  );

  window.visualViewport?.addEventListener(
    'resize',
    handleResize,
    { passive: true }
  );

  /* =========================================================
     VISIBILITY RECOVERY
     ========================================================= */

  const recoverVisibleState = () => {
    if (!isOpen) return;

    clearMotion();

    isAnimating = false;
    dragging = false;
    axisLocked = false;
    verticalGesture = false;

    pointerId = null;

    dragY = 0;
    velocityY = 0;
    viewportHeight = getViewportHeight();

    syncContent();
    resetLayerGeometry();
  };

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        recoverVisibleState();
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'pageshow',
    recoverVisibleState,
    { passive: true }
  );

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener(
    'pagehide',
    () => {
      clearMotion();

      window.removeEventListener(
        'vb:gallery-open-view',
        handleGalleryOpenRequest
      );

      window.removeEventListener(
        'keydown',
        handleKeyDown
      );

      window.removeEventListener(
        'resize',
        handleResize
      );

      window.removeEventListener(
        'orientationchange',
        handleResize
      );

      window.visualViewport?.removeEventListener(
        'resize',
        handleResize
      );

      isOpen = false;
      isAnimating = false;
      dragging = false;

      pointerId = null;
    },
    { once: true }
  );
})();
