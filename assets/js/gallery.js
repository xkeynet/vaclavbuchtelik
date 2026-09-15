'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY
   FULLSCREEN ARTWORK VIEWER
   PREVIOUS + CURRENT + NEXT
   ========================================================= */

(() => {
  let art = [], gallery = null, viewport = null, layerPrev = null, layerCurrent = null, layerNext = null;
  let currentIndex = 0, isOpen = false, swipeEngine = null;
  let previousBodyOverflow = '', previousHtmlOverflow = '', previousBodyTouchAction = '';
  const preloadedImages = new Map();

  const el = (tag, className = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };

  const normalizeIndex = index => art.length ? ((index % art.length) + art.length) % art.length : 0;

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
    [-3, -2, -1, 0, 1, 2, 3].forEach(offset => preloadArtwork(art[normalizeIndex(index + offset)]));
  };

  const createLayer = position => {
    const layer = el('article', `gallery-viewer__layer gallery-viewer__layer--${position}`);
    const media = el('div', 'gallery-viewer__media');
    const image = el('img', 'gallery-viewer__image');
    const meta = el('div', 'gallery-viewer__meta');
    const title = el('div', 'gallery-viewer__title');
    const details = el('div', 'gallery-viewer__details');

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

  const syncContent = () => {
    if (!art.length) return;

    const previousIndex = normalizeIndex(currentIndex - 1);
    const nextIndex = normalizeIndex(currentIndex + 1);

    setLayerArtwork(layerPrev, art[previousIndex], previousIndex);
    setLayerArtwork(layerCurrent, art[currentIndex], currentIndex);
    setLayerArtwork(layerNext, art[nextIndex], nextIndex);

    preloadAround(currentIndex);
  };

  const resetLayerGeometry = () => {
    if (!layerPrev || !layerCurrent || !layerNext) return;

    layerPrev.style.transition = 'none';
    layerCurrent.style.transition = 'none';
    layerNext.style.transition = 'none';

    layerPrev.style.transform = 'translate3d(0,-100%,0)';
    layerCurrent.style.transform = 'translate3d(0,0,0)';
    layerNext.style.transform = 'translate3d(0,100%,0)';
  };

  const dispatchSlideChange = () => {
    window.dispatchEvent(new CustomEvent('vb:gallery-slide-change', {
      detail: { index: currentIndex, artwork: art[currentIndex] }
    }));
  };

  const handleSwipeCommit = direction => {
    if (!isOpen || !art.length) return;

    if (direction > 0) {
      const oldPrevious = layerPrev;
      layerPrev = layerCurrent;
      layerCurrent = layerNext;
      layerNext = oldPrevious;
      currentIndex = normalizeIndex(currentIndex + 1);
    } else {
      const oldNext = layerNext;
      layerNext = layerCurrent;
      layerCurrent = layerPrev;
      layerPrev = oldNext;
      currentIndex = normalizeIndex(currentIndex - 1);
    }

    syncContent();
    resetLayerGeometry();

    swipeEngine?.setLayers?.({
      previous: layerPrev,
      current: layerCurrent,
      next: layerNext
    });

    swipeEngine?.reset?.();
    dispatchSlideChange();
  };

  const initializeSwipeEngine = () => {
    if (swipeEngine) return true;

    if (!window.VBSwipe || typeof window.VBSwipe.create !== 'function') {
      console.warn('[VB Gallery] VBSwipe unavailable — gallery remains functional without swipe.');
      return false;
    }

    try {
      swipeEngine = window.VBSwipe.create({
        viewport,
        layers: { previous: layerPrev, current: layerCurrent, next: layerNext },
        exclude: '.gallery-viewer__back',
        onCommit: handleSwipeCommit
      });

      return !!swipeEngine;
    } catch (error) {
      console.error('[VB Gallery] Swipe initialization failed:', error);
      swipeEngine = null;
      return false;
    }
  };

  const activateSwipeEngine = () => {
    if (!initializeSwipeEngine()) return;

    try {
      swipeEngine.setLayers?.({
        previous: layerPrev,
        current: layerCurrent,
        next: layerNext
      });

      swipeEngine.enable?.();
      swipeEngine.reset?.();
      swipeEngine.resize?.();
    } catch (error) {
      console.error('[VB Gallery] Swipe activation failed:', error);
    }
  };

  const deactivateSwipeEngine = () => {
    if (!swipeEngine) return;
    try {
      swipeEngine.disable?.();
      swipeEngine.reset?.();
    } catch (error) {
      console.error('[VB Gallery] Swipe deactivation failed:', error);
    }
  };

  function closeGallery() {
    if (!gallery || !isOpen) return;

    isOpen = false;
    deactivateSwipeEngine();

    gallery.classList.remove('is-visible');
    window.removeEventListener('keydown', handleKeyDown);

    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.touchAction = previousBodyTouchAction;

    window.setTimeout(() => {
      if (!gallery || isOpen) return;
      gallery.classList.remove('is-open');
      gallery.setAttribute('aria-hidden', 'true');
      resetLayerGeometry();
    }, 220);

    window.dispatchEvent(new CustomEvent('vb:gallery-closed', {
      detail: { index: currentIndex, artwork: art[currentIndex] }
    }));
  }

  const createBackButton = () => {
    const button = el('button', 'gallery-viewer__back');
    const image = el('img', 'gallery-viewer__back-icon');

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

  const buildGallery = () => {
    if (gallery) return;

    gallery = el('section', 'gallery-viewer');
    gallery.id = 'galleryViewer';
    gallery.setAttribute('aria-label', 'Artwork gallery');
    gallery.setAttribute('aria-hidden', 'true');

    viewport = el('div', 'gallery-viewer__viewport');
    layerPrev = createLayer('previous');
    layerCurrent = createLayer('current');
    layerNext = createLayer('next');

    viewport.append(layerPrev, layerCurrent, layerNext);
    gallery.append(viewport, createBackButton());
    document.body.appendChild(gallery);

    resetLayerGeometry();
  };

  const fallbackCommit = direction => {
    if (!isOpen || !art.length) return;

    currentIndex = normalizeIndex(currentIndex + direction);
    syncContent();
    resetLayerGeometry();
    dispatchSlideChange();
  };

  const handleKeyDown = event => {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeGallery();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      if (swipeEngine?.commit) swipeEngine.commit(1);
      else fallbackCommit(1);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      if (swipeEngine?.commit) swipeEngine.commit(-1);
      else fallbackCommit(-1);
    }
  };

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

    syncContent();
    resetLayerGeometry();

    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    gallery.setAttribute('aria-hidden', 'false');
    gallery.classList.add('is-open');

    /*
     * CRITICAL:
     * Gallery is now open BEFORE swipe initialization and it remains open
     * even if the external swipe engine is unavailable or throws.
     */
    isOpen = true;

    activateSwipeEngine();

    window.removeEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown);

    requestAnimationFrame(() => {
      if (!gallery || !isOpen) return;
      gallery.classList.add('is-visible');
      resetLayerGeometry();
      swipeEngine?.resize?.();
    });

    window.dispatchEvent(new CustomEvent('vb:gallery-opened', {
      detail: { index: currentIndex, artwork: art[currentIndex] }
    }));
  };

  const handleGalleryOpenRequest = event => {
    const requestedIndex = Number(event.detail?.index);
    openGallery(Number.isInteger(requestedIndex) ? requestedIndex : 0);
  };

  const handleResize = () => {
    if (!gallery || !isOpen) return;
    resetLayerGeometry();
    swipeEngine?.resize?.();
  };

  const recoverVisibleState = () => {
    if (!isOpen) return;

    syncContent();
    resetLayerGeometry();

    swipeEngine?.setLayers?.({
      previous: layerPrev,
      current: layerCurrent,
      next: layerNext
    });

    swipeEngine?.reset?.();
    swipeEngine?.resize?.();
  };

  window.addEventListener('vb:gallery-open-view', handleGalleryOpenRequest);
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', handleResize, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverVisibleState();
  }, { passive: true });

  window.addEventListener('pageshow', recoverVisibleState, { passive: true });

  window.addEventListener('pagehide', () => {
    window.removeEventListener('vb:gallery-open-view', handleGalleryOpenRequest);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    window.visualViewport?.removeEventListener('resize', handleResize);

    try {
      swipeEngine?.destroy?.();
    } catch (error) {
      console.error('[VB Gallery] Swipe cleanup failed:', error);
    }

    swipeEngine = null;
    isOpen = false;
  }, { once: true });
})();
