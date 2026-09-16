'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY SWIPE HAND INTRO
   ========================================================= */

(() => {
  const START_DELAY_MS = 3000;
  const OVERLAY_FADE_MS = 420;

  const HAND_ENTER_MS = 1900;
  const HAND_SETTLE_MS = 650;
  const HAND_SWIPE_MS = 3000;
  const BETWEEN_SWIPES_MS = 720;
  const AFTER_SWIPES_HOLD_MS = 520;
  const HAND_EXIT_MS = 1500;

  const HAND_SRC = '/assets/swipe-ui.png';
  const HAND_ROTATION = -30;
  const HAND_ORIGIN = '70% 90%';

  let overlay = null;
  let hand = null;
  let active = false;
  let runId = 0;

  const timers = new Set();
  const animations = new Set();

  /* =========================================================
     HELPERS
     ========================================================= */

  const isCurrent = id => active && id === runId;

  const wait = (ms, id) => new Promise(resolve => {
    if (!isCurrent(id)) return resolve();

    const timer = setTimeout(() => {
      timers.delete(timer);
      resolve();
    }, ms);

    timers.add(timer);
  });

  const nextFrame = () =>
    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const clearAll = () => {
    timers.forEach(clearTimeout);
    timers.clear();

    animations.forEach(animation => {
      try { animation.cancel(); } catch {}
    });

    animations.clear();
  };

  const animate = (keyframes, options, id) => new Promise(resolve => {
    if (!hand || !isCurrent(id)) return resolve();

    const animation = hand.animate(keyframes, options);
    animations.add(animation);

    const done = () => {
      animations.delete(animation);
      resolve();
    };

    animation.addEventListener('finish', done, { once: true });
    animation.addEventListener('cancel', done, { once: true });
  });

  /* =========================================================
     DOM
     ========================================================= */

  const createOverlay = () => {
    const gallery = document.getElementById('galleryViewer');
    if (!gallery) return false;

    if (overlay) {
      if (overlay.parentElement !== gallery) gallery.appendChild(overlay);
      return true;
    }

    overlay = document.createElement('div');
    overlay.className = 'gallery-hand';
    overlay.setAttribute('aria-hidden', 'true');

    const stage = document.createElement('div');
    stage.className = 'gallery-hand__stage';

    hand = document.createElement('img');
    hand.className = 'gallery-hand__hand';
    hand.src = HAND_SRC;
    hand.alt = '';
    hand.decoding = 'async';
    hand.draggable = false;
    hand.setAttribute('aria-hidden', 'true');
    hand.style.transformOrigin = HAND_ORIGIN;

    stage.appendChild(hand);
    overlay.appendChild(stage);
    gallery.appendChild(overlay);

    return true;
  };

  /* =========================================================
     POSITIONS
     ========================================================= */

  const REST = `translate3d(-50%, -50%, 0) rotate(${HAND_ROTATION}deg)`;
  const OUTSIDE = `translate3d(calc(50vw + 180px), -50%, 0) rotate(${HAND_ROTATION}deg)`;

  const settle = () => {
    if (!hand) return;

    hand.style.opacity = '1';
    hand.style.transform = REST;
    hand.style.transformOrigin = HAND_ORIGIN;
  };

  const reset = () => {
    if (!overlay || !hand) return;

    overlay.classList.remove('is-open', 'is-exiting');
    overlay.setAttribute('aria-hidden', 'true');

    hand.style.opacity = '0';
    hand.style.transform = OUTSIDE;
    hand.style.transformOrigin = HAND_ORIGIN;
  };

  /* =========================================================
     ENTER
     RIGHT -> CENTER
     ========================================================= */

  const enter = async id => {
    hand.style.opacity = '0';
    hand.style.transform = OUTSIDE;

    await nextFrame();
    if (!isCurrent(id)) return;

    await animate(
      [
        { opacity: 0, transform: OUTSIDE },
        { opacity: 1, transform: `translate3d(calc(-50% + 55px), -50%, 0) rotate(${HAND_ROTATION}deg)` },
        { opacity: 1, transform: REST }
      ],
      {
        duration: HAND_ENTER_MS,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'forwards'
      },
      id
    );

    if (isCurrent(id)) settle();
  };

  /* =========================================================
     SWIPE
     REST -> JEMNĚ NAHORU -> ŠVIH DOPRAVA OBLOUKEM
     -> PLYNULÝ NÁVRAT STEJNOU TRAJEKTORIÍ
     ========================================================= */

  const swipe = async id => {
    settle();

    await nextFrame();
    if (!isCurrent(id)) return;

    await animate(
      [
        {
          transform: REST,
          offset: 0
        },
        {
          transform: `translate3d(-50%, calc(-50% - 28px), 0) rotate(${HAND_ROTATION - 2}deg)`,
          offset: 0.20
        },
        {
          transform: `translate3d(calc(-50% + 135px), calc(-50% - 65px), 0) rotate(${HAND_ROTATION + 13}deg)`,
          offset: 0.55
        },
        {
          transform: `translate3d(-50%, calc(-50% - 28px), 0) rotate(${HAND_ROTATION - 2}deg)`,
          offset: 0.80
        },
        {
          transform: REST,
          offset: 1
        }
      ],
      {
        duration: HAND_SWIPE_MS,
        easing: 'cubic-bezier(.45,0,.2,1)',
        fill: 'forwards'
      },
      id
    );

    if (isCurrent(id)) settle();
  };

  /* =========================================================
     EXIT
     CENTER -> RIGHT
     ========================================================= */

  const exit = async id => {
    settle();

    await nextFrame();
    if (!isCurrent(id)) return;

    await animate(
      [
        { opacity: 1, transform: REST },
        { opacity: 1, transform: `translate3d(calc(-50% + 50px), -50%, 0) rotate(${HAND_ROTATION}deg)` },
        { opacity: 0, transform: OUTSIDE }
      ],
      {
        duration: HAND_EXIT_MS,
        easing: 'cubic-bezier(.55,0,1,.45)',
        fill: 'forwards'
      },
      id
    );
  };

  /* =========================================================
     SEQUENCE
     ========================================================= */

  const run = async id => {
    await wait(START_DELAY_MS, id);
    if (!isCurrent(id)) return;

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    await wait(OVERLAY_FADE_MS, id);
    if (!isCurrent(id)) return;

    await enter(id);
    await wait(HAND_SETTLE_MS, id);

    await swipe(id);
    await wait(BETWEEN_SWIPES_MS, id);

    await swipe(id);
    await wait(AFTER_SWIPES_HOLD_MS, id);

    await exit(id);
    if (!isCurrent(id)) return;

    overlay.classList.add('is-exiting');

    await wait(OVERLAY_FADE_MS, id);
    if (!isCurrent(id)) return;

    active = false;

    overlay.classList.remove('is-open', 'is-exiting');
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.pointerEvents = '';

    hand.style.opacity = '0';
    hand.style.transform = OUTSIDE;

    window.dispatchEvent(new CustomEvent('vb:gallery-hand-finished'));
  };

  /* =========================================================
     OPEN / CLOSE
     ========================================================= */

  const open = () => {
    if (active || !createOverlay()) return;

    active = true;
    const id = ++runId;

    clearAll();
    reset();

    overlay.classList.remove('is-hidden');
    overlay.style.pointerEvents = 'auto';

    run(id);
  };

  const close = () => {
    active = false;
    runId++;

    clearAll();

    if (!overlay) return;

    overlay.classList.remove('is-open', 'is-exiting');
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.pointerEvents = '';

    if (hand) {
      hand.style.opacity = '0';
      hand.style.transform = OUTSIDE;
    }
  };

  /* =========================================================
     EVENTS / API / CLEANUP
     ========================================================= */

  window.addEventListener('vb:gallery-opened', open);
  window.addEventListener('vb:gallery-closed', close);

  window.VBGalleryHand = Object.freeze({
    open,
    close,
    isActive: () => active
  });

  window.addEventListener('pagehide', () => {
    active = false;
    runId++;

    clearAll();
    overlay?.remove();

    overlay = null;
    hand = null;
  }, { once: true });
})();
