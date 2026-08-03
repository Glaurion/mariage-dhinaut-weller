if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

function scrollToPageTop() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

function lockPageToTopDuringLoad() {
  [0, 50, 150, 300, 600].forEach((delay) => {
    window.setTimeout(scrollToPageTop, delay);
  });
}

lockPageToTopDuringLoad();

const introScreen = document.querySelector('#intro-screen');
const openKingdomButton = document.querySelector('#open-kingdom');
const skipIntroButton = document.querySelector('#intro-skip');
const cinematicCaption = document.querySelector('#cinematic-caption');
const introCinematicStage = document.querySelector('#intro-cinematic-stage');
const introCinematicVideo = document.querySelector('#intro-cinematic-video');
const introCinematicBackdrop = document.querySelector('#intro-cinematic-backdrop');
const soundToggle = document.querySelector('#sound-toggle');
const soundToggleLabel = soundToggle?.querySelector('.sound-toggle-label');
const realmIndex = document.querySelector('.realm-index');
const realmIndexLinks = [...document.querySelectorAll('.realm-index-links a[href^="#"]')];
const chapterCovers = [...document.querySelectorAll('.chapter-cover')];
const revealElements = document.querySelectorAll('.reveal');
const companionsGrid = document.querySelector('.companions-grid');
const yumeCard = document.querySelector('.companion-card-flame');
const invitationTrigger = document.querySelector('#invitation');
const beginVaultJourneyButton = document.querySelector('#begin-vault-journey');
const vaultCinematicStage = document.querySelector('#vault-cinematic-stage');
const vaultCinematicVideo = document.querySelector('#vault-cinematic-video');
const vaultCinematicBackdrop = document.querySelector('#vault-cinematic-backdrop');
const invitationPopup = document.querySelector('#invitation-popup');
const treasureStage = document.querySelector('#treasure-stage');
const unlockCinematicStage = document.querySelector('#unlock-cinematic-stage');
const unlockCinematicVideo = document.querySelector('#unlock-cinematic-video');
const unlockCinematicBackdrop = document.querySelector('#unlock-cinematic-backdrop');
const cinematicMainVideos = document.querySelectorAll('.cinematic-video-main');
const cinematicSkipButtons = document.querySelectorAll('[data-cinematic-skip]');
const openInvitationButton = document.querySelector('#open-invitation');
const closeInvitationButton = document.querySelector('.invitation-popup-close');
const invitationCodeForm = document.querySelector('#invitation-code-form');
const invitationCodeInput = document.querySelector('#invitation-code');
const invitationCodeError = document.querySelector('#invitation-code-error');
const dragonWarning = document.querySelector('#dragon-warning');
const dragonWarningText = dragonWarning?.querySelector('p');
const validatedHousehold = document.querySelector('#validated-household');
const envelopeStatus = document.querySelector('#envelope-status');

if (companionsGrid && yumeCard) {
  companionsGrid.prepend(yumeCard);
  const yumeImage = yumeCard.querySelector('img');
  if (yumeImage) yumeImage.alt = 'Yume, la chatte d’Annaël, assise au soleil';
}
const forceFullMotion = new URLSearchParams(window.location.search).get('motion') === 'full';
const reducedMotion = !forceFullMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobileChapterIndex = window.matchMedia('(max-width: 680px)');
const connection = navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;
const performanceLite = Boolean(
  connection?.saveData
  || ['slow-2g', '2g'].includes(connection?.effectiveType)
  || (navigator.deviceMemory && navigator.deviceMemory <= 4)
  || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
);

document.body.classList.toggle('performance-lite', performanceLite);
document.body.classList.toggle('force-full-motion', forceFullMotion);

let chapterIndexFrame = 0;

function setActiveChapter(chapterId) {
  realmIndexLinks.forEach((link) => {
    const isActive = link.hash === `#${chapterId}`;
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function revealChapterIndex(chapterId) {
  if (!realmIndex || !chapterId) return;
  setActiveChapter(chapterId);
  if (!mobileChapterIndex.matches) return;
  realmIndex.classList.add('is-chapter-visible');
}

function hideChapterIndex() {
  if (!realmIndex || !mobileChapterIndex.matches) return;
  realmIndex.classList.remove('is-chapter-visible');
}

function getVisibleChapterCover() {
  const visibilityTop = Math.max(72, window.innerHeight * .08);
  const visibilityBottom = window.innerHeight * .72;

  return chapterCovers.find((cover) => {
    const bounds = cover.getBoundingClientRect();
    return bounds.bottom > visibilityTop && bounds.top < visibilityBottom;
  });
}

function syncChapterIndex() {
  chapterIndexFrame = 0;
  if (!mobileChapterIndex.matches || !document.body.classList.contains('intro-complete')) return;

  const visibleCover = getVisibleChapterCover();
  const visibleChapterId = visibleCover?.closest('[id]')?.id;

  if (visibleChapterId) {
    revealChapterIndex(visibleChapterId);
  } else {
    hideChapterIndex();
  }
}

function queueChapterIndexSync() {
  if (chapterIndexFrame) return;
  chapterIndexFrame = window.requestAnimationFrame(syncChapterIndex);
}

function handleChapterIndexViewportChange() {
  if (!realmIndex) return;
  realmIndex.classList.remove('is-chapter-visible');
  if (mobileChapterIndex.matches && document.body.classList.contains('intro-complete')) {
    queueChapterIndexSync();
  }
}

realmIndexLinks.forEach((link) => {
  link.addEventListener('click', () => revealChapterIndex(link.hash.slice(1)));
});

window.addEventListener('scroll', queueChapterIndexSync, { passive: true });
window.addEventListener('resize', queueChapterIndexSync, { passive: true });
window.addEventListener('pageshow', () => {
  if (document.body.classList.contains('intro-complete')) {
    queueChapterIndexSync();
  }
});

if (typeof mobileChapterIndex.addEventListener === 'function') {
  mobileChapterIndex.addEventListener('change', handleChapterIndexViewportChange);
} else {
  mobileChapterIndex.addListener(handleChapterIndexViewportChange);
}

const soundPreferenceKey = 'dhinaut-weller-sound';
const musicTimeKey = 'dhinaut-weller-music-time';
const musicHandoffKey = 'dhinaut-weller-music-handoff';
const realmTheme = new Audio('assets/realm-theme.mp3');
const castleDoorSound = new Audio('assets/castle-door-opening.mp3');
realmTheme.preload = 'metadata';
realmTheme.loop = true;
realmTheme.volume = 0;
castleDoorSound.preload = 'auto';
castleDoorSound.volume = 0.24;

try {
  sessionStorage.removeItem(musicTimeKey);
  sessionStorage.removeItem(musicHandoffKey);
} catch {}

window.addEventListener('pagehide', () => {
  if (Number.isFinite(realmTheme.currentTime)) {
    sessionStorage.setItem(musicTimeKey, String(realmTheme.currentTime));
  }
});

let soundEnabled = true;
let themeFadeFrame = 0;
let themeFadeGeneration = 0;
let castleDoorSoundTimer = null;
let audioContext = null;
let pageAudioActive = document.visibilityState !== 'hidden';
let realmThemePausedByInactivity = false;
let realmThemeVolumeBeforeInactivity = 0.11;
let introRunning = false;
let introFinished = false;
let introTimers = [];
let activeCinematic = null;
let vaultJourneyRunning = false;
let unlockCinematicRunning = false;
let invitationWasShown = false;
let supabaseClient = null;
let validatedInvitationCode = '';
let validatedInvitationRoute = '';
let wrongCodeAttempts = 0;
let nextCodeAttemptAt = 0;
let warningTimer = null;
let invitationAnimationTimers = [];

try {
  soundEnabled = localStorage.getItem(soundPreferenceKey) !== 'off';
} catch {
  soundEnabled = true;
}

function updateSoundToggle() {
  soundToggle?.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle?.setAttribute('aria-label', soundEnabled ? 'Couper la musique' : 'Activer la musique');
  if (soundToggleLabel) {
    soundToggleLabel.textContent = soundEnabled ? 'Son activé' : 'Son coupé';
  }
}

function syncCinematicSound() {
  cinematicMainVideos.forEach((video) => {
    video.muted = !soundEnabled || !pageAudioActive;
  });
}

updateSoundToggle();
syncCinematicSound();
document.body.classList.add('sound-ready');

function setCinematicCaption(message = '') {
  if (cinematicCaption) cinematicCaption.textContent = message;
}

function queueIntro(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  introTimers.push(timer);
  return timer;
}

function clearIntroTimers() {
  introTimers.forEach((timer) => window.clearTimeout(timer));
  introTimers = [];
}

function fadeThemeTo(targetVolume, duration = 900, pauseAfter = false) {
  window.cancelAnimationFrame(themeFadeFrame);
  themeFadeGeneration += 1;
  const generation = themeFadeGeneration;
  const initialVolume = realmTheme.volume;
  const startedAt = performance.now();

  function step(now) {
    if (generation !== themeFadeGeneration) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const nextVolume = initialVolume + ((targetVolume - initialVolume) * eased);
    realmTheme.volume = Math.min(1, Math.max(0, nextVolume));

    if (progress < 1) {
      themeFadeFrame = window.requestAnimationFrame(step);
      return;
    }

    realmTheme.volume = targetVolume;
    if (pauseAfter && targetVolume === 0) realmTheme.pause();
  }

  themeFadeFrame = window.requestAnimationFrame(step);
}

async function startRealmTheme() {
  if (!soundEnabled) return;
  if (!pageAudioActive) {
    realmThemePausedByInactivity = true;
    return;
  }

  try {
    if (realmTheme.paused) {
      realmTheme.volume = 0;
      await realmTheme.play();
    }
    fadeThemeTo(0.11, 2800);
  } catch {
    soundEnabled = false;
    updateSoundToggle();
  }
}

function setPageAudioActive(isActive) {
  const nextState = Boolean(isActive && !document.hidden);
  if (nextState === pageAudioActive) return;
  pageAudioActive = nextState;
  syncCinematicSound();

  if (!pageAudioActive) {
    realmThemePausedByInactivity = !realmTheme.paused;
    realmThemeVolumeBeforeInactivity = realmTheme.volume || 0.11;
    window.cancelAnimationFrame(themeFadeFrame);
    themeFadeGeneration += 1;
    realmTheme.pause();
    castleDoorSound.pause();
    window.clearTimeout(castleDoorSoundTimer);
    castleDoorSoundTimer = null;

    if (audioContext && audioContext.state !== 'closed') {
      const contextToClose = audioContext;
      audioContext = null;
      contextToClose.close().catch(() => {});
    }
    return;
  }

  if (soundEnabled && realmThemePausedByInactivity) {
    realmTheme.volume = 0;
    realmTheme.play()
      .then(() => fadeThemeTo(realmThemeVolumeBeforeInactivity, 500))
      .catch(() => {});
  }
  realmThemePausedByInactivity = false;
}

document.addEventListener('visibilitychange', () => {
  setPageAudioActive(!document.hidden && document.hasFocus());
});
window.addEventListener('blur', () => setPageAudioActive(false));
window.addEventListener('focus', () => setPageAudioActive(!document.hidden));

function toggleSound() {
  soundEnabled = !soundEnabled;

  try {
    localStorage.setItem(soundPreferenceKey, soundEnabled ? 'on' : 'off');
  } catch {
    // The preference remains active for the current page when storage is unavailable.
  }

  updateSoundToggle();
  syncCinematicSound();

  if (soundEnabled) {
    startRealmTheme();
  } else {
    fadeThemeTo(0, 500, true);
    castleDoorSound.pause();
  }
}

function ensureAudioContext() {
  if (!soundEnabled || !pageAudioActive) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function createNoiseBuffer(context, duration) {
  const frameCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - (index / frameCount) * 0.2);
  }

  return buffer;
}

function playDragonRoar() {
  const context = ensureAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  const oscillator = context.createOscillator();
  const subOscillator = context.createOscillator();
  const noise = context.createBufferSource();
  const noiseGain = context.createGain();

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.045, now + 0.12);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(320, now);
  filter.frequency.exponentialRampToValueAtTime(115, now + 1.2);

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(82, now);
  oscillator.frequency.exponentialRampToValueAtTime(38, now + 1.25);
  subOscillator.type = 'triangle';
  subOscillator.frequency.setValueAtTime(46, now);
  subOscillator.frequency.exponentialRampToValueAtTime(25, now + 1.25);

  noise.buffer = createNoiseBuffer(context, 1.35);
  noiseGain.gain.setValueAtTime(0.018, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

  oscillator.connect(filter);
  subOscillator.connect(filter);
  noise.connect(noiseGain).connect(filter);
  filter.connect(master).connect(context.destination);
  oscillator.start(now);
  subOscillator.start(now);
  noise.start(now);
  oscillator.stop(now + 1.4);
  subOscillator.stop(now + 1.4);
  noise.stop(now + 1.4);
}

function playFireWhoosh() {
  const context = ensureAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  noise.buffer = createNoiseBuffer(context, 1.45);
  filter.type = 'bandpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(260, now);
  filter.frequency.exponentialRampToValueAtTime(1700, now + 0.38);
  filter.frequency.exponentialRampToValueAtTime(420, now + 1.35);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.065, now + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

  noise.connect(filter).connect(gain).connect(context.destination);
  noise.start(now);
  noise.stop(now + 1.45);
}

function playCastleDoorSound() {
  if (!soundEnabled || !pageAudioActive) return;
  window.clearTimeout(castleDoorSoundTimer);
  castleDoorSound.pause();
  castleDoorSound.currentTime = 0.35;
  castleDoorSound.play().catch(() => {});
  castleDoorSoundTimer = window.setTimeout(() => castleDoorSound.pause(), 4300);
}

function playWaxSealBreak() {
  const context = ensureAudioContext();
  if (!context) return;

  const startedAt = context.currentTime;
  [0, .13, .29].forEach((offset, index) => {
    const crack = context.createBufferSource();
    const crackFilter = context.createBiquadFilter();
    const crackGain = context.createGain();
    const impact = context.createOscillator();
    const impactGain = context.createGain();
    const start = startedAt + offset;
    const duration = .075 + (index * .018);

    crack.buffer = createNoiseBuffer(context, duration);
    crackFilter.type = 'highpass';
    crackFilter.frequency.setValueAtTime(780 + (index * 260), start);
    crackGain.gain.setValueAtTime(.0001, start);
    crackGain.gain.exponentialRampToValueAtTime(.028 - (index * .004), start + .008);
    crackGain.gain.exponentialRampToValueAtTime(.0001, start + duration);

    impact.type = index === 0 ? 'triangle' : 'sine';
    impact.frequency.setValueAtTime(210 - (index * 38), start);
    impact.frequency.exponentialRampToValueAtTime(92, start + .13);
    impactGain.gain.setValueAtTime(.0001, start);
    impactGain.gain.exponentialRampToValueAtTime(.018 - (index * .003), start + .012);
    impactGain.gain.exponentialRampToValueAtTime(.0001, start + .14);

    crack.connect(crackFilter).connect(crackGain).connect(context.destination);
    impact.connect(impactGain).connect(context.destination);
    crack.start(start);
    crack.stop(start + duration);
    impact.start(start);
    impact.stop(start + .15);
  });
}

function playPaperUnfold() {
  const context = ensureAudioContext();
  if (!context) return;

  const startedAt = context.currentTime;
  [0, .46, .94].forEach((offset, index) => {
    const paper = context.createBufferSource();
    const paperFilter = context.createBiquadFilter();
    const paperGain = context.createGain();
    const start = startedAt + offset;
    const duration = .62;

    paper.buffer = createNoiseBuffer(context, duration);
    paperFilter.type = 'bandpass';
    paperFilter.Q.value = .75;
    paperFilter.frequency.setValueAtTime(560 + (index * 120), start);
    paperFilter.frequency.exponentialRampToValueAtTime(1700 - (index * 120), start + .32);
    paperFilter.frequency.exponentialRampToValueAtTime(760, start + duration);
    paperGain.gain.setValueAtTime(.0001, start);
    paperGain.gain.exponentialRampToValueAtTime(.012, start + .08);
    paperGain.gain.exponentialRampToValueAtTime(.0001, start + duration);

    paper.connect(paperFilter).connect(paperGain).connect(context.destination);
    paper.start(start);
    paper.stop(start + duration);
  });
}

function playParchmentBreath() {
  const context = ensureAudioContext();
  if (!context) return;

  const startedAt = context.currentTime;
  const breath = context.createBufferSource();
  const breathFilter = context.createBiquadFilter();
  const breathGain = context.createGain();

  breath.buffer = createNoiseBuffer(context, 1.8);
  breathFilter.type = 'lowpass';
  breathFilter.frequency.setValueAtTime(260, startedAt);
  breathFilter.frequency.exponentialRampToValueAtTime(520, startedAt + .9);
  breathFilter.frequency.exponentialRampToValueAtTime(210, startedAt + 1.8);
  breathGain.gain.setValueAtTime(.0001, startedAt);
  breathGain.gain.exponentialRampToValueAtTime(.007, startedAt + .45);
  breathGain.gain.exponentialRampToValueAtTime(.0001, startedAt + 1.8);

  breath.connect(breathFilter).connect(breathGain).connect(context.destination);
  breath.start(startedAt);
  breath.stop(startedAt + 1.8);
}

function waitForCinematic(delay) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function preloadCinematic(video, backdrop) {
  const mediaToPreload = [video];
  if (backdrop && window.matchMedia('(min-width: 761px)').matches && !performanceLite) {
    mediaToPreload.push(backdrop);
  }

  mediaToPreload.forEach((media) => {
    if (!media) return;
    if (media.preload !== 'auto') media.preload = 'auto';
    if (media.readyState === 0) media.load();
  });
}

function resetCinematicStage(stage) {
  if (!stage) return;
  stage.classList.remove('is-active', 'is-bridging', 'is-leaving');
  stage.setAttribute('aria-hidden', 'true');
  stage.querySelectorAll('video').forEach((video) => {
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      video.load();
    }
  });
}

function playCinematic({ stage, video, backdrop, bodyClass, maxDuration, volume, playbackRate = 1 }) {
  if (!stage || !video || reducedMotion) return Promise.resolve('reduced');
  if (activeCinematic) return Promise.resolve('busy');
  const activeBackdrop = backdrop && window.matchMedia('(min-width: 761px)').matches && !performanceLite
    ? backdrop
    : null;

  preloadCinematic(video, activeBackdrop);
  stage.classList.remove('is-leaving', 'is-bridging');
  stage.setAttribute('aria-hidden', 'false');
  void stage.offsetWidth;
  stage.classList.add('is-active');
  document.body.classList.add('cinematic-modal-open');
  if (bodyClass) document.body.classList.add(bodyClass);

  [video, activeBackdrop].forEach((media) => {
    if (!media) return;
    media.pause();
    try {
      media.currentTime = 0;
    } catch {
      media.load();
    }
  });

  video.muted = !soundEnabled || !pageAudioActive;
  video.volume = volume;
  video.playbackRate = playbackRate;
  if (activeBackdrop) {
    activeBackdrop.muted = true;
    activeBackdrop.volume = 0;
    activeBackdrop.playbackRate = playbackRate;
  }

  return new Promise((resolve) => {
    let finished = false;
    let timeout = 0;

    const syncBackdrop = () => {
      if (!activeBackdrop || activeBackdrop.readyState < 2 || activeBackdrop.seeking) return;
      if (Math.abs(activeBackdrop.currentTime - video.currentTime) < 0.24) return;
      try {
        activeBackdrop.currentTime = video.currentTime;
      } catch {
        activeBackdrop.pause();
      }
    };

    const finish = (reason = 'ended') => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', syncBackdrop);
      video.pause();
      activeBackdrop?.pause();
      if (activeCinematic?.stage === stage) activeCinematic = null;
      resolve(reason);
    };

    const handleEnded = () => finish('ended');
    const handleError = () => finish('error');

    activeCinematic = { stage, finish };
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', syncBackdrop);
    timeout = window.setTimeout(() => finish('timeout'), maxDuration);

    activeBackdrop?.play().catch(() => {});
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => finish('error'));
    });
  });
}

async function fadeOutCinematic(stage, bodyClass, duration = 900) {
  if (!stage) return;
  stage.classList.add('is-bridging');
  await waitForCinematic(duration);
  stage.classList.add('is-leaving');
  await waitForCinematic(220);
  resetCinematicStage(stage);
  if (bodyClass) document.body.classList.remove(bodyClass);
  if (!activeCinematic && !document.querySelector('.cinematic-video-stage.is-active')) {
    document.body.classList.remove('cinematic-modal-open');
  }
}

function createOpeningTextPanels() {
  const heroContent = introScreen?.querySelector('.hero-content');
  if (!heroContent || introScreen.querySelector('.hero-content-door-copy')) return;

  ['left', 'right'].forEach((side) => {
    const copy = heroContent.cloneNode(true);
    copy.classList.add('hero-content-door-copy', `hero-content-door-copy-${side}`);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    copy.querySelectorAll('button, a').forEach((element) => element.setAttribute('tabindex', '-1'));
    introScreen.append(copy);
  });
}

function completeIntro() {
  if (introFinished) return;
  introFinished = true;
  clearIntroTimers();
  resetCinematicStage(introCinematicStage);
  document.body.classList.remove(
    'intro-active',
    'gates-opening',
    'dragon-approach',
    'dragon-fire',
    'intro-revealing',
    'intro-video-playing',
    'cinematic-modal-open'
  );
  document.body.classList.add('intro-complete');
  queueChapterIndexSync();
  setCinematicCaption('');
  preloadCinematic(vaultCinematicVideo, vaultCinematicBackdrop);
  window.setTimeout(() => introScreen?.remove(), 260);
}

function revealSite() {
  if (introFinished) return;
  startRealmTheme();
  introCinematicStage?.classList.add('is-bridging');
  document.body.classList.add('intro-revealing');
  setCinematicCaption('La fumée se dissipe et révèle le royaume.');
  queueIntro(completeIntro, reducedMotion ? 220 : 1400);
}

async function openKingdom() {
  if (introRunning || introFinished) return;
  introRunning = true;
  createOpeningTextPanels();
  introScreen?.getBoundingClientRect();
  ensureAudioContext();
  playCastleDoorSound();
  document.body.classList.add('gates-opening');
  openKingdomButton?.setAttribute('disabled', '');
  setCinematicCaption('Les lourdes portes du château s’ouvrent.');

  if (reducedMotion) {
    queueIntro(revealSite, 720);
    return;
  }

  queueIntro(() => setCinematicCaption('Le gardien ailé surgit derrière le château.'), 3100);
  queueIntro(() => setCinematicCaption('Le souffle du dragon embrase le passage.'), 6300);

  const result = await playCinematic({
    stage: introCinematicStage,
    video: introCinematicVideo,
    backdrop: introCinematicBackdrop,
    bodyClass: 'intro-video-playing',
    maxDuration: 10500,
    volume: 0.55,
    playbackRate: 1.15
  });

  if (result !== 'busy' && !introFinished) revealSite();
}

function skipIntro() {
  if (introFinished) return;
  introRunning = true;
  clearIntroTimers();
  if (activeCinematic?.stage === introCinematicStage) {
    activeCinematic.finish('skipped');
    return;
  }
  setCinematicCaption('Le royaume vous ouvre ses portes.');
  revealSite();
}

function normalizeInvitationCode(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function queueInvitationAnimation(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  invitationAnimationTimers.push(timer);
  return timer;
}

function clearInvitationAnimationTimers() {
  invitationAnimationTimers.forEach((timer) => window.clearTimeout(timer));
  invitationAnimationTimers = [];
}

function setEnvelopeStatus(message = '') {
  if (envelopeStatus) envelopeStatus.textContent = message;
}

function resetInvitationPopup() {
  if (activeCinematic?.stage === vaultCinematicStage || activeCinematic?.stage === unlockCinematicStage) {
    activeCinematic.finish('cancelled');
  }
  invitationWasShown = false;
  vaultJourneyRunning = false;
  unlockCinematicRunning = false;
  window.clearTimeout(warningTimer);
  clearInvitationAnimationTimers();
  resetCinematicStage(vaultCinematicStage);
  resetCinematicStage(unlockCinematicStage);
  invitationPopup?.classList.remove(
    'is-visible',
    'is-validating',
    'mistake-smoke',
    'mistake-stare',
    'is-unlocking',
    'is-chest-open',
    'is-envelope-ready',
    'is-seal-cracking',
    'is-breaking',
    'is-envelope-opening',
    'is-letter-rising',
    'is-letter-unfolding',
    'is-page-transition',
    'is-cinematic-arrival',
    'is-cinematic-revealed',
    'is-unlocking-video',
    'is-envelope-video-match'
  );
  invitationPopup?.setAttribute('aria-hidden', 'true');
  treasureStage?.removeAttribute('aria-busy');
  openInvitationButton?.setAttribute('disabled', '');
  closeInvitationButton?.removeAttribute('disabled');
  openInvitationButton?.closest('.chest-envelope')?.setAttribute('aria-hidden', 'true');
  invitationCodeInput?.removeAttribute('disabled');
  const submitButton = invitationCodeForm?.querySelector('button[type="submit"]');
  submitButton?.removeAttribute('disabled');
  beginVaultJourneyButton?.removeAttribute('disabled');
  if (submitButton) submitButton.textContent = 'Défier le dragon';
  if (invitationCodeError) invitationCodeError.textContent = '';
  setEnvelopeStatus('');
  document.body.classList.remove(
    'invitation-modal-open',
    'vault-cinematic-playing',
    'unlock-cinematic-playing',
    'cinematic-modal-open'
  );
  validatedInvitationCode = '';
  validatedInvitationRoute = '';
}

window.addEventListener('pageshow', (event) => {
  lockPageToTopDuringLoad();
  resetInvitationPopup();

  if (event.persisted && !document.querySelector('#intro-screen')) {
    window.location.reload();
  }
});

function showInvitationPopup({ focusCode = true, cinematicArrival = false } = {}) {
  if (!invitationPopup || invitationWasShown) return;
  invitationWasShown = true;
  if (cinematicArrival) invitationPopup.classList.add('is-cinematic-arrival');
  invitationPopup.setAttribute('aria-hidden', 'false');
  invitationPopup.classList.add('is-visible');
  document.body.classList.add('invitation-modal-open');
  preloadCinematic(unlockCinematicVideo, unlockCinematicBackdrop);

  if (cinematicArrival) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => invitationPopup.classList.add('is-cinematic-revealed'));
    });
  }

  if (focusCode) {
    window.setTimeout(() => invitationCodeInput?.focus({ preventScroll: true }), reducedMotion ? 0 : 520);
  }
}

async function beginVaultJourney() {
  if (vaultJourneyRunning || invitationPopup?.classList.contains('is-visible')) return;
  vaultJourneyRunning = true;
  beginVaultJourneyButton?.setAttribute('disabled', '');
  ensureAudioContext();
  startRealmTheme();
  if (soundEnabled) fadeThemeTo(0.035, 650);

  const result = await playCinematic({
    stage: vaultCinematicStage,
    video: vaultCinematicVideo,
    backdrop: vaultCinematicBackdrop,
    bodyClass: 'vault-cinematic-playing',
    maxDuration: 9000,
    volume: 0.58
  });

  if (result === 'busy' || result === 'cancelled') {
    vaultJourneyRunning = false;
    beginVaultJourneyButton?.removeAttribute('disabled');
    return;
  }

  showInvitationPopup({ focusCode: false, cinematicArrival: !reducedMotion });
  await fadeOutCinematic(vaultCinematicStage, 'vault-cinematic-playing', reducedMotion ? 0 : 880);
  invitationPopup?.classList.remove('is-cinematic-arrival', 'is-cinematic-revealed');
  vaultJourneyRunning = false;
  beginVaultJourneyButton?.removeAttribute('disabled');
  if (soundEnabled) fadeThemeTo(0.11, 1400);
  window.setTimeout(() => invitationCodeInput?.focus({ preventScroll: true }), reducedMotion ? 0 : 260);
}

async function initialiseSupabase() {
  if (supabaseClient) return supabaseClient;
  const supabaseConfig = window.SUPABASE_CONFIG ?? null;
  if (!supabaseConfig?.url || !supabaseConfig?.anonKey) return null;

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  return supabaseClient;
}

function getInvitationFingerprint() {
  try {
    const stored = localStorage.getItem('dhinaut-weller-device');
    if (stored) return stored;
    const generated = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    localStorage.setItem('dhinaut-weller-device', generated);
    return generated;
  } catch {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }
}

async function validateInvitationCode(code) {
  if (code === 'ADMIN!!!') {
    return {
      household_name: 'Conseil Restreint — Administration',
      route: 'admin.html?demo=1'
    };
  }

  if (code === 'BENDHI') {
    return {
      household_name: 'Maison Dhinaut-Weller — Démonstration',
      route: 'invitation.html?code=DEMO&admin=1'
    };
  }

  const client = await initialiseSupabase();
  if (!client) throw new Error('Configuration Supabase indisponible');

  let response = await client.rpc('get_invitation_by_code', {
    p_code: code,
    p_fingerprint: getInvitationFingerprint()
  });
  if (response.error?.code === 'PGRST202' || response.error?.message?.includes('p_fingerprint')) {
    response = await client.rpc('get_invitation_by_code', { p_code: code });
  }
  if (response.error) throw response.error;
  if (!response.data) return null;

  return {
    household_name: response.data.household_name || 'Maison invitée',
    route: `invitation.html?code=${encodeURIComponent(code)}`
  };
}

function restoreCodeForm(delay) {
  const submitButton = invitationCodeForm?.querySelector('button[type="submit"]');
  window.setTimeout(() => {
    invitationPopup?.classList.remove('is-validating');
    treasureStage?.removeAttribute('aria-busy');
    invitationCodeInput?.removeAttribute('disabled');
    submitButton?.removeAttribute('disabled');
    if (submitButton) submitButton.textContent = 'Défier le dragon';
    invitationCodeInput?.focus({ preventScroll: true });
  }, delay);
}

function showWrongCode(message, delay) {
  if (!invitationPopup) return;
  const animationClass = wrongCodeAttempts % 2 === 0 ? 'mistake-stare' : 'mistake-smoke';
  invitationPopup.classList.remove('mistake-smoke', 'mistake-stare');
  void invitationPopup.offsetWidth;
  invitationPopup.classList.add(animationClass);
  if (dragonWarningText) dragonWarningText.textContent = message;
  dragonWarning?.setAttribute('aria-hidden', 'false');
  if (invitationCodeError) invitationCodeError.textContent = `${message} Nouvelle tentative dans ${Math.ceil(delay / 1000)} s.`;

  window.clearTimeout(warningTimer);
  warningTimer = window.setTimeout(() => {
    invitationPopup.classList.remove(animationClass);
    dragonWarning?.setAttribute('aria-hidden', 'true');
  }, 1900);

  restoreCodeForm(delay);
}

async function unlockTreasure(result, code) {
  if (!invitationPopup || unlockCinematicRunning) return;
  unlockCinematicRunning = true;
  clearInvitationAnimationTimers();
  validatedInvitationCode = code;
  validatedInvitationRoute = result.route;
  if (validatedHousehold) validatedHousehold.textContent = result.household_name;
  if (invitationCodeError) invitationCodeError.textContent = 'Le dragon reconnaît votre Maison.';
  invitationPopup.classList.remove('is-validating');
  invitationPopup.classList.add('is-unlocking-video');
  treasureStage?.setAttribute('aria-busy', 'true');
  closeInvitationButton?.setAttribute('disabled', '');
  if (soundEnabled) fadeThemeTo(0.025, 600);

  const cinematicResult = await playCinematic({
    stage: unlockCinematicStage,
    video: unlockCinematicVideo,
    backdrop: unlockCinematicBackdrop,
    bodyClass: 'unlock-cinematic-playing',
    maxDuration: 11000,
    volume: 0.62,
    playbackRate: 1.05
  });

  if (cinematicResult === 'busy' || cinematicResult === 'cancelled') {
    unlockCinematicRunning = false;
    return;
  }

  invitationPopup.classList.add('is-unlocking', 'is-chest-open', 'is-envelope-ready', 'is-envelope-video-match');
  openInvitationButton?.removeAttribute('disabled');
  openInvitationButton?.closest('.chest-envelope')?.setAttribute('aria-hidden', 'false');
  setEnvelopeStatus('L’enveloppe royale est devant vous. Brisez son sceau pour poursuivre.');

  await fadeOutCinematic(unlockCinematicStage, 'unlock-cinematic-playing', reducedMotion ? 0 : 920);
  invitationPopup.classList.remove('is-unlocking-video', 'is-envelope-video-match');
  treasureStage?.removeAttribute('aria-busy');
  closeInvitationButton?.removeAttribute('disabled');
  unlockCinematicRunning = false;
  if (soundEnabled) fadeThemeTo(0.11, 1500);
  window.setTimeout(() => openInvitationButton?.focus({ preventScroll: true }), reducedMotion ? 0 : 300);
}

async function openPersonalInvitation(event) {
  event.preventDefault();
  if (!invitationCodeInput || !invitationPopup) return;

  const now = Date.now();
  if (now < nextCodeAttemptAt) {
    const remaining = Math.max(1, Math.ceil((nextCodeAttemptAt - now) / 1000));
    if (invitationCodeError) invitationCodeError.textContent = `Le dragon garde le silence encore ${remaining} s.`;
    return;
  }

  const code = normalizeInvitationCode(invitationCodeInput.value);
  if (!/^(?:[A-Z0-9]{6,40}|ADMIN!!!)$/.test(code)) {
    wrongCodeAttempts += 1;
    const delay = Math.min(7000, 900 + (wrongCodeAttempts * 700));
    nextCodeAttemptAt = Date.now() + delay;
    showWrongCode('Le dragon soupire des cendres : ce code ne ressemble à aucun serment connu.', delay);
    return;
  }

  const submitButton = invitationCodeForm?.querySelector('button[type="submit"]');
  invitationPopup.classList.add('is-validating');
  treasureStage?.setAttribute('aria-busy', 'true');
  invitationCodeInput.setAttribute('disabled', '');
  submitButton?.setAttribute('disabled', '');
  if (submitButton) submitButton.textContent = 'Le dragon écoute…';
  if (invitationCodeError) invitationCodeError.textContent = '';

  try {
    const result = await validateInvitationCode(code);
    if (!result) {
      wrongCodeAttempts += 1;
      const delay = Math.min(8000, 1100 + (wrongCodeAttempts * 850));
      nextCodeAttemptAt = Date.now() + delay;
      const message = wrongCodeAttempts % 2 === 0
        ? 'Le dragon vous regarde fixement. Il ne reconnaît pas cette Maison.'
        : 'Une fumée noire s’échappe de ses narines : le code est incorrect.';
      showWrongCode(message, delay);
      return;
    }

    wrongCodeAttempts = 0;
    nextCodeAttemptAt = 0;
    unlockTreasure(result, code);
  } catch (error) {
    console.error('Impossible de vérifier le code :', error);
    if (invitationCodeError) {
      invitationCodeError.textContent = 'Les archives du royaume sont momentanément inaccessibles. Réessayez dans un instant.';
    }
    restoreCodeForm(1200);
  }
}

function openInvitation() {
  if (!invitationPopup?.classList.contains('is-envelope-ready') || invitationPopup.classList.contains('is-seal-cracking')) return;

  invitationPopup.classList.add('is-seal-cracking');
  openInvitationButton?.setAttribute('disabled', '');
  closeInvitationButton?.setAttribute('disabled', '');
  setEnvelopeStatus('Le sceau de cire se fissure.');
  playWaxSealBreak();

  const timing = reducedMotion
    ? { break: 30, open: 80, rise: 150, unfold: 240, transition: 360, navigate: 560 }
    : { break: 260, open: 790, rise: 2250, unfold: 3520, transition: 4920, navigate: 5880 };

  queueInvitationAnimation(() => invitationPopup.classList.add('is-breaking'), timing.break);
  queueInvitationAnimation(() => {
    invitationPopup.classList.add('is-envelope-opening');
    setEnvelopeStatus('Les rabats de l’enveloppe s’ouvrent.');
    playPaperUnfold();
  }, timing.open);
  queueInvitationAnimation(() => {
    invitationPopup.classList.add('is-letter-rising');
    setEnvelopeStatus('La lettre ancienne sort de l’enveloppe.');
  }, timing.rise);
  queueInvitationAnimation(() => {
    invitationPopup.classList.add('is-letter-unfolding');
    setEnvelopeStatus('Le parchemin se déplie devant vous.');
    playParchmentBreath();
  }, timing.unfold);
  queueInvitationAnimation(() => {
    invitationPopup.classList.add('is-page-transition');
    setEnvelopeStatus('Le parchemin devient votre invitation.');
    try {
      if (validatedInvitationRoute.includes('invitation.html')) {
        sessionStorage.setItem('dhinaut-weller-envelope-transition', '1');
      } else {
        sessionStorage.removeItem('dhinaut-weller-envelope-transition');
      }
      sessionStorage.setItem(musicTimeKey, String(realmTheme.currentTime));
      sessionStorage.setItem(musicHandoffKey, '1');
    } catch {}
  }, timing.transition);
  queueInvitationAnimation(() => {
    if (validatedInvitationCode && validatedInvitationRoute) {
      window.location.assign(validatedInvitationRoute);
    }
  }, timing.navigate);
}

function closeInvitation() {
  if (!invitationPopup) return;
  if (invitationPopup.classList.contains('is-seal-cracking') || unlockCinematicRunning) return;
  invitationPopup.classList.remove('is-visible');
  invitationPopup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('invitation-modal-open');
  window.setTimeout(resetInvitationPopup, 560);
}

openKingdomButton?.addEventListener('click', openKingdom);
skipIntroButton?.addEventListener('click', skipIntro);
soundToggle?.addEventListener('click', toggleSound);
beginVaultJourneyButton?.addEventListener('click', beginVaultJourney);
openInvitationButton?.addEventListener('click', openInvitation);
closeInvitationButton?.addEventListener('click', closeInvitation);
invitationCodeForm?.addEventListener('submit', openPersonalInvitation);
cinematicSkipButtons.forEach((button) => {
  button.addEventListener('click', () => activeCinematic?.finish('skipped'));
});

preloadCinematic(introCinematicVideo, introCinematicBackdrop);

invitationPopup?.addEventListener('click', (event) => {
  if (event.target === invitationPopup) closeInvitation();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && invitationPopup?.classList.contains('is-visible')) {
    closeInvitation();
  }
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -40px' }
  );

  revealElements.forEach((element) => revealObserver.observe(element));

  if (invitationTrigger) {
    const invitationObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        preloadCinematic(vaultCinematicVideo, vaultCinematicBackdrop);
        invitationObserver.disconnect();
      },
      { threshold: 0.5 }
    );

    window.requestAnimationFrame(() => invitationObserver.observe(invitationTrigger));
  }
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80) {
      preloadCinematic(vaultCinematicVideo, vaultCinematicBackdrop);
    }
  }, { passive: true });
}
