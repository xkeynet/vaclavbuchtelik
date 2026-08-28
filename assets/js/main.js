'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — MAIN
   ========================================================= */

(() => {
  /* =========================================================
     ASSETS
     ========================================================= */

  const MAIN_LOGO_SRC =
    '/assets/vb-logo2.png';

  const HAMBURGER_ICON_SRC =
    '/assets/icons/hamburger.svg';

  const CROSS_ICON_SRC =
    '/assets/icons/cross.svg';

  const SEARCH_ICON_SRC =
    '/assets/icons/search.svg';

  const CHEVRON_ICON_SRC =
    '/assets/icons/arrow-down.svg';

  /* =========================================================
     MENU ICON PRELOAD
     ========================================================= */

  const crossIconPreload =
    new Image();

  crossIconPreload.decoding =
    'sync';

  crossIconPreload.src =
    CROSS_ICON_SRC;

  /* =========================================================
     TIMING
     ========================================================= */

  const MAIN_LOGO_DELAY_MS = 3000;
  const MAIN_LOGO_ANIMATION_MS = 2400;

  /* =========================================================
     STATE
     ========================================================= */

  let mainCreated = false;

  let mainLogoTimer = null;
  let mainControlsTimer = null;

  let activeIndex = 0;
  let openIndex = -1;

  let menuOpen = false;
  let draggingSaber = false;

  let saberSyncFrame = null;
  let menuResizeObserver = null;

  /* =========================================================
     REFERENCES
     ========================================================= */

  let mainView = null;

  let menuButton = null;
  let menuIcon = null;

  let menuList = null;
  let menuItems = [];

  let saber = null;
  let saberHandle = null;

  /* =========================================================
     ELEMENT HELPERS
     ========================================================= */

  const createElement = (
    tagName,
    className = ''
  ) => {
    const element =
      document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    return element;
  };

  const createIcon = (
    src,
    className,
    alt = ''
  ) => {
    const image =
      document.createElement('img');

    image.className = className;
    image.src = src;
    image.alt = alt;

    image.decoding = 'async';
    image.draggable = false;

    return image;
  };

  /* =========================================================
     MENU ICON STATE
     ========================================================= */

  const syncMenuIcon = () => {
    if (
      !menuButton ||
      !menuIcon
    ) {
      return;
    }

    menuIcon.src =
      menuOpen
        ? CROSS_ICON_SRC
        : HAMBURGER_ICON_SRC;

    menuButton.setAttribute(
      'aria-label',
      menuOpen
        ? 'Close menu'
        : 'Menu'
    );

    menuButton.setAttribute(
      'aria-expanded',
      menuOpen
        ? 'true'
        : 'false'
    );
  };

  /* =========================================================
     MENU VISIBILITY
     ========================================================= */

  const openMainMenu = () => {
    if (
      !mainView ||
      menuOpen
    ) {
      return;
    }

    menuOpen = true;

    syncMenuIcon();

    mainView.classList.add(
      'is-menu-visible'
    );

    window.requestAnimationFrame(
      () => {
        window.requestAnimationFrame(
          () => {
            scheduleSaberSync();
          }
        );
      }
    );
  };

  const closeMainMenu = () => {
    if (
      !mainView ||
      !menuOpen
    ) {
      return;
    }

    menuOpen = false;

    mainView.classList.remove(
      'is-menu-visible'
    );

    syncMenuIcon();
  };

  const toggleMainMenu = () => {
    if (menuOpen) {
      closeMainMenu();
      return;
    }

    openMainMenu();
  };

  /* =========================================================
     MAIN HEADER
     ========================================================= */

  const createHeader = () => {
    const header = createElement(
      'header',
      'main-view__header'
    );

    /* ---------------------------------------------------------
       HAMBURGER / CLOSE
       --------------------------------------------------------- */

    menuButton = createElement(
      'button',
      'main-view__header-button main-view__header-button--menu'
    );

    menuButton.type = 'button';

    menuButton.setAttribute(
      'aria-label',
      'Menu'
    );

    menuButton.setAttribute(
      'aria-expanded',
      'false'
    );

    menuIcon = createIcon(
      HAMBURGER_ICON_SRC,
      'main-view__header-icon main-view__header-icon--hamburger'
    );

    menuIcon.id =
      'mainMenuControlIcon';

    menuButton.appendChild(
      menuIcon
    );

    menuButton.addEventListener(
      'click',
      (event) => {
        event.preventDefault();

        toggleMainMenu();
      }
    );

    /* ---------------------------------------------------------
       SEARCH
       --------------------------------------------------------- */

    const searchButton = createElement(
      'button',
      'main-view__header-button main-view__header-button--search'
    );

    searchButton.type = 'button';

    searchButton.setAttribute(
      'aria-label',
      'Search'
    );

    const searchIcon = createIcon(
      SEARCH_ICON_SRC,
      'main-view__header-icon main-view__header-icon--search'
    );

    searchButton.appendChild(
      searchIcon
    );

    /* ---------------------------------------------------------
       HEADER STRUCTURE
       --------------------------------------------------------- */

    header.appendChild(
      menuButton
    );

    header.appendChild(
      searchButton
    );

    return header;
  };

  /* =========================================================
     MAIN LOGO
     ========================================================= */

  const createLogo = () => {
    const logo = createIcon(
      MAIN_LOGO_SRC,
      'main-view__logo',
      'Václav Buchtelík'
    );

    logo.id = 'mainLogo';

    return logo;
  };

  /* =========================================================
     CHEVRON
     ========================================================= */

  const createChevronButton = (
    label
  ) => {
    const button = createElement(
      'button',
      'main-menu__chevron-button'
    );

    button.type = 'button';

    button.setAttribute(
      'aria-label',
      `Open ${label}`
    );

    button.setAttribute(
      'aria-expanded',
      'false'
    );

    const icon = createIcon(
      CHEVRON_ICON_SRC,
      'main-menu__chevron'
    );

    icon.setAttribute(
      'aria-hidden',
      'true'
    );

    icon.dataset.turns = '0';

    icon.style.setProperty(
      '--chev-spin',
      '0deg'
    );

    button.appendChild(
      icon
    );

    return button;
  };

  /* =========================================================
     MENU ITEM
     ========================================================= */

  const createMenuItem = (
    key,
    label
  ) => {
    const item = createElement(
      'li',
      'main-menu__item'
    );

    item.dataset.key = key;

    const labelElement = createElement(
      'span',
      'main-menu__label'
    );

    labelElement.textContent = label;

    const chevronButton =
      createChevronButton(label);

    item.appendChild(
      labelElement
    );

    item.appendChild(
      chevronButton
    );

    return item;
  };

  /* =========================================================
     MENU PANEL
     ========================================================= */

  const createMenuPanel = (
    content
  ) => {
    const panel = createElement(
      'li',
      'main-menu__panel'
    );

    panel.setAttribute(
      'aria-hidden',
      'true'
    );

    const inner = createElement(
      'div',
      'main-menu__panel-inner'
    );

    if (content) {
      inner.appendChild(content);
    }

    panel.appendChild(inner);

    return panel;
  };

  /* =========================================================
     ABOUT PANEL
     ========================================================= */

  const createAboutContent = () => {
    const about = createElement(
      'div',
      'main-menu__text main-menu__about'
    );

    about.innerHTML =
      'Václav Buchtelík is a Czech painter and collage artist born in 1990. ' +
      'He graduated from the Faculty of Art at the University of Ostrava under Daniel Balabán. ' +
      'He lives and works in Ostrava.';

    return about;
  };

  /* =========================================================
     MY ART PANEL
     ========================================================= */

  const createArtContent = () => {
    const art = createElement(
      'div',
      'main-menu__art'
    );

    const text = createElement(
      'p',
      'main-menu__text'
    );

    text.textContent =
      'Selected works by Václav Buchtelík.';

    const enterButton = createElement(
      'button',
      'main-menu__art-enter'
    );

    enterButton.type = 'button';

    enterButton.textContent = 'ENTER';

    enterButton.setAttribute(
      'aria-label',
      'Enter My Art'
    );

    enterButton.addEventListener(
      'click',
      () => {
        window.dispatchEvent(
          new CustomEvent(
            'vb:gallery-enter'
          )
        );
      }
    );

    art.appendChild(text);
    art.appendChild(enterButton);

    return art;
  };

  /* =========================================================
     VISION PANEL
     ========================================================= */

  const createVisionContent = () => {
    const vision = createElement(
      'div',
      'main-menu__text main-menu__vision'
    );

    vision.textContent =
      'Václav Buchtelík develops an expressive body of work concerned with anxiety, societal fears and apocalyptic themes.';

    return vision;
  };

  /* =========================================================
     CONTACT PANEL
     ========================================================= */

  const createContactContent = () => {
    const contact = createElement(
      'div',
      'main-menu__text main-menu__contact'
    );

    contact.textContent =
      'Contact information will be added here.';

    return contact;
  };

  /* =========================================================
     SABER
     ========================================================= */

  const createSaberSlot = () => {
    const slot = createElement(
      'li',
      'main-menu__saber-slot'
    );

    slot.setAttribute(
      'aria-hidden',
      'true'
    );

    saber = createElement(
      'div',
      'main-menu__saber'
    );

    saber.id = 'mainMenuSaber';

    saberHandle = createElement(
      'div',
      'main-menu__saber-handle'
    );

    saberHandle.id =
      'mainMenuSaberHandle';

    slot.appendChild(saber);
    slot.appendChild(saberHandle);

    return slot;
  };

  /* =========================================================
     MENU STRUCTURE
     ========================================================= */

  const createMenu = () => {
    const menu = createElement(
      'nav',
      'main-menu'
    );

    menu.setAttribute(
      'aria-label',
      'Main navigation'
    );

    const content = createElement(
      'div',
      'main-menu__content'
    );

    menuList = createElement(
      'ul',
      'main-menu__list'
    );

    menuList.id = 'mainMenuList';

    /* ---------------------------------------------------------
       SABER
       --------------------------------------------------------- */

    menuList.appendChild(
      createSaberSlot()
    );

    /* ---------------------------------------------------------
       ABOUT
       --------------------------------------------------------- */

    menuList.appendChild(
      createMenuItem(
        'about',
        'ABOUT'
      )
    );

    menuList.appendChild(
      createMenuPanel(
        createAboutContent()
      )
    );

    /* ---------------------------------------------------------
       MY ART
       --------------------------------------------------------- */

    menuList.appendChild(
      createMenuItem(
        'art',
        'MY ART'
      )
    );

    menuList.appendChild(
      createMenuPanel(
        createArtContent()
      )
    );

    /* ---------------------------------------------------------
       VISION
       --------------------------------------------------------- */

    menuList.appendChild(
      createMenuItem(
        'vision',
        'VISION'
      )
    );

    menuList.appendChild(
      createMenuPanel(
        createVisionContent()
      )
    );

    /* ---------------------------------------------------------
       CONTACT
       --------------------------------------------------------- */

    menuList.appendChild(
      createMenuItem(
        'contact',
        'CONTACT'
      )
    );

    menuList.appendChild(
      createMenuPanel(
        createContactContent()
      )
    );

    /* ---------------------------------------------------------
       DIVIDER
       --------------------------------------------------------- */

    const divider = createElement(
      'div',
      'main-menu__divider'
    );

    content.appendChild(
      menuList
    );

    content.appendChild(
      divider
    );

    menu.appendChild(
      content
    );

    return menu;
  };

  /* =========================================================
     SABER POSITION
     ========================================================= */

  const syncSaberToActive = () => {
    if (
      !menuList ||
      !saber ||
      !menuItems.length
    ) {
      return;
    }

    const activeItem =
      menuItems[activeIndex];

    if (!activeItem) {
      return;
    }

    const listRect =
      menuList.getBoundingClientRect();

    const itemRect =
      activeItem.getBoundingClientRect();

    const saberHeight =
      parseFloat(
        window
          .getComputedStyle(saber)
          .height
      );

    if (
      !Number.isFinite(
        saberHeight
      )
    ) {
      return;
    }

    let y =
      (
        itemRect.top -
        listRect.top
      ) +
      (
        itemRect.height / 2
      ) -
      (
        saberHeight / 2
      );

    const lastItem =
      menuItems[
        menuItems.length - 1
      ];

    const lastRect =
      lastItem.getBoundingClientRect();

    const lastCenterY =
      (
        lastRect.top -
        listRect.top
      ) +
      (
        lastRect.height / 2
      ) -
      (
        saberHeight / 2
      );

    const maxY =
      Math.max(
        0,
        lastCenterY
      );

    y =
      Math.max(
        0,
        Math.min(
          y,
          maxY
        )
      );

    saber.style.transform =
      `translate3d(0, ${y}px, 0)`;
  };

  /* =========================================================
     SABER SYNC SCHEDULER
     ========================================================= */

  const scheduleSaberSync = () => {
    if (saberSyncFrame !== null) {
      window.cancelAnimationFrame(
        saberSyncFrame
      );
    }

    saberSyncFrame =
      window.requestAnimationFrame(
        () => {
          saberSyncFrame = null;

          syncSaberToActive();
        }
      );
  };

  /* =========================================================
     SABER LAYOUT OBSERVER
     ========================================================= */

  const bindSaberLayoutSync = () => {
    if (!menuList) {
      return;
    }

    const panels = Array.from(
      menuList.querySelectorAll(
        '.main-menu__panel'
      )
    );

    panels.forEach(
      (panel) => {
        panel.addEventListener(
          'transitionrun',
          scheduleSaberSync
        );

        panel.addEventListener(
          'transitionend',
          scheduleSaberSync
        );

        panel.addEventListener(
          'transitioncancel',
          scheduleSaberSync
        );
      }
    );

    if (
      typeof ResizeObserver ===
      'undefined'
    ) {
      return;
    }

    menuResizeObserver =
      new ResizeObserver(
        () => {
          scheduleSaberSync();
        }
      );

    menuResizeObserver.observe(
      menuList
    );

    menuItems.forEach(
      (item) => {
        menuResizeObserver.observe(
          item
        );
      }
    );

    panels.forEach(
      (panel) => {
        menuResizeObserver.observe(
          panel
        );

        const inner =
          panel.querySelector(
            '.main-menu__panel-inner'
          );

        if (inner) {
          menuResizeObserver.observe(
            inner
          );
        }
      }
    );
  };

  /* =========================================================
     ACTIVE ITEM
     ========================================================= */

  const setActive = (index) => {
    if (!menuItems.length) {
      return;
    }

    const next =
      Math.max(
        0,
        Math.min(
          menuItems.length - 1,
          index
        )
      );

    menuItems.forEach(
      (item, itemIndex) => {
        item.classList.toggle(
          'is-active',
          itemIndex === next
        );
      }
    );

    activeIndex = next;

    scheduleSaberSync();
  };

  /* =========================================================
     CHEVRON ROTATION
     ========================================================= */

  const spinChevron = (
    item,
    isOpen
  ) => {
    const chevron =
      item.querySelector(
        '.main-menu__chevron'
      );

    if (!chevron) {
      return;
    }

    const currentTurns =
      parseInt(
        chevron.dataset.turns || '0',
        10
      );

    const nextTurns =
      currentTurns + 1;

    chevron.dataset.turns =
      String(nextTurns);

    const baseAngle =
      isOpen
        ? 180
        : 0;

    const angle =
      (
        nextTurns * 360
      ) +
      baseAngle;

    chevron.style.setProperty(
      '--chev-spin',
      `${angle}deg`
    );
  };

  /* =========================================================
     PANEL HELPERS
     ========================================================= */

  const getPanelForItem = (
    item
  ) => {
    if (!item) {
      return null;
    }

    const panel =
      item.nextElementSibling;

    if (
      !panel ||
      !panel.classList.contains(
        'main-menu__panel'
      )
    ) {
      return null;
    }

    return panel;
  };

  /* =========================================================
     CLOSE ITEM
     ========================================================= */

  const closeItem = (
    index
  ) => {
    const item =
      menuItems[index];

    if (!item) {
      return;
    }

    item.classList.remove(
      'is-open'
    );

    spinChevron(
      item,
      false
    );

    const button =
      item.querySelector(
        '.main-menu__chevron-button'
      );

    if (button) {
      button.setAttribute(
        'aria-expanded',
        'false'
      );
    }

    const panel =
      getPanelForItem(item);

    if (panel) {
      panel.setAttribute(
        'aria-hidden',
        'true'
      );
    }

    if (openIndex === index) {
      openIndex = -1;
    }

    scheduleSaberSync();
  };

  /* =========================================================
     OPEN ITEM
     ========================================================= */

  const openItem = (
    index
  ) => {
    if (
      index < 0 ||
      index >= menuItems.length
    ) {
      return;
    }

    if (openIndex === index) {
      return;
    }

    if (openIndex !== -1) {
      closeItem(openIndex);
    }

    const item =
      menuItems[index];

    item.classList.add(
      'is-open'
    );

    spinChevron(
      item,
      true
    );

    const button =
      item.querySelector(
        '.main-menu__chevron-button'
      );

    if (button) {
      button.setAttribute(
        'aria-expanded',
        'true'
      );
    }

    const panel =
      getPanelForItem(item);

    if (panel) {
      panel.setAttribute(
        'aria-hidden',
        'false'
      );
    }

    openIndex = index;

    scheduleSaberSync();
  };

  /* =========================================================
     TOGGLE ITEM
     ========================================================= */

  const toggleItem = (
    index
  ) => {
    if (openIndex === index) {
      closeItem(index);
      return;
    }

    openItem(index);
  };

  /* =========================================================
     MENU EVENTS
     ========================================================= */

  const bindMenuEvents = () => {
    menuItems = Array.from(
      menuList.querySelectorAll(
        '.main-menu__item'
      )
    );

    if (!menuItems.length) {
      return;
    }

    menuItems.forEach(
      (item, index) => {
        const label =
          item.querySelector(
            '.main-menu__label'
          );

        const button =
          item.querySelector(
            '.main-menu__chevron-button'
          );

        if (label) {
          label.addEventListener(
            'click',
            (event) => {
              event.preventDefault();

              setActive(index);
            }
          );
        }

        if (button) {
          button.addEventListener(
            'click',
            (event) => {
              event.preventDefault();
              event.stopPropagation();

              setActive(index);
              toggleItem(index);
            }
          );
        }
      }
    );

    setActive(0);
  };

  /* =========================================================
     SABER HIT TEST
     ========================================================= */

  const pickIndexFromClientY = (
    clientY
  ) => {
    let bestIndex = 0;
    let bestDistance = Infinity;

    menuItems.forEach(
      (item, index) => {
        const rect =
          item.getBoundingClientRect();

        const centerY =
          rect.top +
          (
            rect.height / 2
          );

        const distance =
          Math.abs(
            clientY -
            centerY
          );

        if (
          distance <
          bestDistance
        ) {
          bestDistance =
            distance;

          bestIndex =
            index;
        }
      }
    );

    return bestIndex;
  };

  /* =========================================================
     SABER DRAG
     ========================================================= */

  const bindSaberEvents = () => {
    if (!saberHandle) {
      return;
    }

    saberHandle.addEventListener(
      'touchstart',
      (event) => {
        if (
          !event.touches ||
          !event.touches.length
        ) {
          return;
        }

        draggingSaber = true;

        const clientY =
          event.touches[0].clientY;

        setActive(
          pickIndexFromClientY(
            clientY
          )
        );
      },
      {
        passive: true
      }
    );

    saberHandle.addEventListener(
      'touchmove',
      (event) => {
        if (
          !draggingSaber ||
          !event.touches ||
          !event.touches.length
        ) {
          return;
        }

        const clientY =
          event.touches[0].clientY;

        setActive(
          pickIndexFromClientY(
            clientY
          )
        );
      },
      {
        passive: true
      }
    );

    saberHandle.addEventListener(
      'touchend',
      () => {
        draggingSaber = false;

        scheduleSaberSync();
      },
      {
        passive: true
      }
    );

    saberHandle.addEventListener(
      'touchcancel',
      () => {
        draggingSaber = false;

        scheduleSaberSync();
      },
      {
        passive: true
      }
    );

    saberHandle.addEventListener(
      'pointerdown',
      (event) => {
        if (
          event.pointerType ===
          'touch'
        ) {
          return;
        }

        draggingSaber = true;

        saberHandle.setPointerCapture?.(
          event.pointerId
        );

        setActive(
          pickIndexFromClientY(
            event.clientY
          )
        );
      }
    );

    saberHandle.addEventListener(
      'pointermove',
      (event) => {
        if (
          !draggingSaber ||
          event.pointerType ===
            'touch'
        ) {
          return;
        }

        setActive(
          pickIndexFromClientY(
            event.clientY
          )
        );
      }
    );

    saberHandle.addEventListener(
      'pointerup',
      (event) => {
        draggingSaber = false;

        if (
          saberHandle.hasPointerCapture?.(
            event.pointerId
          )
        ) {
          saberHandle.releasePointerCapture(
            event.pointerId
          );
        }

        scheduleSaberSync();
      }
    );

    saberHandle.addEventListener(
      'pointercancel',
      () => {
        draggingSaber = false;

        scheduleSaberSync();
      }
    );
  };

  /* =========================================================
     MAIN ARRIVAL
     ========================================================= */

  const startMainArrival = () => {
    if (!mainView) {
      return;
    }

    mainLogoTimer =
      window.setTimeout(
        () => {
          window.requestAnimationFrame(
            () => {
              window.requestAnimationFrame(
                () => {
                  if (!mainView) {
                    return;
                  }

                  mainView.classList.add(
                    'is-logo-visible'
                  );
                }
              );
            }
          );

          mainLogoTimer = null;

          mainControlsTimer =
            window.setTimeout(
              () => {
                if (!mainView) {
                  return;
                }

                mainView.classList.add(
                  'is-controls-visible'
                );

                mainControlsTimer =
                  null;
              },
              MAIN_LOGO_ANIMATION_MS
            );
        },
        MAIN_LOGO_DELAY_MS
      );
  };

  /* =========================================================
     CREATE MAIN
     ========================================================= */

  const createMain = () => {
    if (mainCreated) {
      return;
    }

    mainCreated = true;

    mainView = createElement(
      'section',
      'main-view'
    );

    mainView.id = 'mainView';

    mainView.setAttribute(
      'aria-label',
      'Václav Buchtelík main website'
    );

    /* ---------------------------------------------------------
       HEADER
       --------------------------------------------------------- */

    const header =
      createHeader();

    /* ---------------------------------------------------------
       LOGO
       --------------------------------------------------------- */

    const logo =
      createLogo();

    /* ---------------------------------------------------------
       MENU
       --------------------------------------------------------- */

    const menu =
      createMenu();

    /* ---------------------------------------------------------
       BUILD
       --------------------------------------------------------- */

    mainView.appendChild(
      header
    );

    mainView.appendChild(
      logo
    );

    mainView.appendChild(
      menu
    );

    document.body.appendChild(
      mainView
    );

    /* ---------------------------------------------------------
       EVENTS
       --------------------------------------------------------- */

    bindMenuEvents();
    bindSaberEvents();
    bindSaberLayoutSync();

    syncMenuIcon();

    /* ---------------------------------------------------------
       SHOW MAIN
       --------------------------------------------------------- */

    window.requestAnimationFrame(
      () => {
        window.requestAnimationFrame(
          () => {
            if (!mainView) {
              return;
            }

            mainView.classList.add(
              'is-visible'
            );

            scheduleSaberSync();
          }
        );
      }
    );

    /* ---------------------------------------------------------
       START ARRIVAL
       --------------------------------------------------------- */

    startMainArrival();
  };

  /* =========================================================
     RESIZE
     ========================================================= */

  const handleResize = () => {
    if (!mainView) {
      return;
    }

    scheduleSaberSync();
  };

  window.addEventListener(
    'resize',
    handleResize,
    {
      passive: true
    }
  );

  window.addEventListener(
    'orientationchange',
    handleResize,
    {
      passive: true
    }
  );

  /* =========================================================
     MAIN ENTER EVENT
     ========================================================= */

  window.addEventListener(
    'vb:main-enter',
    createMain
  );

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener(
    'pagehide',
    () => {
      if (
        mainLogoTimer !== null
      ) {
        window.clearTimeout(
          mainLogoTimer
        );

        mainLogoTimer = null;
      }

      if (
        mainControlsTimer !== null
      ) {
        window.clearTimeout(
          mainControlsTimer
        );

        mainControlsTimer = null;
      }

      if (
        saberSyncFrame !== null
      ) {
        window.cancelAnimationFrame(
          saberSyncFrame
        );

        saberSyncFrame = null;
      }

      if (menuResizeObserver) {
        menuResizeObserver.disconnect();

        menuResizeObserver = null;
      }

      draggingSaber = false;
      menuOpen = false;
    },
    {
      once: true
    }
  );
})();
