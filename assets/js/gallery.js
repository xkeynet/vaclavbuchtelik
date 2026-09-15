'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY
   FULLSCREEN VIRTUALIZED ARTWORK VIEWER
   PREVIOUS + CURRENT + NEXT
   ========================================================= */

(() => {
  const MOVE_ACTIVATE_PX = 3;
  const MIN_COMMIT_DY = 70;
  const MIN_COMMIT_VY = 0.42;
  const THRESHOLD_RATIO = 0.50;
  const DIRECTION_FLIP_DAMPING_PX = 12;
  const MAX_MOVE_STEP_PX = 260;
  const COMMIT_DURATION_MS = 180;
  const SNAP_DURATION_MS = 220;
  const COMMIT_CURVE = 'cubic-bezier(0.15, 0.85, 0.2, 1)';
  const SNAP_CURVE = 'cubic-bezier(0.2, 0, 0.2, 1)';

  let art = [];
  let gallery = null;
  let viewport = null;
  let closeButton = null;
  let layerPrev = null;
  let layerCurrent = null;
  let layerNext = null;

  let currentIndex = 0;
  let isOpen = false;
  let isAnimating = false;
  let dragging = false;

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

  const getViewportHeight = () =>
    Math.max(1, window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 1);

  const setTransform = (layer, y) => {
    if (layer) layer.style.transform = `translate3d(0,${y}px,0)`;
  };

  const clearAnimation = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = 0;
    }
  };

  /* =========================================================
     PRELOAD
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
      normalizeIndex(index - 1),
      normalizeIndex(index),
      normalizeIndex(index + 1),
      normalizeIndex(index + 2)
    ].forEach(i => preloadArtwork(art[i]));
  };

  /* =========================================================
     LAYERS
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
      image.src = artwork.src;
      image.alt = artwork.title || '';
    }

    if (title) title.textContent = artwork.title || '';

    if (details) {
      details.textContent = artwork.details || '';
      details.hidden = !artwork.details;
    }
  };

  const syncLayerContent = () => {
    if (!art.length || !layerPrev || !layerCurrent || !layerNext) return;

    const prevIndex = normalizeIndex(currentIndex - 1);
    const nextIndex = normalizeIndex(currentIndex + 1);

    setLayerArtwork(layerPrev, art[prevIndex], prevIndex);
    setLayerArtwork(layerCurrent, art[currentIndex], currentIndex);
    setLayerArtwork(layerNext, art[nextIndex], nextIndex);

    preloadAround(currentIndex);
  };

  const resetTransforms = () => {
    if (!layerPrev || !layerCurrent || !layerNext) return;

    clearAnimation();

    const height = getViewportHeight();

    [layerPrev, layerCurrent, layerNext].forEach(layer => {
      layer.style.transition = 'none';
      layer.style.willChange = 'auto';
    });

    setTransform(layerPrev, -height);
    setTransform(layerCurrent, 0);
    setTransform(layerNext, height);
  };

  /* =========================================================
     SWIPE — COMMIT
     ========================================================= */

  const finishCommit = dir => {
    currentIndex = normalizeIndex(currentIndex + dir);

    if (dir > 0) {
      const oldPrev = layerPrev;
      layerPrev = layerCurrent;
      layerCurrent = layerNext;
      layerNext = oldPrev;
    } else {
      const oldNext = layerNext;
      layerNext = layerCurrent;
      layerCurrent = layerPrev;
      layerPrev = oldNext;
    }

    syncLayerContent();
    resetTransforms();

    preparedDir = 0;
    dy = 0;
    dx = 0;
    isAnimating = false;

    window.dispatchEvent(new CustomEvent('vb:gallery-slide-change', {
      detail: { index: currentIndex, artwork: art[currentIndex] }
    }));
  };

  const commit = dir => {
    if (isAnimating || !isOpen || !art.length) return;

    const targetLayer = dir > 0 ? layerNext : layerPrev;
    if (!targetLayer) return;

    clearAnimation();
    isAnimating = true;

    const height = gestureHeight || getViewportHeight();

    layerCurrent.style.willChange = 'transform';
    targetLayer.style.willChange = 'transform';

    layerCurrent.style.transition = `transform ${COMMIT_DURATION_MS}ms ${COMMIT_CURVE}`;
    targetLayer.style.transition = `transform ${COMMIT_DURATION_MS}ms ${COMMIT_CURVE}`;

    setTransform(layerCurrent, dir > 0 ? -height : height);
    setTransform(targetLayer, 0);

    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      finishCommit(dir);
    }, COMMIT_DURATION_MS);
  };

  const snapBack = () => {
    if (isAnimating || !isOpen) return;

    clearAnimation();
    isAnimating = true;

    const height = gestureHeight || getViewportHeight();
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
      resetTransforms();
      isAnimating = false;
    }, SNAP_DURATION_MS);
  };

  const prepareDirection = dir => {
    if (dir !== 1 && dir !== -1) return;

    const height = gestureHeight || getViewportHeight();
    const targetLayer = dir > 0 ? layerNext : layerPrev;

    if (!targetLayer) return;

    targetLayer.style.transition = 'none';
    setTransform(targetLayer, dir > 0 ? height : -height);
    preparedDir = dir;
  };

  /* =========================================================
     SWIPE — GESTURE
     ========================================================= */

  const startGesture = (clientX, clientY) => {
    if (!isOpen || isAnimating) return false;

    dragging = true;
    startX = clientX;
    startY = clientY;
    startT = performance.now();
    lastMoveY = clientY;
    dy = 0;
    dx = 0;
    preparedDir = 0;
    gestureHeight = getViewportHeight();

    [layerPrev, layerCurrent, layerNext].forEach(layer => {
      layer.style.transition = 'none';
      layer.style.willChange = 'transform';
    });

    return true;
  };

  const moveGesture = (clientX, clientY) => {
    if (!dragging || isAnimating || !isOpen) return false;

    const rawDy = clientY - startY;
    const rawDx = clientX - startX;

    if (Math.abs(rawDx) > Math.abs(rawDy) * 1.4 || Math.abs(rawDy) < MOVE_ACTIVATE_PX) return false;

    const previousDy = dy;
    const delta = rawDy - previousDy;

    dy = Math.abs(delta) > MAX_MOVE_STEP_PX
      ? previousDy + Math.sign(delta) * MAX_MOVE_STEP_PX
      : rawDy;

    dx = rawDx;
    lastMoveY = clientY;

    const rawDir = dy < 0 ? 1 : -1;
    const directionFlip = preparedDir !== 0 && preparedDir !== rawDir;
    const dir = directionFlip && Math.abs(dy) < DIRECTION_FLIP_DAMPING_PX ? preparedDir : rawDir;

    if (preparedDir !== dir) prepareDirection(dir);

    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;

        const height = gestureHeight || getViewportHeight();
        const targetLayer = preparedDir > 0 ? layerNext : layerPrev;

        setTransform(layerCurrent, dy);

        if (targetLayer) {
          setTransform(targetLayer, preparedDir > 0 ? height + dy : -height + dy);
        }
      });
    }

    return true;
  };

  const finishGesture = cancelled => {
    if (!dragging || isAnimating) return;

    const totalDy = dy;
    const dt = Math.max(1, performance.now() - startT);
    const height = gestureHeight || getViewportHeight();
    const velocityY = (lastMoveY - startY) / dt;

    dragging = false;

    if (cancelled || preparedDir === 0) {
      if (preparedDir) snapBack();
      else resetTransforms();
      return;
    }

    const shouldCommit =
      Math.abs(totalDy) >= height * THRESHOLD_RATIO ||
      (Math.abs(totalDy) >= MIN_COMMIT_DY && Math.abs(velocityY) >= MIN_COMMIT_VY);

    if (shouldCommit) commit(preparedDir);
    else snapBack();
  };

  /* =========================================================
     INPUT
     ========================================================= */

  const handleTouchStart = event => {
    if (!isOpen || event.touches.length !== 1 || event.target.closest('.gallery-viewer__close')) return;

    const touch = event.touches[0];
    startGesture(touch.clientX, touch.clientY);
  };

  const handleTouchMove = event => {
    if (!dragging || event.touches.length !== 1) return;

    const touch = event.touches[0];

    if (moveGesture(touch.clientX, touch.clientY)) event.preventDefault();
  };

  const handlePointerDown = event => {
    if (!isOpen || event.pointerType === 'touch' || event.button !== 0 || event.target.closest('.gallery-viewer__close')) return;
    if (!startGesture(event.clientX, event.clientY)) return;

    viewport?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = event => {
    if (!dragging || event.pointerType === 'touch') return;
    moveGesture(event.clientX, event.clientY);
  };

  const handlePointerUp = event => {
    if (event.pointerType === 'touch') return;

    if (viewport?.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    finishGesture(false);
  };

  const handleKeyDown = event => {
    if (!isOpen || isAnimating) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeGallery();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      gestureHeight = getViewportHeight();
      prepareDirection(1);
      commit(1);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      gestureHeight = getViewportHeight();
      prepareDirection(-1);
      commit(-1);
    }
  };

  /* =========================================================
     VIEWER
     ========================================================= */

  const createCloseButton = () => {
    const button = createElement('button', 'gallery-viewer__close');
    button.type = 'button';
    button.setAttribute('aria-label', 'Close gallery');

    button.append(
      createElement('span', 'gallery-viewer__close-line gallery-viewer__close-line--a'),
      createElement('span', 'gallery-viewer__close-line gallery-viewer__close-line--b')
    );

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      closeGallery();
    });

    return button;
  };

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
    closeButton = createCloseButton();

    viewport.append(layerPrev, layerCurrent, layerNext);
    gallery.append(viewport, closeButton);
    document.body.appendChild(gallery);

    resetTransforms();

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', () => finishGesture(false), { passive: true });
    viewport.addEventListener('touchcancel', () => finishGesture(true), { passive: true });

    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerup', handlePointerUp);
    viewport.addEventListener('pointercancel', () => finishGesture(true));
  };

  /* =========================================================
     OPEN / CLOSE
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

    dragging = false;
    isAnimating = false;
    preparedDir = 0;
    gestureHeight = getViewportHeight();
    dy = 0;
    dx = 0;

    syncLayerContent();
    resetTransforms();

    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    gallery.setAttribute('aria-hidden', 'false');
    gallery.classList.add('is-open');

    isOpen = true;
    window.addEventListener('keydown', handleKeyDown);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!gallery || !isOpen) return;

        gallery.classList.add('is-visible');
        closeButton?.focus?.({ preventScroll: true });
      });
    });

    window.dispatchEvent(new CustomEvent('vb:gallery-opened', {
      detail: { index: currentIndex, artwork: art[currentIndex] }
    }));
  };

  function closeGallery() {
    if (!gallery || !isOpen) return;

    clearAnimation();

    dragging = false;
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
      resetTransforms();
    }, 240);

    window.dispatchEvent(new CustomEvent('vb:gallery-closed'));
  }

  /* =========================================================
     APP EVENTS
     ========================================================= */

  const handleGalleryOpenRequest = event => {
    const index = Number(event.detail?.index);
    openGallery(Number.isInteger(index) ? index : 0);
  };

  const handleResize = () => {
    if (!gallery || !isOpen || dragging || isAnimating) return;

    gestureHeight = getViewportHeight();
    resetTransforms();
  };

  window.addEventListener('vb:gallery-open-view', handleGalleryOpenRequest);
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', handleResize, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !isOpen) return;

    clearAnimation();
    dragging = false;
    isAnimating = false;
    preparedDir = 0;
    dy = 0;
    dx = 0;
    gestureHeight = getViewportHeight();

    syncLayerContent();
    resetTransforms();
  }, { passive: true });

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener('pagehide', () => {
    clearAnimation();

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
