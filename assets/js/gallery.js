'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY
   FULLSCREEN VIRTUALIZED ARTWORK SWIPE
   PREVIOUS + CURRENT + NEXT
   ========================================================= */

(() => {
  const THRESHOLD_RATIO = 0.50;
  const MOVE_ACTIVATE_PX = 3;
  const MIN_COMMIT_DY = 70;
  const MIN_COMMIT_VY = 0.42;
  const BACKWARD_MIN_COMMIT_DY = 55;
  const BACKWARD_MIN_COMMIT_VY = 0.34;
  const DIRECTION_FLIP_DAMPING_PX = 12;
  const QUEUE_MOVE_ACTIVATE_PX = 2;
  const MAX_MOVE_STEP_PX = 260;
  const COMMIT_DURATION_MS = 160;
  const SNAP_DURATION_MS = 200;
  const COMMIT_COOLDOWN_MS = 55;
  const COMMIT_CURVE = 'cubic-bezier(0.15,0.85,0.2,1)';
  const SNAP_CURVE = 'cubic-bezier(0.2,0,0.2,1)';

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
  let touchBlocked = false;

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let lastMoveY = 0;
  let dy = 0;
  let dx = 0;
  let preparedDir = 0;
  let gestureHeight = 0;

  let raf = 0;
  let settleTimer = 0;
  let lastCommitTime = 0;

  let activeCommitDir = 0;
  let activeCommitTargetIndex = null;

  let queuedDir = 0;
  let queueHasStart = false;
  let queueStartX = 0;
  let queueStartY = 0;

  let prevLoadedIndex = null;
  let nextLoadedIndex = null;

  let previousBodyOverflow = '';
  let previousHtmlOverflow = '';

  const preloadedImages = new Map();

  /* =========================================================
     HELPERS
     ========================================================= */

  const createElement = (tag, className = '') => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  };

  const normalizeIndex = index => {
    if (!art.length) return 0;
    return ((index % art.length) + art.length) % art.length;
  };

  const vh = () => Math.max(
    1,
    window.visualViewport?.height || 0,
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0
  );

  const setTransform = (layer, y) => {
    if (layer) layer.style.transform = `translate3d(0,${y}px,0)`;
  };

  const clearAnimation = () => {
    if (raf) cancelAnimationFrame(raf);
    if (settleTimer) clearTimeout(settleTimer);
    raf = 0;
    settleTimer = 0;
  };

  const resetQueue = () => {
    queuedDir = 0;
    queueHasStart = false;
    queueStartX = 0;
    queueStartY = 0;
  };

  const resetActiveCommit = () => {
    activeCommitDir = 0;
    activeCommitTargetIndex = null;
  };

  /* =========================================================
     IMAGE PRELOAD
     ========================================================= */

  const preloadArtwork = artwork => {
    if (!artwork?.src || preloadedImages.has(artwork.src)) return;

    const image = new Image();
    image.decoding = 'async';
    image.src = artwork.src;

    preloadedImages.set(artwork.src, image);
    image.decode?.().catch(() => {});
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
     ARTWORK LAYER
     ========================================================= */

  const createLayer = position => {
    const layer = createElement('article', `gallery-viewer__layer gallery-viewer__layer--${position}`);
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

      if (image.src !== absoluteSrc) image.src = artwork.src;

      image.alt = artwork.title || '';
    }

    if (title) title.textContent = artwork.title || '';

    if (details) {
      details.textContent = artwork.details || '';
      details.hidden = !artwork.details;
    }
  };

  /* =========================================================
     LAYER PREPARATION
     ========================================================= */

  const prepareForwardLayer = (height = vh()) => {
    const targetIndex = normalizeIndex(currentIndex + 1);

    if (nextLoadedIndex !== targetIndex) {
      setLayerArtwork(layerNext, art[targetIndex], targetIndex);
      nextLoadedIndex = targetIndex;
    }

    preloadArtwork(art[targetIndex]);
    layerNext.style.transition = 'none';
    setTransform(layerNext, height);
  };

  const prepareBackwardLayer = (height = vh()) => {
    const targetIndex = normalizeIndex(currentIndex - 1);

    if (prevLoadedIndex !== targetIndex) {
      setLayerArtwork(layerPrev, art[targetIndex], targetIndex);
      prevLoadedIndex = targetIndex;
    }

    preloadArtwork(art[targetIndex]);
    layerPrev.style.transition = 'none';
    setTransform(layerPrev, -height);
  };

  const warmForwardNext = () => {
    if (!isAnimating) prepareForwardLayer();
  };

  const warmBackwardNext = () => {
    if (!isAnimating) prepareBackwardLayer();
  };

  const prepareNextForDirection = dir => {
    const height = gestureHeight || vh();

    if (dir > 0) prepareForwardLayer(height);
    else prepareBackwardLayer(height);

    preparedDir = dir;
  };

  /* =========================================================
     TRANSFORM RESET
     ========================================================= */

  const resetTransformsNoAnim = () => {
    if (!layerPrev || !layerCurrent || !layerNext) return;

    if (raf) cancelAnimationFrame(raf);
    raf = 0;

    const height = vh();

    [layerPrev, layerCurrent, layerNext].forEach(layer => {
      layer.style.transition = 'none';
      layer.style.willChange = 'auto';
    });

    setTransform(layerPrev, -height);
    setTransform(layerCurrent, 0);
    setTransform(layerNext, height);
  };

  /* =========================================================
     INITIAL CONTENT
     ========================================================= */

  const syncInitialContent = () => {
    if (!art.length) return;

    const prevIndex = normalizeIndex(currentIndex - 1);
    const nextIndex = normalizeIndex(currentIndex + 1);

    setLayerArtwork(layerPrev, art[prevIndex], prevIndex);
    setLayerArtwork(layerCurrent, art[currentIndex], currentIndex);
    setLayerArtwork(layerNext, art[nextIndex], nextIndex);

    prevLoadedIndex = prevIndex;
    nextLoadedIndex = nextIndex;

    preloadAround(currentIndex);
  };

  /* =========================================================
     FINISH COMMIT / RECYCLE
     ========================================================= */

  const finishCommit = (dir, targetIndex) => {
    currentIndex = targetIndex;

    if (dir > 0) {
      const oldPrev = layerPrev;
      const oldCurrent = layerCurrent;

      layerCurrent = layerNext;
      layerPrev = oldCurrent;
      layerNext = oldPrev;

      prevLoadedIndex = normalizeIndex(currentIndex - 1);
      nextLoadedIndex = null;
    } else {
      const oldNext = layerNext;
      const oldCurrent = layerCurrent;

      layerCurrent = layerPrev;
      layerNext = oldCurrent;
      layerPrev = oldNext;

      nextLoadedIndex = normalizeIndex(currentIndex + 1);
      prevLoadedIndex = null;
    }

    resetTransformsNoAnim();

    preparedDir = 0;
    dy = 0;
    dx = 0;
    isAnimating = false;
    resetActiveCommit();

    preloadAround(currentIndex);

    window.dispatchEvent(new CustomEvent('vb:gallery-slide-change', {
      detail: { index: currentIndex, artwork: art[currentIndex] }
    }));

    const queued = queuedDir;
    resetQueue();

    requestAnimationFrame(() => {
      warmForwardNext();
      warmBackwardNext();

      if (queued && !isAnimating && isOpen) {
        preparedDir = queued;
        commit(queued);
      }
    });
  };

  /* =========================================================
     INTERRUPT ACTIVE COMMIT
     ========================================================= */

  const interruptActiveCommit = () => {
    if (!isAnimating || !activeCommitDir || activeCommitTargetIndex === null) return false;

    clearAnimation();
    finishCommit(activeCommitDir, activeCommitTargetIndex);

    return true;
  };

  /* =========================================================
     COMMIT
     ========================================================= */

  const commit = dir => {
    if (!isOpen || !art.length) return;

    const now = performance.now();

    if (now - lastCommitTime < COMMIT_COOLDOWN_MS) return;
    if (isAnimating) return;

    const targetIndex = normalizeIndex(currentIndex + dir);
    const targetLayer = dir > 0 ? layerNext : layerPrev;

    if (!targetLayer) return;

    if (dir > 0) prepareForwardLayer(gestureHeight || vh());
    else prepareBackwardLayer(gestureHeight || vh());

    clearAnimation();

    lastCommitTime = now;
    isAnimating = true;

    const height = gestureHeight || vh();

    activeCommitDir = dir;
    activeCommitTargetIndex = targetIndex;

    layerCurrent.style.willChange = 'transform';
    targetLayer.style.willChange = 'transform';

    layerCurrent.style.transition = `transform ${COMMIT_DURATION_MS}ms ${COMMIT_CURVE}`;
    targetLayer.style.transition = `transform ${COMMIT_DURATION_MS}ms ${COMMIT_CURVE}`;

    setTransform(layerCurrent, dir > 0 ? -height : height);
    setTransform(targetLayer, 0);

    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      finishCommit(dir, targetIndex);
    }, COMMIT_DURATION_MS);
  };

  /* =========================================================
     SNAP BACK
     ========================================================= */

  const snapBack = () => {
    if (isAnimating || !isOpen) return;

    clearAnimation();
    resetQueue();

    isAnimating = true;

    const height = gestureHeight || vh();
    const snapDir = preparedDir;
    const targetLayer = preparedDir > 0 ? layerNext : layerPrev;

    layerCurrent.style.transition = `transform ${SNAP_DURATION_MS}ms ${SNAP_CURVE}`;

    if (targetLayer) {
      targetLayer.style.transition = `transform ${SNAP_DURATION_MS}ms ${SNAP_CURVE}`;
    }

    setTransform(layerCurrent, 0);

    if (targetLayer) {
      setTransform(targetLayer, preparedDir > 0 ? height : -height);
    }

    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      preparedDir = 0;
      dy = 0;
      dx = 0;

      resetTransformsNoAnim();
      isAnimating = false;

      if (snapDir < 0) warmBackwardNext();
      else warmForwardNext();
    }, SNAP_DURATION_MS);
  };

  /* =========================================================
     GESTURE END
     ========================================================= */

  const finishGesture = cancelled => {
    if (!dragging || isAnimating) return;

    const totalDy = dy;
    const dt = Math.max(1, performance.now() - startT);
    const height = gestureHeight || vh();

    dragging = false;
    touchBlocked = false;

    if (cancelled || preparedDir === 0) {
      if (preparedDir) snapBack();
      else resetTransformsNoAnim();

      dy = 0;
      dx = 0;
      return;
    }

    const velocityY = (lastMoveY - startY) / dt;
    const isBackward = preparedDir < 0;
    const minDy = isBackward ? BACKWARD_MIN_COMMIT_DY : MIN_COMMIT_DY;
    const minVy = isBackward ? BACKWARD_MIN_COMMIT_VY : MIN_COMMIT_VY;

    if (
      Math.abs(totalDy) >= height * THRESHOLD_RATIO ||
      (Math.abs(totalDy) >= minDy && Math.abs(velocityY) >= minVy)
    ) {
      commit(preparedDir);
    } else {
      snapBack();
    }

    dy = 0;
    dx = 0;
  };

  /* =========================================================
     TOUCH
     ========================================================= */

  const handleTouchStart = event => {
    touchBlocked =
      !isOpen ||
      event.touches.length !== 1 ||
      !!event.target.closest('.gallery-viewer__back');

    if (touchBlocked) return;

    gestureHeight = vh();

    if (isAnimating) {
      const interrupted = interruptActiveCommit();

      if (!interrupted || isAnimating) {
        queueHasStart = true;
        queueStartY = event.touches[0].clientY;
        queueStartX = event.touches[0].clientX;
        queuedDir = 0;
        return;
      }
    }

    dragging = true;
    preparedDir = 0;
    dy = 0;
    dx = 0;

    startY = event.touches[0].clientY;
    startX = event.touches[0].clientX;
    startT = performance.now();
    lastMoveY = startY;

    [layerPrev, layerCurrent, layerNext].forEach(layer => {
      layer.style.transition = 'none';
      layer.style.willChange = 'transform';
    });

    if (startY < gestureHeight * 0.45) warmBackwardNext();
    else warmForwardNext();
  };

  const handleTouchMove = event => {
    if (touchBlocked || !isOpen || !event.touches || event.touches.length !== 1) return;

    const y = event.touches[0].clientY;
    const x = event.touches[0].clientX;

    if (isAnimating) {
      if (!queueHasStart) {
        queueHasStart = true;
        queueStartY = y;
        queueStartX = x;
        queuedDir = 0;
        return;
      }

      const qdy = y - queueStartY;
      const qdx = x - queueStartX;

      if (Math.abs(qdx) > Math.abs(qdy) * 1.4 || Math.abs(qdy) < QUEUE_MOVE_ACTIVATE_PX) return;

      const nextQueuedDir = qdy < 0 ? 1 : -1;

      if (queuedDir && queuedDir !== nextQueuedDir) {
        queueStartY = y;
        queueStartX = x;
      }

      queuedDir = nextQueuedDir;
      return;
    }

    if (!dragging) {
      dragging = true;
      preparedDir = 0;
      dy = 0;
      dx = 0;
      gestureHeight = gestureHeight || vh();

      startY = y;
      startX = x;
      startT = performance.now();
      lastMoveY = y;

      [layerPrev, layerCurrent, layerNext].forEach(layer => {
        layer.style.transition = 'none';
        layer.style.willChange = 'transform';
      });
    }

    const rawDy = y - startY;
    const rawDx = x - startX;

    if (Math.abs(rawDx) > Math.abs(rawDy) * 1.4 || Math.abs(rawDy) < MOVE_ACTIVATE_PX) return;

    event.preventDefault();

    const previousDy = dy;
    const delta = rawDy - previousDy;

    dy = Math.abs(delta) > MAX_MOVE_STEP_PX
      ? previousDy + Math.sign(delta) * MAX_MOVE_STEP_PX
      : rawDy;

    dx = rawDx;
    lastMoveY = y;

    const rawDir = dy < 0 ? 1 : -1;
    const directionFlip = preparedDir !== 0 && preparedDir !== rawDir;
    const dir = directionFlip && Math.abs(dy) < DIRECTION_FLIP_DAMPING_PX ? preparedDir : rawDir;

    if (preparedDir !== dir) prepareNextForDirection(dir);

    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;

        const height = gestureHeight || vh();
        const targetLayer = preparedDir > 0 ? layerNext : layerPrev;

        setTransform(layerCurrent, dy);

        if (targetLayer) {
          setTransform(targetLayer, preparedDir > 0 ? height + dy : -height + dy);
        }
      });
    }
  };

  const handleTouchEnd = () => {
    touchBlocked = false;
    finishGesture(false);
  };

  const handleTouchCancel = () => {
    touchBlocked = false;
    finishGesture(true);
  };

  /* =========================================================
     POINTER / DESKTOP
     ========================================================= */

  const handlePointerDown = event => {
    if (!isOpen || isAnimating || event.pointerType === 'touch' || event.button !== 0) return;
    if (event.target.closest('.gallery-viewer__back')) return;

    dragging = true;
    preparedDir = 0;
    gestureHeight = vh();
    dy = 0;
    dx = 0;

    startX = event.clientX;
    startY = event.clientY;
    startT = performance.now();
    lastMoveY = startY;

    [layerPrev, layerCurrent, layerNext].forEach(layer => {
      layer.style.transition = 'none';
      layer.style.willChange = 'transform';
    });

    viewport?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = event => {
    if (!dragging || isAnimating || event.pointerType === 'touch') return;

    const rawDy = event.clientY - startY;
    const rawDx = event.clientX - startX;

    if (Math.abs(rawDx) > Math.abs(rawDy) * 1.4 || Math.abs(rawDy) < MOVE_ACTIVATE_PX) return;

    const previousDy = dy;
    const delta = rawDy - previousDy;

    dy = Math.abs(delta) > MAX_MOVE_STEP_PX
      ? previousDy + Math.sign(delta) * MAX_MOVE_STEP_PX
      : rawDy;

    dx = rawDx;
    lastMoveY = event.clientY;

    const rawDir = dy < 0 ? 1 : -1;
    const directionFlip = preparedDir && preparedDir !== rawDir;
    const dir = directionFlip && Math.abs(dy) < DIRECTION_FLIP_DAMPING_PX ? preparedDir : rawDir;

    if (preparedDir !== dir) prepareNextForDirection(dir);

    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;

        const height = gestureHeight || vh();
        const targetLayer = preparedDir > 0 ? layerNext : layerPrev;

        setTransform(layerCurrent, dy);

        if (targetLayer) {
          setTransform(targetLayer, preparedDir > 0 ? height + dy : -height + dy);
        }
      });
    }
  };

  const handlePointerUp = event => {
    if (event.pointerType === 'touch') return;

    if (viewport?.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    finishGesture(false);
  };

  /* =========================================================
     BACK ARROW
     ========================================================= */

  const createBackButton = () => {
    const button = createElement('button', 'gallery-viewer__back');
    const image = createElement('img', 'gallery-viewer__back-icon');

    button.type = 'button';
    button.setAttribute('aria-label', 'Back to menu');

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

    gallery = createElement('section', 'gallery-viewer');
    gallery.id = 'galleryViewer';
    gallery.setAttribute('aria-label', 'Artwork gallery');
    gallery.setAttribute('aria-hidden', 'true');

    viewport = createElement('div', 'gallery-viewer__viewport');

    layerPrev = createLayer('previous');
    layerCurrent = createLayer('current');
    layerNext = createLayer('next');
    backButton = createBackButton();

    viewport.append(layerPrev, layerCurrent, layerNext);
    gallery.append(viewport, backButton);
    document.body.appendChild(gallery);

    resetTransformsNoAnim();

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerup', handlePointerUp);
    viewport.addEventListener('pointercancel', () => finishGesture(true));
  };

  /* =========================================================
     KEYBOARD
     ========================================================= */

  const handleKeyDown = event => {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeGallery();
      return;
    }

    if (isAnimating) return;

    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      gestureHeight = vh();
      prepareNextForDirection(1);
      commit(1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      gestureHeight = vh();
      prepareNextForDirection(-1);
      commit(-1);
    }
  };

  /* =========================================================
     OPEN
     ========================================================= */

  const openGallery = (requestedIndex = 0) => {
    art = Array.isArray(window.ART) ? window.ART : [];

    if (!art.length) {
      console.error('[VB Gallery] window.ART is empty or art.js is not loaded.');
      return;
    }

    buildGallery();
    if (!gallery) return;

    const parsedIndex = Number(requestedIndex);
    currentIndex = Number.isInteger(parsedIndex) ? normalizeIndex(parsedIndex) : 0;

    clearAnimation();
    resetQueue();
    resetActiveCommit();

    dragging = false;
    touchBlocked = false;
    isAnimating = false;
    preparedDir = 0;
    gestureHeight = vh();
    dy = 0;
    dx = 0;

    prevLoadedIndex = null;
    nextLoadedIndex = null;

    syncInitialContent();
    resetTransformsNoAnim();

    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    gallery.setAttribute('aria-hidden', 'false');
    gallery.classList.add('is-open');

    isOpen = true;
    window.addEventListener('keydown', handleKeyDown);

    requestAnimationFrame(() => {
      if (!gallery || !isOpen) return;
      gallery.classList.add('is-visible');
    });

    requestAnimationFrame(() => {
      warmForwardNext();
      warmBackwardNext();
    });

    window.dispatchEvent(new CustomEvent('vb:gallery-opened', {
      detail: { index: currentIndex, artwork: art[currentIndex] }
    }));
  };

  /* =========================================================
     CLOSE
     ========================================================= */

  function closeGallery() {
    if (!gallery || !isOpen) return;

    clearAnimation();
    resetQueue();
    resetActiveCommit();

    dragging = false;
    touchBlocked = false;
    isAnimating = false;
    preparedDir = 0;
    dy = 0;
    dx = 0;
    isOpen = false;

    gallery.classList.remove('is-visible');
    window.removeEventListener('keydown', handleKeyDown);

    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;

    window.setTimeout(() => {
      if (!gallery || isOpen) return;

      gallery.classList.remove('is-open');
      gallery.setAttribute('aria-hidden', 'true');
      resetTransformsNoAnim();
    }, 220);

    window.dispatchEvent(new CustomEvent('vb:gallery-closed'));
  }

  /* =========================================================
     APP EVENTS
     ========================================================= */

  const handleGalleryOpenRequest = event => {
    const requestedIndex = Number(event.detail?.index);
    openGallery(Number.isInteger(requestedIndex) ? requestedIndex : 0);
  };

  window.addEventListener('vb:gallery-open-view', handleGalleryOpenRequest);

  /* =========================================================
     RESIZE
     ========================================================= */

  const handleResize = () => {
    if (!gallery || !isOpen || dragging || isAnimating) return;

    gestureHeight = vh();
    resetTransformsNoAnim();
  };

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', handleResize, { passive: true });

  /* =========================================================
     VISIBILITY RECOVERY
     ========================================================= */

  const recoverVisibleState = () => {
    if (!isOpen) return;

    clearAnimation();
    resetQueue();
    resetActiveCommit();

    dragging = false;
    touchBlocked = false;
    isAnimating = false;
    preparedDir = 0;
    dy = 0;
    dx = 0;
    gestureHeight = vh();

    resetTransformsNoAnim();

    requestAnimationFrame(() => {
      warmForwardNext();
      warmBackwardNext();
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverVisibleState();
  }, { passive: true });

  window.addEventListener('pageshow', recoverVisibleState, { passive: true });

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener('pagehide', () => {
    clearAnimation();
    resetQueue();
    resetActiveCommit();

    window.removeEventListener('vb:gallery-open-view', handleGalleryOpenRequest);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    window.visualViewport?.removeEventListener('resize', handleResize);

    dragging = false;
    isAnimating = false;
    isOpen = false;
  }, { once: true });
})();
