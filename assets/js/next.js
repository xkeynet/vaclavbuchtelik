'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — NEXT / PHASE 2
   INTERACTIVE CAROUSEL SEEKBAR
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
  let revealed = false;

  const createElement = (tag, className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  /* =========================================================
     ACTIVE SEGMENT
     ========================================================= */

  const setActiveSegment = index => {
    if (!segments.length) return;

    segments.forEach((segment, segmentIndex) => {
      const active = segmentIndex === index;

      segment.classList.toggle('is-active', active);
      segment.setAttribute('aria-current', active ? 'true' : 'false');
    });
  };

  const handleSlideChange = event => {
    const index = Number(event.detail?.index);
    if (!Number.isInteger(index) || index < 0 || index >= SEGMENT_COUNT) return;

    setActiveSegment(index);
  };

  /* =========================================================
     NAVIGATION
     ========================================================= */

  const goToSlide = index => {
    if (!homeView || mainView?.classList.contains('is-menu-visible')) return;

    document.dispatchEvent(new CustomEvent('vb:home-go-to-slide', {
      detail: { index }
    }));
  };

  /* =========================================================
     ARRIVAL
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

    seek = createElement('nav', 'home-carousel__seek');
    seek.setAttribute('aria-label', 'Artwork carousel navigation');

    segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => {
      const button = createElement('button', 'home-carousel__seek-segment');
      const line = document.createElement('img');

      button.type = 'button';
      button.style.setProperty('--seek-index', String(index));
      button.setAttribute('aria-label', `Show artwork ${index + 1}`);

      line.className = 'home-carousel__seek-line';
      line.src = LINE_SRC;
      line.alt = '';
      line.decoding = 'async';
      line.draggable = false;

      button.appendChild(line);
      button.addEventListener('click', () => goToSlide(index));

      seek.appendChild(button);
      return button;
    });

    viewport.insertAdjacentElement('afterend', seek);
    setActiveSegment(0);

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

  document.addEventListener('vb:home-slide-change', handleSlideChange);

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

    segments.forEach((segment, index) => {
      segment.replaceWith(segment.cloneNode(true));
    });

    document.removeEventListener('vb:home-slide-change', handleSlideChange);

    mainObserver = null;
    homeObserver = null;
  }, { once: true });
})();
