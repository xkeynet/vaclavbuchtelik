'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — NEXT / PHASE 1
   CAROUSEL SEEKBAR + ARRIVAL
   ========================================================= */

(() => {
  const SEGMENT_COUNT = 7;
  const LINE_SRC = '/assets/icons/line.svg';

  let mainView = null;
  let homeView = null;
  let seek = null;
  let segments = [];
  let mainObserver = null;
  let homeObserver = null;
  let slideObserver = null;
  let revealed = false;

  const createElement = (tag, className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  /* =========================================================
     ACTIVE SEGMENT
     ========================================================= */

  const syncActiveSegment = () => {
    if (!homeView || !segments.length) return;

    const slides = [...homeView.querySelectorAll('.home-carousel__slide')];
    const activeIndex = slides.findIndex(slide => slide.classList.contains('is-active') || slide.classList.contains('is-entering'));
    const index = activeIndex >= 0 ? activeIndex : 0;

    segments.forEach((segment, segmentIndex) => {
      segment.classList.toggle('is-active', segmentIndex === index);
    });
  };

  /* =========================================================
     ARRIVAL
     Sedm segmentů vystřelí zprava v rychlém sledu současně
     s příjezdem prvního slidu.
     ========================================================= */

  const revealSeek = () => {
    if (!seek || revealed) return;
    revealed = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => seek?.classList.add('is-visible'));
    });
  };

  /* =========================================================
     CREATE
     ========================================================= */

  const createSeek = () => {
    if (!homeView || seek) return;

    const carousel = homeView.querySelector('.home-carousel');
    const viewport = carousel?.querySelector('.home-carousel__viewport');
    if (!carousel || !viewport) return;

    seek = createElement('div', 'home-carousel__seek');
    seek.setAttribute('aria-hidden', 'true');

    segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => {
      const segment = createElement('span', 'home-carousel__seek-segment');
      const line = document.createElement('img');

      segment.style.setProperty('--seek-index', String(index));
      line.className = 'home-carousel__seek-line';
      line.src = LINE_SRC;
      line.alt = '';
      line.decoding = 'async';
      line.draggable = false;

      segment.appendChild(line);
      seek.appendChild(segment);
      return segment;
    });

    viewport.insertAdjacentElement('afterend', seek);
    syncActiveSegment();

    slideObserver = new MutationObserver(syncActiveSegment);
    homeView.querySelectorAll('.home-carousel__slide').forEach(slide => {
      slideObserver.observe(slide, { attributes: true, attributeFilter: ['class'] });
    });

    homeObserver = new MutationObserver(() => {
      if (homeView?.classList.contains('is-carousel-visible')) revealSeek();
    });

    homeObserver.observe(homeView, { attributes: true, attributeFilter: ['class'] });

    if (homeView.classList.contains('is-carousel-visible')) revealSeek();
  };

  /* =========================================================
     FIND HOME
     ========================================================= */

  const findHome = () => {
    mainView = document.getElementById('mainView');
    homeView = document.getElementById('homeView');
    if (!mainView || !homeView) return false;

    createSeek();
    return Boolean(seek);
  };

  if (!findHome()) {
    mainObserver = new MutationObserver(() => {
      if (!findHome()) return;
      mainObserver.disconnect();
      mainObserver = null;
    });

    mainObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener('pagehide', () => {
    mainObserver?.disconnect();
    homeObserver?.disconnect();
    slideObserver?.disconnect();

    mainObserver = null;
    homeObserver = null;
    slideObserver = null;
  }, { once: true });
})();
