'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — SWIPE ENGINE
   PREVIOUS + CURRENT + NEXT
   ========================================================= */

(function () {
  function initVBSwipe(options) {
    const { viewport, refs, state, vh, onCommit, isInteractiveTarget } = options;

    const MOVE_ACTIVATE_PX = 2;
    const MIN_COMMIT_DY = 24;
    const MIN_COMMIT_VY = 0.20;
    const COMMIT_RATIO = 0.10;
    const COMMIT_DURATION = 160;
    const SNAP_DURATION = 190;
    const MAX_MOVE_STEP_PX = 260;
    const CURVE = 'cubic-bezier(0.15,0.85,0.2,1)';

    let dragging = false;
    let animating = false;
    let startX = 0, startY = 0, startT = 0;
    let lastY = 0, dy = 0, velocityY = 0;
    let gestureHeight = 0, raf = 0, settleTimer = 0;
    let queuedDir = 0, queueStartX = 0, queueStartY = 0, queueTracking = false;
    let pointerId = null;

    const layers = () => [refs.prev, refs.current, refs.next].filter(Boolean);
    const setTr = (el, y) => { if (el) el.style.transform = `translate3d(0,${y}px,0)`; };
    const setTransitions = value => layers().forEach(el => { el.style.transition = value; });
    const setWillChange = value => layers().forEach(el => { el.style.willChange = value; });

    function resetTransforms() {
      const height = vh();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(settleTimer);
      setTransitions('none');
      setWillChange('auto');
      setTr(refs.prev, -height);
      setTr(refs.current, 0);
      setTr(refs.next, height);
    }

    function render() {
      raf = 0;
      if (!dragging || animating) return;

      const height = gestureHeight;
      setTr(refs.prev, -height + dy);
      setTr(refs.current, dy);
      setTr(refs.next, height + dy);
    }

    function recycle(dir) {
      if (dir > 0) {
        const oldPrev = refs.prev;
        refs.prev = refs.current;
        refs.current = refs.next;
        refs.next = oldPrev;
      } else {
        const oldNext = refs.next;
        refs.next = refs.current;
        refs.current = refs.prev;
        refs.prev = oldNext;
      }

      state.index = state.normalizeIndex(state.index + dir);
      onCommit(dir, state.index);
      resetTransforms();

      dragging = false;
      animating = false;
      dy = 0;
      velocityY = 0;

      const queued = queuedDir;
      queuedDir = 0;

      if (queued) requestAnimationFrame(() => commit(queued));
    }

    function commit(dir) {
      if (animating) {
        queuedDir = dir;
        return;
      }

      animating = true;
      dragging = false;

      const height = gestureHeight || vh();
      const target = dir > 0 ? -height : height;

      setWillChange('transform');
      setTransitions(`transform ${COMMIT_DURATION}ms ${CURVE}`);

      requestAnimationFrame(() => {
        setTr(refs.prev, -height + target);
        setTr(refs.current, target);
        setTr(refs.next, height + target);
      });

      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => recycle(dir), COMMIT_DURATION);
    }

    function snapBack() {
      if (animating) return;

      animating = true;
      dragging = false;

      const height = gestureHeight || vh();

      setWillChange('transform');
      setTransitions(`transform ${SNAP_DURATION}ms ${CURVE}`);

      requestAnimationFrame(() => {
        setTr(refs.prev, -height);
        setTr(refs.current, 0);
        setTr(refs.next, height);
      });

      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        animating = false;
        dy = 0;
        velocityY = 0;
        resetTransforms();
      }, SNAP_DURATION);
    }

    function begin(x, y) {
      gestureHeight = vh();

      if (animating) {
        queueTracking = true;
        queueStartX = x;
        queueStartY = y;
        return;
      }

      dragging = true;
      startX = x;
      startY = y;
      startT = performance.now();
      lastY = y;
      dy = 0;
      velocityY = 0;

      setTransitions('none');
      setWillChange('transform');
    }

    function move(x, y) {
      if (animating) {
        if (!queueTracking) {
          queueTracking = true;
          queueStartX = x;
          queueStartY = y;
          return false;
        }

        const qdy = y - queueStartY;
        const qdx = x - queueStartX;

        if (Math.abs(qdy) < MOVE_ACTIVATE_PX || Math.abs(qdx) > Math.abs(qdy) * 1.4) return false;

        queuedDir = qdy < 0 ? 1 : -1;
        return true;
      }

      if (!dragging) return false;

      const rawDy = y - startY;
      const rawDx = x - startX;

      if (Math.abs(rawDy) < MOVE_ACTIVATE_PX || Math.abs(rawDx) > Math.abs(rawDy) * 1.4) return false;

      const now = performance.now();
      const dt = Math.max(1, now - startT);
      velocityY = (y - lastY) / Math.max(1, now - (move.lastT || startT));
      move.lastT = now;
      lastY = y;

      const delta = rawDy - dy;
      dy += Math.abs(delta) > MAX_MOVE_STEP_PX ? Math.sign(delta) * MAX_MOVE_STEP_PX : delta;
      dy = Math.max(-gestureHeight, Math.min(gestureHeight, dy));

      if (!raf) raf = requestAnimationFrame(render);
      return true;
    }

    function end(cancelled = false) {
      if (animating) {
        queueTracking = false;
        return;
      }

      if (!dragging) return;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        render();
      }

      const distance = Math.abs(dy);
      const elapsed = Math.max(1, performance.now() - startT);
      const totalVelocity = dy / elapsed;
      const velocity = Math.abs(velocityY) > Math.abs(totalVelocity) ? velocityY : totalVelocity;
      const direction = dy < 0 ? 1 : -1;

      const commitByDistance = distance >= Math.max(MIN_COMMIT_DY, gestureHeight * COMMIT_RATIO);
      const commitByVelocity = distance >= MOVE_ACTIVATE_PX && Math.abs(velocity) >= MIN_COMMIT_VY;

      if (!cancelled && dy !== 0 && (commitByDistance || commitByVelocity)) commit(direction);
      else if (dy !== 0) snapBack();
      else {
        dragging = false;
        velocityY = 0;
        resetTransforms();
      }
    }

    function touchStart(e) {
      if (e.touches.length !== 1 || isInteractiveTarget?.(e.target)) return;
      const t = e.touches[0];
      begin(t.clientX, t.clientY);
    }

    function touchMove(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (move(t.clientX, t.clientY)) e.preventDefault();
    }

    function pointerDown(e) {
      if (e.pointerType === 'touch' || e.button !== 0 || isInteractiveTarget?.(e.target)) return;
      pointerId = e.pointerId;
      viewport.setPointerCapture?.(pointerId);
      begin(e.clientX, e.clientY);
      e.preventDefault();
    }

    function pointerMove(e) {
      if (e.pointerType === 'touch' || e.pointerId !== pointerId) return;
      if (move(e.clientX, e.clientY)) e.preventDefault();
    }

    function pointerEnd(e, cancelled) {
      if (e.pointerType === 'touch' || e.pointerId !== pointerId) return;
      if (viewport.hasPointerCapture?.(pointerId)) viewport.releasePointerCapture(pointerId);
      pointerId = null;
      end(cancelled);
    }

    viewport.addEventListener('touchstart', touchStart, { passive: true });
    viewport.addEventListener('touchmove', touchMove, { passive: false });
    viewport.addEventListener('touchend', () => end(false), { passive: true });
    viewport.addEventListener('touchcancel', () => end(true), { passive: true });
    viewport.addEventListener('pointerdown', pointerDown);
    viewport.addEventListener('pointermove', pointerMove);
    viewport.addEventListener('pointerup', e => pointerEnd(e, false));
    viewport.addEventListener('pointercancel', e => pointerEnd(e, true));

    resetTransforms();

    return {
      commit,
      reset: resetTransforms,
      destroy() {
        clearTimeout(settleTimer);
        if (raf) cancelAnimationFrame(raf);
        viewport.removeEventListener('touchstart', touchStart);
        viewport.removeEventListener('touchmove', touchMove);
        viewport.removeEventListener('pointerdown', pointerDown);
        viewport.removeEventListener('pointermove', pointerMove);
      }
    };
  }

  window.initVBSwipe = initVBSwipe;
})();
