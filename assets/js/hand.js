'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY SWIPE HAND INTRO
   LOGIC / TIMING ONLY — ALL MOTION LIVES IN hand.css
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

  let overlay = null;
  let hand = null;
  let active = false;
  let runId = 0;

  const timers = new Set();

  /* =========================================================
     HELPERS
     ========================================================= */

  const isCurrent = id => active && id === runId;

  const wait = (ms, id) => new Promise(resolve => {
    if (!isCurrent(id)) return resolve();

    const timer = window.setTimeout(() => {
      timers.delete(timer);
      resolve();
    }, ms);

    timers.add(timer);
  });

  const nextFrame = () =>
    new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

  const clearTimers = () => {
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
  };

  const restartClass = async className => {
    if (!hand) return;

    hand.classList.remove(className);
    void hand.offsetWidth;

    await nextFrame();

    hand.classList.add(className);
  };

  /* =========================================================
     DOM
     ========================================================= */

  const createOverlay = () => {
    const gallery = document.getElementById('galleryViewer');
    if (!gallery) return false;

    if (overlay) {
      if (overlay.parentElement !== gallery) {
        gallery.appendChild(overlay);
      }

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

    stage.appendChild(hand);
    overlay.appendChild(stage);
    gallery.appendChild(overlay);

    return true;
  };

  /* =========================================================
     RESET
     ========================================================= */

  const resetHand = () => {
    if (!hand) return;

    hand.classList.remove(
      'is-entering',
      'is-settled',
      'is-swiping',
      'is-exiting'
    );
  };

  const resetOverlay = () => {
    if (!overlay) return;

    overlay.classList.remove(
      'is-open',
      'is-exiting'
    );

    overlay.setAttribute('aria-hidden', 'true');

    resetHand();
  };

  /* =========================================================
     ENTER
     CSS: .gallery-hand__hand.is-entering
     ========================================================= */

  const enter = async id => {
    if (!hand || !isCurrent(id)) return;

    resetHand();

    await nextFrame();
    if (!isCurrent(id)) return;

    hand.classList.add('is-entering');

    await wait(HAND_ENTER_MS, id);
    if (!isCurrent(id)) return;

    hand.classList.remove('is-entering');
    hand.classList.add('is-settled');
  };

  /* =========================================================
     SWIPE
     CSS: .gallery-hand__hand.is-swiping
     @keyframes humanSwipeArc
     ========================================================= */

  const swipe = async id => {
    if (!hand || !isCurrent(id)) return;

    hand.classList.remove('is-entering', 'is-exiting');
    hand.classList.add('is-settled');

    await restartClass('is-swiping');
    if (!isCurrent(id)) return;

    await wait(HAND_SWIPE_MS, id);
    if (!isCurrent(id)) return;

    hand.classList.remove('is-swiping');
    hand.classList.add('is-settled');
  };

  /* =========================================================
     EXIT
     CSS: .gallery-hand__hand.is-exiting
     ========================================================= */

  const exit = async id => {
    if (!hand || !isCurrent(id)) return;

    hand.classList.remove(
      'is-entering',
      'is-swiping'
    );

    hand.classList.add('is-settled');

    await nextFrame();
    if (!isCurrent(id)) return;

    hand.classList.remove('is-settled');
    hand.classList.add('is-exiting');

    await wait(HAND_EXIT_MS, id);
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
    if (!isCurrent(id)) return;

    await wait(HAND_SETTLE_MS, id);
    if (!isCurrent(id)) return;

    await swipe(id);
    if (!isCurrent(id)) return;

    await wait(BETWEEN_SWIPES_MS, id);
    if (!isCurrent(id)) return;

    await swipe(id);
    if (!isCurrent(id)) return;

    await wait(AFTER_SWIPES_HOLD_MS, id);
    if (!isCurrent(id)) return;

    await exit(id);
    if (!isCurrent(id)) return;

    overlay.classList.add('is-exiting');

    await wait(OVERLAY_FADE_MS, id);
    if (!isCurrent(id)) return;

    active = false;

    overlay.classList.remove(
      'is-open',
      'is-exiting'
    );

    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.pointerEvents = '';

    resetHand();

    window.dispatchEvent(
      new CustomEvent('vb:gallery-hand-finished')
    );
  };

  /* =========================================================
     OPEN
     ========================================================= */

  const open = () => {
    if (active || !createOverlay()) return;

    active = true;
    const id = ++runId;

    clearTimers();
    resetOverlay();

    overlay.classList.remove('is-hidden');
    overlay.style.pointerEvents = 'auto';

    run(id);
  };

  /* =========================================================
     CLOSE
     ========================================================= */

  const close = () => {
    active = false;
    runId++;

    clearTimers();

    if (!overlay) return;

    resetOverlay();

    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.pointerEvents = '';
  };

  /* =========================================================
     EVENTS / API
     ========================================================= */

  window.addEventListener('vb:gallery-opened', open);
  window.addEventListener('vb:gallery-closed', close);

  window.VBGalleryHand = Object.freeze({
    open,
    close,
    isActive: () => active
  });

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener('pagehide', () => {
    active = false;
    runId++;

    clearTimers();

    overlay?.remove();

    overlay = null;
    hand = null;
  }, { once: true });
})();
