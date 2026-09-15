'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY
   ========================================================= */

(() => {
  const gallery = document.getElementById('gallery');

  if (!gallery) {
    return;
  }

  const art = Array.isArray(window.ART)
    ? window.ART
    : [];

  if (!art.length) {
    return;
  }

  /* =========================================================
     ELEMENT HELPERS
     ========================================================= */

  const createElement = (tagName, className = '') => {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    return element;
  };

  /* =========================================================
     GALLERY HEADER
     ========================================================= */

  const createHeader = () => {
    const header = createElement(
      'header',
      'gallery__header'
    );

    const back = createElement(
      'a',
      'gallery__back'
    );

    back.href = '/';
    back.setAttribute(
      'aria-label',
      'Back to Václav Buchtelík'
    );

    back.textContent = '←';

    const title = createElement(
      'h1',
      'gallery__title'
    );

    title.textContent = 'GALLERY';

    header.appendChild(back);
    header.appendChild(title);

    return header;
  };

  /* =========================================================
     GALLERY ITEM
     ========================================================= */

  const createGalleryItem = (artwork, index) => {
    const item = createElement(
      'button',
      'gallery__item'
    );

    item.type = 'button';
    item.dataset.index = String(index);
    item.dataset.artId = String(artwork.id);

    item.setAttribute(
      'aria-label',
      artwork.title
        ? `Open ${artwork.title}`
        : `Open artwork ${artwork.id}`
    );

    const image = createElement(
      'img',
      'gallery__image'
    );

    image.src = artwork.src;
    image.alt = artwork.title || '';
    image.loading = index < 6 ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.draggable = false;

    if (index < 2) {
      image.fetchPriority = 'high';
    }

    item.appendChild(image);

    return item;
  };

  /* =========================================================
     GRID
     ========================================================= */

  const createGrid = () => {
    const grid = createElement(
      'div',
      'gallery__grid'
    );

    grid.setAttribute(
      'aria-label',
      'Artworks'
    );

    const fragment =
      document.createDocumentFragment();

    art.forEach((artwork, index) => {
      fragment.appendChild(
        createGalleryItem(
          artwork,
          index
        )
      );
    });

    grid.appendChild(fragment);

    return grid;
  };

  /* =========================================================
     ITEM INTERACTION
     ========================================================= */

  const bindGridEvents = () => {
    gallery.addEventListener(
      'click',
      (event) => {
        const item = event.target.closest(
          '.gallery__item'
        );

        if (
          !item ||
          !gallery.contains(item)
        ) {
          return;
        }

        const index = Number(
          item.dataset.index
        );

        if (
          !Number.isInteger(index) ||
          !art[index]
        ) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent(
            'vb:gallery-open',
            {
              detail: {
                index,
                artwork: art[index]
              }
            }
          )
        );
      }
    );
  };

  /* =========================================================
     BUILD
     ========================================================= */

  const buildGallery = () => {
    const fragment =
      document.createDocumentFragment();

    fragment.appendChild(
      createHeader()
    );

    fragment.appendChild(
      createGrid()
    );

    gallery.replaceChildren(fragment);

    bindGridEvents();

    gallery.classList.add(
      'is-ready'
    );
  };

  buildGallery();
})();
