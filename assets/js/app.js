'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — INTRO
   ========================================================= */

(() => {
  /* =========================================================
     VIDEO CONFIGURATION
     ========================================================= */

  const INTRO_VIDEO = {
    manifest:
      'https://customer-akbn1e8h41lg80xg.cloudflarestream.com/f1b70b472ea6761438a2bde3f6d6a643/manifest/video.m3u8',

    poster:
      '/assets/vb-web.jpg'
  };

  const HLS_SCRIPT_URL =
    'https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js';

  /* =========================================================
     TIMING
     ========================================================= */

  const INTRO_DELAY_MS = 3000;
  const LOGO_ANIMATION_MS = 2400;
  const ENTER_START_DELAY_MS = 400;
  const ENTER_ANIMATION_MS = 1600;
  const ARROW_START_DELAY_MS = 500;
  const VIDEO_REVEAL_SETTLE_MS = 220;

  /* =========================================================
     ELEMENTS
     ========================================================= */

  const intro = document.getElementById('intro');
  const logo = document.getElementById('introLogo');
  const gate = document.getElementById('introGate');
  const enter = document.getElementById('introEnter');
  const arrow = document.getElementById('introArrow');

  const soundButton =
    document.getElementById('introSound');

  const soundIcon =
    document.getElementById('introSoundIcon');

  if (
    !intro ||
    !logo ||
    !gate ||
    !enter ||
    !arrow ||
    !soundButton ||
    !soundIcon
  ) {
    return;
  }

  /* =========================================================
     DEVICE DETECTION
     ========================================================= */

  const userAgent = navigator.userAgent || '';

  const isIOS =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1
    );

  /* =========================================================
     STATE
     ========================================================= */

  let introStarted = false;
  let enterStarted = false;
  let arrowCycleStarted = false;
  let enterActivated = false;

  let introVideo = null;
  let hlsInstance = null;

  let videoReady = false;
  let videoDestroyed = false;
  let soundEnabled = false;

  let frameCallbackId = 0;
  let frameWatchCleanup = null;

  let introTimer = null;
  let logoSettledTimer = null;
  let enterStartTimer = null;
  let enterSettledTimer = null;
  let arrowStartTimer = null;
  let videoSettledTimer = null;

  /* =========================================================
     TIMER HELPERS
     ========================================================= */

  const clearTimer = (timer) => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  };

  const clearAllTimers = () => {
    clearTimer(introTimer);
    clearTimer(logoSettledTimer);
    clearTimer(enterStartTimer);
    clearTimer(enterSettledTimer);
    clearTimer(arrowStartTimer);
    clearTimer(videoSettledTimer);

    introTimer = null;
    logoSettledTimer = null;
    enterStartTimer = null;
    enterSettledTimer = null;
    arrowStartTimer = null;
    videoSettledTimer = null;
  };

  /* =========================================================
     SOUND UI
     ========================================================= */

  const syncSoundUI = () => {
    soundButton.classList.toggle(
      'is-sound-on',
      soundEnabled
    );

    soundButton.setAttribute(
      'aria-pressed',
      soundEnabled ? 'true' : 'false'
    );

    soundButton.setAttribute(
      'aria-label',
      soundEnabled
        ? 'Turn sound off'
        : 'Turn sound on'
    );

    soundButton.title = soundEnabled
      ? 'Turn sound off'
      : 'Turn sound on';
  };

  const disableSoundButton = () => {
    soundButton.disabled = true;
    soundButton.setAttribute('aria-disabled', 'true');
    soundButton.tabIndex = -1;
  };

  /* =========================================================
     VIDEO HELPERS
     ========================================================= */

  const tryPlay = (video) => {
    if (!video || videoDestroyed) {
      return Promise.resolve(false);
    }

    try {
      const playPromise = video.play();

      if (
        playPromise &&
        typeof playPromise.then === 'function'
      ) {
        return playPromise
          .then(() => true)
          .catch(() => false);
      }

      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  };

  const createIntroVideo = () => {
    const video = document.createElement('video');

    video.className = 'intro__video';
    video.id = 'introVideo';

    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';

    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('preload', 'auto');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('x-webkit-airplay', 'deny');

    video.setAttribute(
      'controlslist',
      'nodownload noplaybackrate noremoteplayback'
    );

    video.setAttribute(
      'aria-label',
      'Václav Buchtelík speaking about his artistic work'
    );

    video.poster = INTRO_VIDEO.poster;
    video.controls = false;
    video.tabIndex = -1;

    video.dataset.manifest = INTRO_VIDEO.manifest;

    intro.insertBefore(video, intro.firstChild);

    return video;
  };

  const clearFrameWatch = () => {
    if (frameWatchCleanup) {
      frameWatchCleanup();
      frameWatchCleanup = null;
    }

    if (
      frameCallbackId &&
      introVideo &&
      typeof introVideo.cancelVideoFrameCallback ===
        'function'
    ) {
      introVideo.cancelVideoFrameCallback(
        frameCallbackId
      );
    }

    frameCallbackId = 0;
  };

  const revealVideo = () => {
    if (
      videoReady ||
      videoDestroyed ||
      !introVideo
    ) {
      return;
    }

    if (introVideo.currentTime <= 0.05) {
      return;
    }

    videoReady = true;

    clearFrameWatch();

    intro.classList.add('is-video-ready');

    videoSettledTimer = window.setTimeout(() => {
      intro.classList.add('is-video-settled');
      videoSettledTimer = null;
    }, VIDEO_REVEAL_SETTLE_MS);
  };

  const watchFirstRenderedFrame = () => {
    if (!introVideo || videoDestroyed) {
      return;
    }

    clearFrameWatch();

    const handleTimeUpdate = () => {
      revealVideo();
    };

    const handleLoadedData = () => {
      if (
        !introVideo ||
        videoDestroyed ||
        typeof introVideo.requestVideoFrameCallback !==
          'function'
      ) {
        return;
      }

      frameCallbackId =
        introVideo.requestVideoFrameCallback(
          (now, metadata) => {
            const mediaTime =
              metadata?.mediaTime ??
              introVideo.currentTime;

            if (mediaTime > 0.05) {
              revealVideo();
            }
          }
        );
    };

    introVideo.addEventListener(
      'timeupdate',
      handleTimeUpdate
    );

    introVideo.addEventListener(
      'loadeddata',
      handleLoadedData
    );

    frameWatchCleanup = () => {
      if (!introVideo) {
        return;
      }

      introVideo.removeEventListener(
        'timeupdate',
        handleTimeUpdate
      );

      introVideo.removeEventListener(
        'loadeddata',
        handleLoadedData
      );
    };

    if (introVideo.currentTime > 0.05) {
      revealVideo();
    }
  };

  const destroyHls = () => {
    if (!hlsInstance) {
      return;
    }

    hlsInstance.destroy();
    hlsInstance = null;
  };

  const destroyVideo = () => {
    if (videoDestroyed) {
      return;
    }

    videoDestroyed = true;
    soundEnabled = false;

    syncSoundUI();
    disableSoundButton();

    clearFrameWatch();
    destroyHls();

    intro.classList.remove(
      'is-video-ready',
      'is-video-settled'
    );

    if (!introVideo) {
      return;
    }

    introVideo.pause();
    introVideo.muted = true;
    introVideo.defaultMuted = true;

    introVideo.removeAttribute('src');
    introVideo.removeAttribute('data-manifest');

    while (introVideo.firstChild) {
      introVideo.removeChild(
        introVideo.firstChild
      );
    }

    try {
      introVideo.load();
    } catch (error) {
      console.error(
        '[Václav Buchtelík] Video cleanup failed:',
        error
      );
    }

    introVideo.remove();
    introVideo = null;
  };

  /* =========================================================
     HLS.JS LOADER
     ========================================================= */

  const loadHlsScript = () => {
    if (window.Hls) {
      return Promise.resolve(window.Hls);
    }

    const existingScript =
      document.querySelector(
        `script[src="${HLS_SCRIPT_URL}"]`
      );

    if (existingScript) {
      return new Promise((resolve, reject) => {
        if (window.Hls) {
          resolve(window.Hls);
          return;
        }

        existingScript.addEventListener(
          'load',
          () => resolve(window.Hls),
          { once: true }
        );

        existingScript.addEventListener(
          'error',
          reject,
          { once: true }
        );
      });
    }

    return new Promise((resolve, reject) => {
      const script =
        document.createElement('script');

      script.src = HLS_SCRIPT_URL;
      script.async = true;

      script.addEventListener(
        'load',
        () => resolve(window.Hls),
        { once: true }
      );

      script.addEventListener(
        'error',
        reject,
        { once: true }
      );

      document.head.appendChild(script);
    });
  };

  /* =========================================================
     VIDEO ENGINE
     ========================================================= */

  const attachNativeHls = () => {
    if (!introVideo || videoDestroyed) {
      return;
    }

    introVideo.src = INTRO_VIDEO.manifest;
    introVideo.load();

    watchFirstRenderedFrame();
    tryPlay(introVideo);
  };

  const attachHlsJs = async () => {
    if (!introVideo || videoDestroyed) {
      return;
    }

    try {
      const Hls = await loadHlsScript();

      if (
        !Hls ||
        !Hls.isSupported() ||
        !introVideo ||
        videoDestroyed
      ) {
        return;
      }

      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        startLevel: -1,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        backBufferLength: 0
      });

      hlsInstance.on(
        Hls.Events.MEDIA_ATTACHED,
        () => {
          if (
            !hlsInstance ||
            !introVideo ||
            videoDestroyed
          ) {
            return;
          }

          hlsInstance.loadSource(
            INTRO_VIDEO.manifest
          );
        }
      );

      hlsInstance.on(
        Hls.Events.MANIFEST_PARSED,
        () => {
          if (!introVideo || videoDestroyed) {
            return;
          }

          watchFirstRenderedFrame();
          tryPlay(introVideo);
        }
      );

      hlsInstance.on(
        Hls.Events.ERROR,
        (event, data) => {
          if (
            !data?.fatal ||
            !hlsInstance ||
            videoDestroyed
          ) {
            return;
          }

          if (
            data.type ===
            Hls.ErrorTypes.NETWORK_ERROR
          ) {
            hlsInstance.startLoad();
            return;
          }

          if (
            data.type ===
            Hls.ErrorTypes.MEDIA_ERROR
          ) {
            hlsInstance.recoverMediaError();
            return;
          }

          destroyHls();
        }
      );

      hlsInstance.attachMedia(introVideo);
    } catch (error) {
      if (
        introVideo &&
        !videoDestroyed &&
        introVideo.canPlayType(
          'application/vnd.apple.mpegurl'
        )
      ) {
        attachNativeHls();
      }
    }
  };

  const initializeVideo = () => {
    introVideo = createIntroVideo();

    introVideo.muted = true;
    introVideo.defaultMuted = true;

    soundEnabled = false;
    syncSoundUI();

    const supportsNativeHls =
      introVideo.canPlayType(
        'application/vnd.apple.mpegurl'
      );

    if (isIOS && supportsNativeHls) {
      attachNativeHls();
      return;
    }

    if (
      supportsNativeHls &&
      !window.MediaSource
    ) {
      attachNativeHls();
      return;
    }

    attachHlsJs();
  };

  /* =========================================================
     VIDEO SOUND CONTROL
     ========================================================= */

  const enableVideoSound = async () => {
    if (
      !introVideo ||
      videoDestroyed ||
      enterActivated
    ) {
      return;
    }

    introVideo.muted = false;
    introVideo.defaultMuted = false;

    const didPlay = await tryPlay(introVideo);

    if (!didPlay) {
      introVideo.muted = true;
      introVideo.defaultMuted = true;

      soundEnabled = false;
      syncSoundUI();

      return;
    }

    soundEnabled = true;
    syncSoundUI();
  };

  const disableVideoSound = () => {
    if (
      !introVideo ||
      videoDestroyed ||
      enterActivated
    ) {
      return;
    }

    soundEnabled = false;

    introVideo.muted = true;
    introVideo.defaultMuted = true;

    syncSoundUI();
  };

  const toggleVideoSound = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      !introVideo ||
      videoDestroyed ||
      enterActivated
    ) {
      return;
    }

    if (soundEnabled) {
      disableVideoSound();
      return;
    }

    await enableVideoSound();
  };

  soundButton.addEventListener(
    'click',
    toggleVideoSound
  );

  /* =========================================================
     ARROW CYCLE
     ========================================================= */

  const startArrowCycle = () => {
    if (
      arrowCycleStarted ||
      enterActivated
    ) {
      return;
    }

    arrowCycleStarted = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        intro.classList.add(
          'is-arrow-cycling'
        );
      });
    });
  };

  const scheduleArrowCycle = () => {
    arrowStartTimer = window.setTimeout(
      startArrowCycle,
      ARROW_START_DELAY_MS
    );
  };

  /* =========================================================
     ENTER
     ========================================================= */

  const settleEnter = () => {
    intro.classList.add('is-enter-settled');
    scheduleArrowCycle();
  };

  const showEnter = () => {
    if (
      enterStarted ||
      enterActivated
    ) {
      return;
    }

    enterStarted = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        intro.classList.add(
          'is-enter-visible'
        );

        enterSettledTimer =
          window.setTimeout(
            settleEnter,
            ENTER_ANIMATION_MS
          );
      });
    });
  };

  const scheduleEnter = () => {
    enterStartTimer = window.setTimeout(
      showEnter,
      ENTER_START_DELAY_MS
    );
  };

  /* =========================================================
     LOGO
     ========================================================= */

  const settleLogo = () => {
    intro.classList.add('is-logo-settled');
    scheduleEnter();
  };

  const startIntro = () => {
    if (
      introStarted ||
      enterActivated
    ) {
      return;
    }

    introStarted = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        intro.classList.add(
          'is-logo-visible'
        );

        logoSettledTimer =
          window.setTimeout(
            settleLogo,
            LOGO_ANIMATION_MS
          );
      });
    });
  };

  const scheduleIntro = () => {
    introTimer = window.setTimeout(
      startIntro,
      INTRO_DELAY_MS
    );
  };

  /* =========================================================
     ENTER ACTIVATION
     ========================================================= */

  const activateEnter = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (enterActivated) {
      return;
    }

    enterActivated = true;

    clearAllTimers();

    intro.classList.remove(
      'is-arrow-cycling'
    );

    intro.classList.add(
      'is-enter-activated'
    );

    destroyVideo();
 
    window.dispatchEvent(
    new CustomEvent('vb:main-enter')
    );    

  /* =========================================================
     ASSET ERROR HANDLING
     ========================================================= */

  const handleLogoError = () => {
    clearTimer(introTimer);
    clearTimer(logoSettledTimer);

    introStarted = true;

    intro.classList.add(
      'is-logo-visible',
      'is-logo-settled'
    );

    scheduleEnter();
  };

  logo.addEventListener(
    'error',
    handleLogoError,
    { once: true }
  );

  /* =========================================================
     START
     ========================================================= */

  syncSoundUI();
  initializeVideo();
  scheduleIntro();

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener(
    'pagehide',
    () => {
      clearAllTimers();
      destroyVideo();
    },
    { once: true }
  );
})();
