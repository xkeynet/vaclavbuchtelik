'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — HOME / PHASE 4
   PHOTO CAROUSEL + CAPTIONS
   ========================================================= */

(() => {
  const DIVIDER_LOGO_GAP_PX = 8;
  const SLIDE_INTERVAL_MS = 3000;
  const CAPTION_LOGO_SRC = '/assets/vb-logo.png';

  const HOME_SLIDES = [
    { image: '/assets/home/home-001.jpg', title: 'Z optimistických nálad tvořit nedokážu' },
    { image: '/assets/home/home-002.png', title: 'Dým 2019' },
    { image: '/assets/home/home-003.png', title: 'Dítě 2019' },
    { image: '/assets/home/home-004.png', title: 'Koukej 2019' },
    { image: '/assets/home/home-005.png', title: 'Trhej! 2019' },
    { image: '/assets/home/home-006.png', title: 'Skok do ohně 2020' },
    { image: '/assets/home/home-007.png', title: 'Schody do pekla 2020' }
  ];

  let mainView = null;
  let homeView = null;
  let divider = null;
  let viewport = null;
  let slides = [];

  let activeIndex = 0;
  let transitioning = false;
  let carouselVisible = false;
  let dividerVisible = false;

  let mainObserver = null;
  let controlsObserver = null;
  let menuObserver = null;
  let layoutObserver = null;

  let syncFrame = null;
  let autoplayTimer = null;

  const createElement = (tag, className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  const isMenuOpen = () => Boolean(mainView?.classList.contains('is-menu-visible'));

  /* =========================================================
     DIVIDER
     ========================================================= */

  const getClosedDividerY = () => {
    const logo = mainView?.querySelector('.main-view__logo');
    if (!mainView || !logo) return 0;

    const mainRect = mainView.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();

    return logoRect.bottom - mainRect.top + DIVIDER_LOGO_GAP_PX;
  };

  const getOpenDividerY = () => {
    const originalDivider = mainView?.querySelector('.main-menu__divider');
    if (!mainView || !originalDivider) return getClosedDividerY();

    return originalDivider.getBoundingClientRect().top - mainView.getBoundingClientRect().top;
  };

  const syncDivider = () => {
    if (!homeView) return;

    const y = isMenuOpen() ? getOpenDividerY() : getClosedDividerY();
    homeView.style.setProperty('--home-divider-y', `${y}px`);
  };

  const scheduleDividerSync = () => {
    if (syncFrame !== null) cancelAnimationFrame(syncFrame);

    syncFrame = requestAnimationFrame(() => {
      syncFrame = null;
      syncDivider();
    });
  };

  /* =========================================================
     SLIDE SIZE
     Image + caption together.
     ========================================================= */

  const getSlideHeight = index => {
    if (!viewport || !slides[index]) return 0;

    const slide = slides[index];
    const image = slide.querySelector('.home-carousel__image');
    const caption = slide.querySelector('.home-carousel__caption');

    if (!image?.naturalWidth || !image?.naturalHeight) return 0;

    const imageHeight = viewport.clientWidth * (image.naturalHeight / image.naturalWidth);
    const captionHeight = caption?.offsetHeight || 0;

    return imageHeight + captionHeight;
  };

  const syncViewportHeight = (index, immediate = false) => {
    if (!viewport) return;

    const height = getSlideHeight(index);
    if (!height) return;

    viewport.classList.toggle('is-height-jump', immediate);
    viewport.style.height = `${height}px`;

    if (immediate) {
      viewport.getBoundingClientRect();
      requestAnimationFrame(() => viewport?.classList.remove('is-height-jump'));
    }
  };

  /* =========================================================
     AUTOPLAY
     ========================================================= */

  const stopAutoplay = () => {
    if (autoplayTimer === null) return;

    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  };

  const scheduleAutoplay = () => {
    stopAutoplay();

    if (!carouselVisible || isMenuOpen() || document.hidden || transitioning) return;

    autoplayTimer = window.setTimeout(() => {
      autoplayTimer = null;
      showNextSlide();
    }, SLIDE_INTERVAL_MS);
  };

  /* =========================================================
     SLIDE TRANSITION
     ========================================================= */

  const finishTransition = (current, next) => {
    current.classList.remove('is-active', 'is-exiting', 'is-entering', 'is-prepared');
    next.classList.remove('is-entering', 'is-prepared');
    next.classList.add('is-active');

    transitioning = false;
    scheduleAutoplay();
  };

  const transitionTo = nextIndex => {
    if (transitioning || nextIndex === activeIndex || !slides[nextIndex]) return;

    stopAutoplay();
    transitioning = true;

    const current = slides[activeIndex];
    const next = slides[nextIndex];

    next.classList.remove('is-active', 'is-exiting', 'is-entering', 'is-prepared');
    next.classList.add('is-prepared');

    syncViewportHeight(nextIndex);
    next.getBoundingClientRect();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!current || !next) return;

        next.classList.remove('is-prepared');
        next.classList.add('is-entering');

        current.classList.remove('is-entering', 'is-prepared');
        current.classList.add('is-exiting');

        const onEnd = event => {
          if (event.target !== next || event.propertyName !== 'transform') return;

          next.removeEventListener('transitionend', onEnd);
          finishTransition(current, next);
        };

        next.addEventListener('transitionend', onEnd);
        activeIndex = nextIndex;
      });
    });
  };

  const showNextSlide = () => {
    if (!slides.length) return;

    const nextIndex = activeIndex === slides.length - 1 ? 0 : activeIndex + 1;
    transitionTo(nextIndex);
  };

  /* =========================================================
     CAPTION
     ========================================================= */

  const createCaption = title => {
    const caption = createElement('div', 'home-carousel__caption');
    const inner = createElement('div', 'home-carousel__caption-inner');

    const logo = document.createElement('img');
    logo.className = 'home-carousel__caption-logo';
    logo.src = CAPTION_LOGO_SRC;
    logo.alt = 'Václav Buchtelík';
    logo.decoding = 'async';
    logo.draggable = false;

    const separator = createElement('span', 'home-carousel__caption-separator');
    separator.setAttribute('aria-hidden', 'true');

    const text = createElement('span', 'home-carousel__caption-title');
    text.textContent = title;

    inner.append(logo, separator, text);
    caption.appendChild(inner);

    return caption;
  };

  /* =========================================================
     CREATE CAROUSEL
     ========================================================= */

  const createCarousel = () => {
    const content = createElement('div', 'home-view__content');
    const carousel = createElement('section', 'home-carousel');

    viewport = createElement('div', 'home-carousel__viewport');
    carousel.setAttribute('aria-label', 'Selected works by Václav Buchtelík');

    slides = HOME_SLIDES.map((item, index) => {
      const slide = createElement('article', 'home-carousel__slide');
      const image = document.createElement('img');

      image.className = 'home-carousel__image';
      image.src = item.image;
      image.alt = item.title;
      image.decoding = 'async';
      image.draggable = false;

      if (index === 0) image.fetchPriority = 'high';

      image.addEventListener('load', () => {
        if (index === activeIndex) syncViewportHeight(index, !carouselVisible);
      });

      slide.append(image, createCaption(item.title));
      viewport.appendChild(slide);

      return slide;
    });

    slides[0].classList.add('is-prepared');

    carousel.appendChild(viewport);
    content.appendChild(carousel);

    return content;
  };

  /* =========================================================
     ARRIVAL
     ========================================================= */

  const revealCarousel = () => {
    if (!homeView || carouselVisible) return;

    carouselVisible = true;
    syncViewportHeight(0, true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!homeView || !slides[0]) return;

        homeView.classList.add('is-carousel-visible');
        slides[0].classList.remove('is-prepared');
        slides[0].classList.add('is-active');

        const onEnd = event => {
          if (event.target !== slides[0] || event.propertyName !== 'transform') return;

          slides[0].removeEventListener('transitionend', onEnd);
          scheduleAutoplay();
        };

        slides[0].addEventListener('transitionend', onEnd);
      });
    });
  };

  const revealDivider = () => {
    if (!homeView || dividerVisible) return;

    syncDivider();
    dividerVisible = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!homeView) return;

        homeView.classList.add('is-divider-visible');
        window.setTimeout(revealCarousel, 180);
      });
    });
  };

  /* =========================================================
     MAIN WATCHERS
     ========================================================= */

  const watchControls = () => {
    if (!mainView) return;

    const waitForArrival = () => {
      const control = mainView.querySelector('.main-view__header-button');
      if (!control) return revealDivider();

      const onEnd = event => {
        if (event.target !== control || event.propertyName !== 'transform') return;

        control.removeEventListener('transitionend', onEnd);
        revealDivider();
      };

      control.addEventListener('transitionend', onEnd);
    };

    if (mainView.classList.contains('is-controls-visible')) return waitForArrival();

    controlsObserver = new MutationObserver(() => {
      if (!mainView?.classList.contains('is-controls-visible')) return;

      controlsObserver.disconnect();
      controlsObserver = null;
      waitForArrival();
    });

    controlsObserver.observe(mainView, { attributes: true, attributeFilter: ['class'] });
  };

  const watchMenu = () => {
    menuObserver = new MutationObserver(() => {
      scheduleDividerSync();

      if (isMenuOpen()) stopAutoplay();
      else scheduleAutoplay();
    });

    menuObserver.observe(mainView, { attributes: true, attributeFilter: ['class'] });
  };

  const watchLayout = () => {
    if (typeof ResizeObserver === 'undefined') return;

    layoutObserver = new ResizeObserver(() => {
      scheduleDividerSync();
      syncViewportHeight(activeIndex);
    });

    [
      mainView.querySelector('.main-menu__content'),
      mainView.querySelector('.main-menu__list'),
      mainView.querySelector('.main-view__logo'),
      ...mainView.querySelectorAll('.main-menu__panel')
    ].filter(Boolean).forEach(element => layoutObserver.observe(element));

    if (viewport) layoutObserver.observe(viewport);
  };

  /* =========================================================
     CREATE HOME
     ========================================================= */

  const createHome = () => {
    if (!mainView || document.getElementById('homeView')) return;

    homeView = createElement('section', 'home-view');
    homeView.id = 'homeView';
    homeView.setAttribute('aria-label', 'Václav Buchtelík home');

    divider = createElement('div', 'home-view__divider');
    divider.setAttribute('aria-hidden', 'true');

    homeView.append(divider, createCarousel());
    mainView.appendChild(homeView);

    syncDivider();
    watchControls();
    watchMenu();
    watchLayout();
  };

  const findMain = () => {
    mainView = document.getElementById('mainView');
    if (!mainView) return false;

    createHome();
    return true;
  };

  /* =========================================================
     GLOBAL EVENTS
     ========================================================= */

  const handleResize = () => {
    scheduleDividerSync();
    syncViewportHeight(activeIndex);
  };

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else scheduleAutoplay();
  });

  if (!findMain()) {
    mainObserver = new MutationObserver(() => {
      if (!findMain()) return;

      mainObserver.disconnect();
      mainObserver = null;
    });

    mainObserver.observe(document.body, { childList: true });
  }

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener('pagehide', () => {
    mainObserver?.disconnect();
    controlsObserver?.disconnect();
    menuObserver?.disconnect();
    layoutObserver?.disconnect();

    stopAutoplay();

    if (syncFrame !== null) cancelAnimationFrame(syncFrame);
  }, { once: true });
})();
