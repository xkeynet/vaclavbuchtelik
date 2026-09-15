'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY
   FULLSCREEN ARTWORK VIEWER
   PREVIOUS + CURRENT + NEXT
   ========================================================= */

(() => {
  /* =========================================================
     STATE
     ========================================================= */

  const state = { index: 0, isOpen: false };
  const refs = {
    gallery: null,
    viewport: null,
    layerPrev: null,
    layerCurrent: null,
    layerNext: null
  };

  let art = [];
  let swipe = null;
  let previousBodyOverflow = '';
  let previousHtmlOverflow = '';
  let previousBodyTouchAction = '';

  const preloaded = new Map();

  /* =========================================================
     HELPERS
     ========================================================= */

  const el = (tag, className = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
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

  /* =========================================================
     IMAGE PRELOAD
     ========================================================= */

  const preloadArtwork = artwork => {
    if (!artwork?.src || preloaded.has(artwork.src)) return;

    const image = new Image();
    image.decoding = 'async';
    image.src = artwork.src;

    preloaded.set(artwork.src, image);

    if (typeof image.decode === 'function') image.decode().catch(() => {});
  };

  const preloadAround = index => {
    if (!art.length) return;

    for (let offset = -3; offset <= 3; offset++) {
      preloadArtwork(art[normalizeIndex(index + offset)]);
    }
  };

  /* =========================================================
     LAYERS
     ========================================================= */

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

    layer._image = image;
    layer._title = title;
    layer._details = details;

    return layer;
  };

  const setLayerContent = (layer, artwork, index) => {
    if (!layer || !artwork) return;

    layer.dataset.index = String(index);
    layer.dataset.artId = String(artwork.id ?? '');

    const absoluteSrc = new URL(artwork.src, window.location.href).href;

    if (layer._image.src !== absoluteSrc) layer._image.src = artwork.src;

    layer._image.alt = artwork.title || '';
    layer._title.textContent = artwork.title || '';
    layer._details.textContent = artwork.details || '';
    layer._details.hidden = !artwork.details;
  };

  const syncLayers = () => {
    if (!art.length) return;

    const prevIndex = normalizeIndex(state.index - 1);
    const nextIndex = normalizeIndex(state.index + 1);

    setLayerContent(refs.layerPrev, art[prevIndex], prevIndex);
    setLayerContent(refs.layerCurrent, art[state.index], state.index);
    setLayerContent(refs.layerNext, art[nextIndex], nextIndex);

    preloadAround(state.index);
  };

  /* =========================================================
     BACK
     ========================================================= */

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

  /* =========================================================
     VIEWER
     ========================================================= */

  const buildGallery = () => {
    if (refs.gallery) return;

    refs.gallery = el('section', 'gallery-viewer');
    refs.viewport = el('div', 'gallery-viewer__viewport');

    refs.gallery.id = 'galleryViewer';
    refs.gallery.setAttribute('aria-label', 'Artwork gallery');
    refs.gallery.setAttribute('aria-hidden', 'true');

    refs.layerPrev = createLayer('previous');
    refs.layerCurrent = createLayer('current');
    refs.layerNext = createLayer('next');

    refs.viewport.append(refs.layerPrev, refs.layerCurrent, refs.layerNext);
    refs.gallery.append(refs.viewport, createBackButton());
    document.body.appendChild(refs.gallery);

    initializeSwipe();
  };

  /* =========================================================
     SWIPE ENGINE
     ========================================================= */

  const initializeSwipe = () => {
    if (swipe || typeof window.initVBSwipe !== 'function') {
      if (!swipe && typeof window.initVBSwipe !== 'function') {
        console.error('[VB Gallery] swipe.js is not loaded.');
      }
      return;
    }

    swipe = window.initVBSwipe({
      refs,
      state,
      getItems: () => art,
      normalizeIndex,
      vh,
      setLayerContent,
      preloadAround,

      onCommit(index) {
        state.index = normalizeIndex(index);
        preloadAround(state.index);

        window.dispatchEvent(new CustomEvent('vb:gallery-slide-change', {
          detail: {
            index: state.index,
            artwork: art[state.index]
          }
        }));
      }
    });
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
    initializeSwipe();

    if (!swipe) return;

    const parsedIndex = Number(requestedIndex);
    state.index = Number.isInteger(parsedIndex) ? normalizeIndex(parsedIndex) : 0;
    state.isOpen = true;

    syncLayers();
    swipe.reset?.();

    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    refs.gallery.setAttribute('aria-hidden', 'false');
    refs.gallery.classList.add('is-open');

    requestAnimationFrame(() => {
      if (state.isOpen) refs.gallery.classList.add('is-visible');
    });

    window.dispatchEvent(new CustomEvent('vb:gallery-opened', {
      detail: {
        index: state.index,
        artwork: art[state.index]
      }
    }));
  };

  function closeGallery() {
    if (!refs.gallery || !state.isOpen) return;

    state.isOpen = false;
    swipe?.cancel?.();

    refs.gallery.classList.remove('is-visible');
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.touchAction = previousBodyTouchAction;

    window.setTimeout(() => {
      if (state.isOpen) return;

      refs.gallery.classList.remove('is-open');
      refs.gallery.setAttribute('aria-hidden', 'true');
      swipe?.reset?.();
    }, 220);

    window.dispatchEvent(new CustomEvent('vb:gallery-closed'));
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  const handleOpen = event => {
    const index = Number(event.detail?.index);
    openGallery(Number.isInteger(index) ? index : 0);
  };

  const handleKeyDown = event => {
    if (!state.isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeGallery();
    }
  };

  const handleResize = () => {
    if (state.isOpen) swipe?.resize?.();
  };

  window.addEventListener('vb:gallery-open-view', handleOpen);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', handleResize, { passive: true });

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.VBGallery = {
    open: openGallery,
    close: closeGallery,
    getIndex: () => state.index,
    isOpen: () => state.isOpen
  };
})();
