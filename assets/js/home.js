'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — HOME
   ========================================================= */

(() => {
  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const DIVIDER_LOGO_GAP_PX = 8;
  const SLIDE_INTERVAL_MS = 3000;
  const SLIDE_TRANSITION_FALLBACK_MS = 1300;

  const HOME_SLIDES = [
    {
      image: '/assets/home/home-001.jpg',
      title: 'Z optimistických nálad tvořit nedokážu'
    },
    {
      image: '/assets/home/home-002.png',
      title: 'Dým 2019'
    },
    {
      image: '/assets/home/home-003.png',
      title: 'Dítě 2019'
    },
    {
      image: '/assets/home/home-004.png',
      title: 'Koukej 2019'
    },
    {
      image: '/assets/home/home-005.png',
      title: 'Trhej! 2019'
    },
    {
      image: '/assets/home/home-006.png',
      title: 'Skok do ohně 2020'
    },
    {
      image: '/assets/home/home-007.png',
      title: 'Schody do pekla 2020'
    }
  ];

  /* =========================================================
     STATE
     ========================================================= */

  let homeCreated = false;
  let dividerVisible = false;
  let carouselVisible = false;

  let activeIndex = 0;
  let transitionLocked = false;
  let wrappingToFirst = false;

  let mainView = null;
  let homeView = null;
  let divider = null;
  let carouselTrack = null;

  let indicatorButtons = [];

  let mainObserver = null;
  let controlsObserver = null;
  let menuStateObserver = null;
  let layoutObserver = null;

  let syncFrame = null;
  let autoplayTimer = null;
  let transitionFallbackTimer = null;

  /* =========================================================
     HELPERS
     ========================================================= */

  const createElement = (tagName, className = '') => {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    return element;
  };

  const isMenuOpen = () =>
    Boolean(
      mainView &&
      mainView.classList.contains('is-menu-visible')
    );

  /* =========================================================
     DIVIDER POSITION
     ========================================================= */

  const getClosedDividerY = () => {
    if (!mainView) return 0;

    const logo =
      mainView.querySelector('.main-view__logo');

    if (!logo) return 0;

    const mainRect =
      mainView.getBoundingClientRect();

    const logoRect =
      logo.getBoundingClientRect();

    return (
      logoRect.bottom -
      mainRect.top +
      DIVIDER_LOGO_GAP_PX
    );
  };

  const getOpenDividerY = () => {
    if (!mainView) return 0;

    const originalDivider =
      mainView.querySelector('.main-menu__divider');

    if (!originalDivider) {
      return getClosedDividerY();
    }

    const mainRect =
      mainView.getBoundingClientRect();

    const dividerRect =
      originalDivider.getBoundingClientRect();

    return dividerRect.top - mainRect.top;
  };

  const syncDividerPosition = () => {
    if (!mainView || !homeView || !divider) {
      return;
    }

    const targetY =
      isMenuOpen()
        ? getOpenDividerY()
        : getClosedDividerY();

    homeView.style.setProperty(
      '--home-divider-y',
      `${targetY}px`
    );
  };

  const scheduleDividerSync = () => {
    if (syncFrame !== null) {
      cancelAnimationFrame(syncFrame);
    }

    syncFrame = requestAnimationFrame(() => {
      syncFrame = null;
      syncDividerPosition();
    });
  };

  /* =========================================================
     INDICATORS
     ========================================================= */

  const updateIndicators = () => {
    indicatorButtons.forEach((button, index) => {
      const active =
        index === activeIndex;

      button.classList.toggle(
        'is-active',
        active
      );

      button.setAttribute(
        'aria-current',
        active ? 'true' : 'false'
      );
    });
  };

  /* =========================================================
     TRACK
     ========================================================= */

  const setTrackIndex = index => {
    if (!carouselTrack) return;

    carouselTrack.style.setProperty(
      '--home-track-index',
      String(index)
    );
  };

  const clearTransitionFallback = () => {
    if (transitionFallbackTimer === null) {
      return;
    }

    clearTimeout(transitionFallbackTimer);
    transitionFallbackTimer = null;
  };

  const resetLoopPosition = () => {
    if (!carouselTrack) return;

    carouselTrack.classList.add('is-jump');
    setTrackIndex(0);

    carouselTrack.getBoundingClientRect();

    requestAnimationFrame(() => {
      if (!carouselTrack) return;

      carouselTrack.classList.remove('is-jump');
    });
  };

  const finishSlideTransition = () => {
    clearTransitionFallback();

    if (wrappingToFirst) {
      resetLoopPosition();
      wrappingToFirst = false;
    }

    transitionLocked = false;
  };

  const handleTrackTransitionEnd = event => {
    if (
      event.target !== carouselTrack ||
      event.propertyName !== 'transform'
    ) {
      return;
    }

    finishSlideTransition();
  };

  /* =========================================================
     AUTOPLAY
     ========================================================= */

  const stopAutoplay = () => {
    if (autoplayTimer === null) return;

    clearInterval(autoplayTimer);
    autoplayTimer = null;
  };

  const startAutoplay = () => {
    stopAutoplay();

    if (
      !carouselVisible ||
      isMenuOpen() ||
      document.hidden
    ) {
      return;
    }

    autoplayTimer = window.setInterval(() => {
      if (transitionLocked) return;

      const nextIndex =
        (activeIndex + 1) %
        HOME_SLIDES.length;

      goToSlide(nextIndex);
    }, SLIDE_INTERVAL_MS);
  };

  /* =========================================================
     GO TO SLIDE
     ========================================================= */

  const goToSlide = (nextIndex, manual = false) => {
    if (
      !carouselTrack ||
      transitionLocked ||
      nextIndex < 0 ||
      nextIndex >= HOME_SLIDES.length
    ) {
      return;
    }

    if (nextIndex === activeIndex) {
      if (manual) startAutoplay();
      return;
    }

    transitionLocked = true;

    wrappingToFirst =
      activeIndex === HOME_SLIDES.length - 1 &&
      nextIndex === 0;

    activeIndex = nextIndex;

    setTrackIndex(
      wrappingToFirst
        ? HOME_SLIDES.length
        : nextIndex
    );

    updateIndicators();

    clearTransitionFallback();

    transitionFallbackTimer =
      window.setTimeout(
        finishSlideTransition,
        SLIDE_TRANSITION_FALLBACK_MS
      );

    if (manual) {
      startAutoplay();
    }
  };

  /* =========================================================
     SLIDE
     ========================================================= */

  const createSlide = (slide, duplicate = false) => {
    const article =
      createElement(
        'article',
        'home-carousel__slide'
      );

    if (duplicate) {
      article.setAttribute(
        'aria-hidden',
        'true'
      );
    }

    const media =
      createElement(
        'div',
        'home-carousel__media'
      );

    const image =
      document.createElement('img');

    image.className =
      'home-carousel__image';

    image.src = slide.image;
    image.alt = slide.title;
    image.decoding = 'async';
    image.draggable = false;

    if (
      slide === HOME_SLIDES[0] &&
      !duplicate
    ) {
      image.fetchPriority = 'high';
    }

    media.appendChild(image);

    /* ---------------------------------------------------------
       CAPTION
       --------------------------------------------------------- */

    const caption =
      createElement(
        'div',
        'home-carousel__caption'
      );

    const captionInner =
      createElement(
        'div',
        'home-carousel__caption-inner'
      );

    const logo =
      document.createElement('img');

    logo.className =
      'home-carousel__caption-logo';

    logo.src =
      '/assets/vb-logo.png';

    logo.alt =
      'Václav Buchtelík';

    logo.decoding = 'async';
    logo.draggable = false;

    const separator =
      createElement(
        'span',
        'home-carousel__caption-separator'
      );

    separator.setAttribute(
      'aria-hidden',
      'true'
    );

    const title =
      createElement(
        'span',
        'home-carousel__caption-title'
      );

    title.textContent =
      slide.title;

    captionInner.append(
      logo,
      separator,
      title
    );

    caption.appendChild(
      captionInner
    );

    article.append(
      media,
      caption
    );

    return article;
  };

  /* =========================================================
     INDICATOR NAVIGATION
     ========================================================= */

  const createIndicators = () => {
    const indicators =
      createElement(
        'div',
        'home-carousel__indicators'
      );

    indicators.setAttribute(
      'aria-label',
      'Artwork carousel navigation'
    );

    indicatorButtons =
      HOME_SLIDES.map(
        (slide, index) => {
          const button =
            createElement(
              'button',
              'home-carousel__indicator'
            );

          button.type = 'button';

          button.setAttribute(
            'aria-label',
            `Show artwork ${index + 1}: ${slide.title}`
          );

          const line =
            document.createElement('img');

          line.className =
            'home-carousel__indicator-line';

          line.src =
            '/assets/icons/line.svg';

          line.alt = '';
          line.draggable = false;

          button.appendChild(line);

          button.addEventListener(
            'click',
            event => {
              event.preventDefault();

              goToSlide(
                index,
                true
              );
            }
          );

          indicators.appendChild(
            button
          );

          return button;
        }
      );

    updateIndicators();

    return indicators;
  };

  /* =========================================================
     CAROUSEL
     ========================================================= */

  const createCarousel = () => {
    const content =
      createElement(
        'div',
        'home-view__content'
      );

    const carousel =
      createElement(
        'section',
        'home-carousel'
      );

    carousel.setAttribute(
      'aria-label',
      'Selected works by Václav Buchtelík'
    );

    const viewport =
      createElement(
        'div',
        'home-carousel__viewport'
      );

    carouselTrack =
      createElement(
        'div',
        'home-carousel__track'
      );

    carouselTrack.style.setProperty(
      '--home-track-index',
      '0'
    );

    carouselTrack.addEventListener(
      'transitionend',
      handleTrackTransitionEnd
    );

    HOME_SLIDES.forEach(slide => {
      carouselTrack.appendChild(
        createSlide(slide)
      );
    });

    carouselTrack.appendChild(
      createSlide(
        HOME_SLIDES[0],
        true
      )
    );

    viewport.appendChild(
      carouselTrack
    );

    const indicators =
      createIndicators();

    const sectionDivider =
      createElement(
        'div',
        'home-carousel__section-divider'
      );

    sectionDivider.setAttribute(
      'aria-hidden',
      'true'
    );

    carousel.append(
      viewport,
      indicators,
      sectionDivider
    );

    content.appendChild(
      carousel
    );

    return content;
  };

  /* =========================================================
     ARRIVAL
     ========================================================= */

  const revealCarousel = () => {
    if (
      !homeView ||
      carouselVisible
    ) {
      return;
    }

    carouselVisible = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!homeView) return;

        homeView.classList.add(
          'is-carousel-visible'
        );

        startAutoplay();
      });
    });
  };

  const revealDivider = () => {
    if (
      !homeView ||
      dividerVisible
    ) {
      return;
    }

    syncDividerPosition();
    dividerVisible = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!homeView) return;

        homeView.classList.add(
          'is-divider-visible'
        );

        window.setTimeout(
          revealCarousel,
          180
        );
      });
    });
  };

  /* =========================================================
     CONTROLS ARRIVAL
     ========================================================= */

  const waitForControlsArrival = () => {
    if (
      !mainView ||
      dividerVisible
    ) {
      return;
    }

    const control =
      mainView.querySelector(
        '.main-view__header-button'
      );

    if (!control) {
      revealDivider();
      return;
    }

    const handleTransitionEnd = event => {
      if (
        event.target !== control ||
        event.propertyName !== 'transform'
      ) {
        return;
      }

      control.removeEventListener(
        'transitionend',
        handleTransitionEnd
      );

      revealDivider();
    };

    control.addEventListener(
      'transitionend',
      handleTransitionEnd
    );
  };

  const watchControls = () => {
    if (!mainView) return;

    if (
      mainView.classList.contains(
        'is-controls-visible'
      )
    ) {
      waitForControlsArrival();
      return;
    }

    controlsObserver =
      new MutationObserver(() => {
        if (
          !mainView ||
          !mainView.classList.contains(
            'is-controls-visible'
          )
        ) {
          return;
        }

        if (controlsObserver) {
          controlsObserver.disconnect();
          controlsObserver = null;
        }

        waitForControlsArrival();
      });

    controlsObserver.observe(
      mainView,
      {
        attributes: true,
        attributeFilter: ['class']
      }
    );
  };

  /* =========================================================
     MENU STATE
     ========================================================= */

  const watchMenuState = () => {
    if (!mainView) return;

    menuStateObserver =
      new MutationObserver(() => {
        scheduleDividerSync();

        if (isMenuOpen()) {
          stopAutoplay();
        } else {
          startAutoplay();
        }
      });

    menuStateObserver.observe(
      mainView,
      {
        attributes: true,
        attributeFilter: ['class']
      }
    );
  };

  /* =========================================================
     MENU LAYOUT
     ========================================================= */

  const watchMenuLayout = () => {
    if (
      !mainView ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }

    layoutObserver =
      new ResizeObserver(
        scheduleDividerSync
      );

    [
      mainView.querySelector(
        '.main-menu__content'
      ),
      mainView.querySelector(
        '.main-menu__list'
      ),
      mainView.querySelector(
        '.main-view__logo'
      ),
      ...mainView.querySelectorAll(
        '.main-menu__panel'
      )
    ]
      .filter(Boolean)
      .forEach(element => {
        layoutObserver.observe(
          element
        );
      });
  };

  /* =========================================================
     CREATE HOME
     ========================================================= */

  const createHome = () => {
    if (
      homeCreated ||
      !mainView
    ) {
      return;
    }

    homeCreated = true;

    homeView =
      createElement(
        'section',
        'home-view'
      );

    homeView.id =
      'homeView';

    homeView.setAttribute(
      'aria-label',
      'Václav Buchtelík home'
    );

    divider =
      createElement(
        'div',
        'home-view__divider'
      );

    divider.setAttribute(
      'aria-hidden',
      'true'
    );

    homeView.append(
      divider,
      createCarousel()
    );

    mainView.appendChild(
      homeView
    );

    syncDividerPosition();
    watchControls();
    watchMenuState();
    watchMenuLayout();
  };

  /* =========================================================
     FIND MAIN
     ========================================================= */

  const findMain = () => {
    const existingMain =
      document.getElementById(
        'mainView'
      );

    if (!existingMain) {
      return false;
    }

    mainView = existingMain;
    createHome();

    return true;
  };

  /* =========================================================
     GLOBAL EVENTS
     ========================================================= */

  const handleResize = () => {
    if (!mainView) return;

    scheduleDividerSync();
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

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    }
  );

  /* =========================================================
     START
     ========================================================= */

  if (!findMain()) {
    mainObserver =
      new MutationObserver(() => {
        if (!findMain()) return;

        if (mainObserver) {
          mainObserver.disconnect();
          mainObserver = null;
        }
      });

    mainObserver.observe(
      document.body,
      {
        childList: true
      }
    );
  }

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener(
    'pagehide',
    () => {
      if (mainObserver) {
        mainObserver.disconnect();
      }

      if (controlsObserver) {
        controlsObserver.disconnect();
      }

      if (menuStateObserver) {
        menuStateObserver.disconnect();
      }

      if (layoutObserver) {
        layoutObserver.disconnect();
      }

      if (
        carouselTrack
      ) {
        carouselTrack.removeEventListener(
          'transitionend',
          handleTrackTransitionEnd
        );
      }

      stopAutoplay();
      clearTransitionFallback();

      if (syncFrame !== null) {
        cancelAnimationFrame(
          syncFrame
        );
      }

      mainObserver = null;
      controlsObserver = null;
      menuStateObserver = null;
      layoutObserver = null;
      syncFrame = null;
    },
    {
      once: true
    }
  );
})();
