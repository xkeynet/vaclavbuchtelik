'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — MAIN
   MAIN VIEW + MENU STATE
   ========================================================= */

(() => {
  /* =========================================================
     CONFIG
     ========================================================= */

  const ASSETS = {
    logo: '/assets/vb-logo2.png',
    hamburger: '/assets/icons/hamburger.svg',
    cross: '/assets/icons/cross.svg',
    search: '/assets/icons/search.svg',
    chevron: '/assets/icons/arrow-down.svg'
  };

  const MAIN_LOGO_DELAY_MS = 3000;
  const MAIN_LOGO_ANIMATION_MS = 2400;
  const ART_MENU_KEY = 'art';

  /* =========================================================
     STATE
     ========================================================= */

  let mainCreated = false;
  let menuOpen = false;
  let activeIndex = 0;
  let openIndex = -1;
  let draggingSaber = false;

  let mainLogoTimer = null;
  let mainControlsTimer = null;
  let saberSyncFrame = null;
  let menuResizeObserver = null;

  let mainView = null;
  let menuButton = null;
  let menuIcon = null;
  let menuList = null;
  let menuItems = [];
  let saber = null;
  let saberHandle = null;

  /* =========================================================
     HELPERS
     ========================================================= */

  const createElement = (tagName, className = '') => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    return element;
  };

  const createIcon = (src, className, alt = '') => {
    const image = document.createElement('img');
    image.className = className;
    image.src = src;
    image.alt = alt;
    image.decoding = 'async';
    image.draggable = false;
    return image;
  };

  const getMenuItemIndex = key => menuItems.findIndex(item => item.dataset.key === key);

  const crossIconPreload = new Image();
  crossIconPreload.decoding = 'sync';
  crossIconPreload.src = ASSETS.cross;

  /* =========================================================
     MENU VISIBILITY
     ========================================================= */

  const syncMenuIcon = () => {
    if (!menuButton || !menuIcon) return;

    menuIcon.src = menuOpen ? ASSETS.cross : ASSETS.hamburger;
    menuButton.setAttribute('aria-label', menuOpen ? 'Close menu' : 'Menu');
    menuButton.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
  };

  const openMainMenu = () => {
    if (!mainView || menuOpen) return;

    menuOpen = true;
    mainView.classList.add('is-menu-visible');
    syncMenuIcon();

    requestAnimationFrame(() => {
      requestAnimationFrame(scheduleSaberSync);
    });
  };

  const closeMainMenu = () => {
    if (!mainView || !menuOpen) return;

    menuOpen = false;
    mainView.classList.remove('is-menu-visible');
    syncMenuIcon();
  };

  const toggleMainMenu = () => {
    if (menuOpen) closeMainMenu();
    else openMainMenu();
  };

  /* =========================================================
     HEADER
     ========================================================= */

  const createHeader = () => {
    const header = createElement('header', 'main-view__header');

    menuButton = createElement('button', 'main-view__header-button main-view__header-button--menu');
    menuButton.type = 'button';
    menuButton.setAttribute('aria-label', 'Menu');
    menuButton.setAttribute('aria-expanded', 'false');

    menuIcon = createIcon(
      ASSETS.hamburger,
      'main-view__header-icon main-view__header-icon--hamburger'
    );
    menuIcon.id = 'mainMenuControlIcon';

    menuButton.appendChild(menuIcon);
    menuButton.addEventListener('click', event => {
      event.preventDefault();
      toggleMainMenu();
    });

    const searchButton = createElement(
      'button',
      'main-view__header-button main-view__header-button--search'
    );
    searchButton.type = 'button';
    searchButton.setAttribute('aria-label', 'Search');

    const searchIcon = createIcon(
      ASSETS.search,
      'main-view__header-icon main-view__header-icon--search'
    );

    searchButton.appendChild(searchIcon);
    header.append(menuButton, searchButton);

    return header;
  };

  /* =========================================================
     LOGO
     ========================================================= */

  const createLogo = () => {
    const logo = createIcon(ASSETS.logo, 'main-view__logo', 'Václav Buchtelík');
    logo.id = 'mainLogo';
    return logo;
  };

  /* =========================================================
     MENU BUILDERS
     ========================================================= */

  const createChevronButton = label => {
    const button = createElement('button', 'main-menu__chevron-button');
    button.type = 'button';
    button.setAttribute('aria-label', `Open ${label}`);
    button.setAttribute('aria-expanded', 'false');

    const icon = createIcon(ASSETS.chevron, 'main-menu__chevron');
    icon.setAttribute('aria-hidden', 'true');
    icon.dataset.turns = '0';
    icon.style.setProperty('--chev-spin', '0deg');

    button.appendChild(icon);
    return button;
  };

  const createMenuItem = (key, label) => {
    const item = createElement('li', 'main-menu__item');
    const labelElement = createElement('span', 'main-menu__label');

    item.dataset.key = key;
    labelElement.textContent = label;

    item.append(labelElement, createChevronButton(label));
    return item;
  };

  const createMenuPanel = content => {
    const panel = createElement('li', 'main-menu__panel');
    const inner = createElement('div', 'main-menu__panel-inner');

    panel.setAttribute('aria-hidden', 'true');
    if (content) inner.appendChild(content);
    panel.appendChild(inner);

    return panel;
  };

  /* =========================================================
     MENU CONTENT
     ========================================================= */

  const createAboutContent = () => {
    const about = createElement('div', 'main-menu__text main-menu__about');
    about.textContent =
      'Václav Buchtelík is a Czech painter and collage artist born in 1990. ' +
      'He graduated from the Faculty of Art at the University of Ostrava under Daniel Balabán. ' +
      'He lives and works in Ostrava.';
    return about;
  };

  const createArtContent = () => {
    const art = createElement('div', 'main-menu__art');
    const galleryButton = createElement('button', 'main-menu__art-gallery');

    galleryButton.type = 'button';
    galleryButton.textContent = 'GALLERY';
    galleryButton.setAttribute('aria-label', 'Open Gallery');

    galleryButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      /*
       * MAIN owns the menu state.
       * The MY ART panel remains logically open while the fullscreen
       * gallery temporarily hides the menu.
       */
      closeMainMenu();
      window.dispatchEvent(new CustomEvent('vb:gallery-open-view'));
    });

    art.appendChild(galleryButton);
    return art;
  };

  const createVisionContent = () => {
    const vision = createElement('div', 'main-menu__text main-menu__vision');
    vision.textContent =
      'Václav Buchtelík develops an expressive body of work concerned with anxiety, societal fears and apocalyptic themes.';
    return vision;
  };

  const createContactContent = () => {
    const contact = createElement('div', 'main-menu__text main-menu__contact');

    const name = createElement('div', 'main-menu__contact-name');
    name.textContent = 'Václav Buchtelík';

    const email = createElement('a', 'main-menu__contact-email');
    email.href = 'mailto:art@vaclavbuchtelik.com';
    email.textContent = 'art@vaclavbuchtelik.com';

    const phone = createElement('a', 'main-menu__contact-phone');
    phone.href = 'tel:+420737615992';
    phone.textContent = '+420 737 615 992';

    contact.append(name, email, phone);
    return contact;
  };

  /* =========================================================
     SABER
     ========================================================= */

  const createSaberSlot = () => {
    const slot = createElement('li', 'main-menu__saber-slot');
    slot.setAttribute('aria-hidden', 'true');

    saber = createElement('div', 'main-menu__saber');
    saber.id = 'mainMenuSaber';

    saberHandle = createElement('div', 'main-menu__saber-handle');
    saberHandle.id = 'mainMenuSaberHandle';

    slot.append(saber, saberHandle);
    return slot;
  };

  /* =========================================================
     MENU STRUCTURE
     ========================================================= */

  const createMenu = () => {
    const menu = createElement('nav', 'main-menu');
    const content = createElement('div', 'main-menu__content');

    menu.setAttribute('aria-label', 'Main navigation');

    menuList = createElement('ul', 'main-menu__list');
    menuList.id = 'mainMenuList';

    menuList.append(
      createSaberSlot(),
      createMenuItem('about', 'ABOUT'),
      createMenuPanel(createAboutContent()),
      createMenuItem('art', 'MY ART'),
      createMenuPanel(createArtContent()),
      createMenuItem('vision', 'VISION'),
      createMenuPanel(createVisionContent()),
      createMenuItem('contact', 'CONTACT'),
      createMenuPanel(createContactContent())
    );

    const divider = createElement('div', 'main-menu__divider');

    content.append(menuList, divider);
    menu.appendChild(content);

    return menu;
  };

  /* =========================================================
     SABER POSITION
     ========================================================= */

  const syncSaberToActive = () => {
    if (!menuList || !saber || !menuItems.length) return;

    const activeItem = menuItems[activeIndex];
    const lastItem = menuItems[menuItems.length - 1];
    if (!activeItem || !lastItem) return;

    const listRect = menuList.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const lastRect = lastItem.getBoundingClientRect();
    const saberHeight = parseFloat(getComputedStyle(saber).height);

    if (!Number.isFinite(saberHeight)) return;

    const itemCenterY =
      itemRect.top - listRect.top + itemRect.height / 2 - saberHeight / 2;

    const lastCenterY =
      lastRect.top - listRect.top + lastRect.height / 2 - saberHeight / 2;

    const y = Math.max(0, Math.min(itemCenterY, Math.max(0, lastCenterY)));
    saber.style.transform = `translate3d(0, ${y}px, 0)`;
  };

  const scheduleSaberSync = () => {
    if (saberSyncFrame !== null) cancelAnimationFrame(saberSyncFrame);

    saberSyncFrame = requestAnimationFrame(() => {
      saberSyncFrame = null;
      syncSaberToActive();
    });
  };

  const bindSaberLayoutSync = () => {
    if (!menuList) return;

    const panels = Array.from(menuList.querySelectorAll('.main-menu__panel'));

    panels.forEach(panel => {
      panel.addEventListener('transitionrun', scheduleSaberSync);
      panel.addEventListener('transitionend', scheduleSaberSync);
      panel.addEventListener('transitioncancel', scheduleSaberSync);
    });

    if (typeof ResizeObserver === 'undefined') return;

    menuResizeObserver = new ResizeObserver(scheduleSaberSync);
    menuResizeObserver.observe(menuList);

    menuItems.forEach(item => menuResizeObserver.observe(item));

    panels.forEach(panel => {
      menuResizeObserver.observe(panel);

      const inner = panel.querySelector('.main-menu__panel-inner');
      if (inner) menuResizeObserver.observe(inner);
    });
  };

  /* =========================================================
     MENU STATE
     ========================================================= */

  const setActive = index => {
    if (!menuItems.length) return;

    const next = Math.max(0, Math.min(menuItems.length - 1, index));

    menuItems.forEach((item, itemIndex) => {
      item.classList.toggle('is-active', itemIndex === next);
    });

    activeIndex = next;
    scheduleSaberSync();
  };

  const spinChevron = (item, isOpen) => {
    const chevron = item?.querySelector('.main-menu__chevron');
    if (!chevron) return;

    const nextTurns = parseInt(chevron.dataset.turns || '0', 10) + 1;
    const baseAngle = isOpen ? 180 : 0;

    chevron.dataset.turns = String(nextTurns);
    chevron.style.setProperty('--chev-spin', `${nextTurns * 360 + baseAngle}deg`);
  };

  const getPanelForItem = item => {
    const panel = item?.nextElementSibling;
    return panel?.classList.contains('main-menu__panel') ? panel : null;
  };

  const closeItem = index => {
    const item = menuItems[index];
    if (!item) return;

    item.classList.remove('is-open');
    spinChevron(item, false);

    const button = item.querySelector('.main-menu__chevron-button');
    if (button) button.setAttribute('aria-expanded', 'false');

    const panel = getPanelForItem(item);
    if (panel) panel.setAttribute('aria-hidden', 'true');

    if (openIndex === index) openIndex = -1;
    scheduleSaberSync();
  };

  const openItem = index => {
    if (index < 0 || index >= menuItems.length || openIndex === index) return;

    if (openIndex !== -1) closeItem(openIndex);

    const item = menuItems[index];
    item.classList.add('is-open');
    spinChevron(item, true);

    const button = item.querySelector('.main-menu__chevron-button');
    if (button) button.setAttribute('aria-expanded', 'true');

    const panel = getPanelForItem(item);
    if (panel) panel.setAttribute('aria-hidden', 'false');

    openIndex = index;
    scheduleSaberSync();
  };

  const toggleItem = index => {
    if (openIndex === index) closeItem(index);
    else openItem(index);
  };

  /* =========================================================
     GALLERY STATE CONTRACT
     ========================================================= */

  const restoreArtMenuAfterGallery = () => {
    if (!mainView || !menuItems.length) return;

    const artIndex = getMenuItemIndex(ART_MENU_KEY);
    if (artIndex === -1) return;

    /*
     * Restore exactly the state from which GALLERY is entered:
     * MAIN menu visible + MY ART active + MY ART panel open.
     */
    setActive(artIndex);

    if (openIndex !== artIndex) openItem(artIndex);

    openMainMenu();

    requestAnimationFrame(() => {
      requestAnimationFrame(scheduleSaberSync);
    });
  };

  const handleGalleryClosed = () => {
    restoreArtMenuAfterGallery();
  };

  /* =========================================================
     MENU EVENTS
     ========================================================= */

  const bindMenuEvents = () => {
    menuItems = Array.from(menuList.querySelectorAll('.main-menu__item'));
    if (!menuItems.length) return;

    menuItems.forEach((item, index) => {
      const label = item.querySelector('.main-menu__label');
      const button = item.querySelector('.main-menu__chevron-button');

      label?.addEventListener('click', event => {
        event.preventDefault();
        setActive(index);
      });

      button?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        setActive(index);
        toggleItem(index);
      });
    });

    setActive(0);
  };

  /* =========================================================
     SABER HIT TEST + DRAG
     ========================================================= */

  const pickIndexFromClientY = clientY => {
    let bestIndex = 0;
    let bestDistance = Infinity;

    menuItems.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  };

  const bindSaberEvents = () => {
    if (!saberHandle) return;

    saberHandle.addEventListener('touchstart', event => {
      if (!event.touches?.length) return;

      draggingSaber = true;
      setActive(pickIndexFromClientY(event.touches[0].clientY));
    }, { passive: true });

    saberHandle.addEventListener('touchmove', event => {
      if (!draggingSaber || !event.touches?.length) return;
      setActive(pickIndexFromClientY(event.touches[0].clientY));
    }, { passive: true });

    saberHandle.addEventListener('touchend', () => {
      draggingSaber = false;
      scheduleSaberSync();
    }, { passive: true });

    saberHandle.addEventListener('touchcancel', () => {
      draggingSaber = false;
      scheduleSaberSync();
    }, { passive: true });

    saberHandle.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') return;

      draggingSaber = true;
      saberHandle.setPointerCapture?.(event.pointerId);
      setActive(pickIndexFromClientY(event.clientY));
    });

    saberHandle.addEventListener('pointermove', event => {
      if (!draggingSaber || event.pointerType === 'touch') return;
      setActive(pickIndexFromClientY(event.clientY));
    });

    saberHandle.addEventListener('pointerup', event => {
      draggingSaber = false;

      if (saberHandle.hasPointerCapture?.(event.pointerId)) {
        saberHandle.releasePointerCapture(event.pointerId);
      }

      scheduleSaberSync();
    });

    saberHandle.addEventListener('pointercancel', () => {
      draggingSaber = false;
      scheduleSaberSync();
    });
  };

  /* =========================================================
     MAIN ARRIVAL
     ========================================================= */

  const startMainArrival = () => {
    if (!mainView) return;

    mainLogoTimer = window.setTimeout(() => {
      mainLogoTimer = null;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          mainView?.classList.add('is-logo-visible');
        });
      });

      mainControlsTimer = window.setTimeout(() => {
        mainControlsTimer = null;
        mainView?.classList.add('is-controls-visible');
      }, MAIN_LOGO_ANIMATION_MS);
    }, MAIN_LOGO_DELAY_MS);
  };

  /* =========================================================
     CREATE MAIN
     ========================================================= */

  const createMain = () => {
    if (mainCreated) return;
    mainCreated = true;

    mainView = createElement('section', 'main-view');
    mainView.id = 'mainView';
    mainView.setAttribute('aria-label', 'Václav Buchtelík main website');

    mainView.append(createHeader(), createLogo(), createMenu());
    document.body.appendChild(mainView);

    bindMenuEvents();
    bindSaberEvents();
    bindSaberLayoutSync();
    syncMenuIcon();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mainView) return;

        mainView.classList.add('is-visible');
        scheduleSaberSync();
      });
    });

    startMainArrival();
  };

  /* =========================================================
     GLOBAL EVENTS
     ========================================================= */

  const handleResize = () => {
    if (mainView) scheduleSaberSync();
  };

  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('orientationchange', handleResize, { passive: true });
  window.addEventListener('vb:main-enter', createMain);
  window.addEventListener('vb:gallery-closed', handleGalleryClosed);

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener('pagehide', () => {
    if (mainLogoTimer !== null) {
      clearTimeout(mainLogoTimer);
      mainLogoTimer = null;
    }

    if (mainControlsTimer !== null) {
      clearTimeout(mainControlsTimer);
      mainControlsTimer = null;
    }

    if (saberSyncFrame !== null) {
      cancelAnimationFrame(saberSyncFrame);
      saberSyncFrame = null;
    }

    menuResizeObserver?.disconnect();
    menuResizeObserver = null;

    window.removeEventListener('resize', handleResize);
    window.removeEventListener('orientationchange', handleResize);
    window.removeEventListener('vb:main-enter', createMain);
    window.removeEventListener('vb:gallery-closed', handleGalleryClosed);

    draggingSaber = false;
    menuOpen = false;
  }, { once: true });
})();
