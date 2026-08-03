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
const soundToggle = document.querySelector('#sound-toggle');
const soundToggleLabel = soundToggle?.querySelector('.sound-toggle-label');
const realmIndex = document.querySelector('.realm-index');
const realmIndexLinks = [...document.querySelectorAll('.realm-index-links a[href^="#"]')];
const chapterSections = realmIndexLinks
  .map((link) => document.querySelector(link.hash))
  .filter(Boolean);
const revealElements = document.querySelectorAll('.reveal');
const companionsGrid = document.querySelector('.companions-grid');
const yumeCard = document.querySelector('.companion-card-flame');
const summonRavenButton = document.querySelector('#summon-raven');
const invitationPopup = document.querySelector('#invitation-popup');
const ravenDeliveryStage = document.querySelector('#raven-delivery-stage');
const openInvitationButton = document.querySelector('#open-invitation');
const closeInvitationButton = document.querySelector('.invitation-popup-close');
const invitationCodeForm = document.querySelector('#invitation-code-form');
const invitationCodeInput = document.querySelector('#invitation-code');
const invitationCodeError = document.querySelector('#invitation-code-error');
const ravenWarning = document.querySelector('#raven-warning');
const ravenWarningText = ravenWarning?.querySelector('p');
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
  if (!chapterId) return;
  setActiveChapter(chapterId);
}

function getCurrentChapterId() {
  const indexOffset = (realmIndex?.offsetHeight ?? 0) + Math.min(window.innerHeight * .22, 180);
  let currentSection = chapterSections[0];

  chapterSections.forEach((section) => {
    if (section.getBoundingClientRect().top <= indexOffset) currentSection = section;
  });

  return currentSection?.id;
}

function syncChapterIndex() {
  chapterIndexFrame = 0;
  if (!document.body.classList.contains('intro-complete')) return;
  const visibleChapterId = getCurrentChapterId();
  if (visibleChapterId) setActiveChapter(visibleChapterId);
}

function queueChapterIndexSync() {
  if (chapterIndexFrame) return;
  chapterIndexFrame = window.requestAnimationFrame(syncChapterIndex);
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

const soundPreferenceKey = 'dhinaut-weller-sound';
const musicTimeKey = 'dhinaut-weller-music-time';
const musicHandoffKey = 'dhinaut-weller-music-handoff';
const realmTheme = new Audio('assets/realm-theme.mp3');
const castleDoorSound = new Audio('assets/castle-door-opening.mp3');
const castleDoorOpeningDuration = 1950;
const castleDoorSoundDuration = 1900;
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
let ravenDeliveryRunning = false;
let letterExchangeRunning = false;
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

updateSoundToggle();
document.body.classList.add('sound-ready');

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
  castleDoorSoundTimer = window.setTimeout(() => castleDoorSound.pause(), castleDoorSoundDuration);
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
  startRealmTheme();
  document.body.classList.remove('intro-active');
  document.body.classList.add('intro-complete');
  setActiveChapter('maisons');
  scrollToPageTop();
  queueChapterIndexSync();
  window.setTimeout(() => {
    introScreen?.remove();
    document.body.classList.remove('gates-opening');
  }, 260);
}

function openKingdom() {
  if (introRunning || introFinished) return;
  introRunning = true;
  createOpeningTextPanels();
  introScreen?.getBoundingClientRect();
  ensureAudioContext();
  playCastleDoorSound();
  document.body.classList.add('gates-opening');
  openKingdomButton?.setAttribute('disabled', '');
  queueIntro(completeIntro, reducedMotion ? 120 : castleDoorOpeningDuration);
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
  invitationWasShown = false;
  ravenDeliveryRunning = false;
  letterExchangeRunning = false;
  window.clearTimeout(warningTimer);
  clearInvitationAnimationTimers();
  invitationPopup?.classList.remove(
    'is-visible',
    'is-raven-arriving',
    'is-raven-landed',
    'is-raven-departing',
    'is-validating',
    'mistake-raven',
    'is-envelope-ready',
    'is-seal-cracking',
    'is-seal-broken',
    'is-breaking',
    'is-envelope-opening',
    'is-letter-rising',
    'is-letter-unfolding',
    'is-page-transition'
  );
  invitationPopup?.setAttribute('aria-hidden', 'true');
  ravenDeliveryStage?.removeAttribute('aria-busy');
  openInvitationButton?.setAttribute('disabled', '');
  closeInvitationButton?.removeAttribute('disabled');
  openInvitationButton?.closest('.delivered-envelope')?.setAttribute('aria-hidden', 'true');
  invitationCodeInput?.removeAttribute('disabled');
  const submitButton = invitationCodeForm?.querySelector('button[type="submit"]');
  submitButton?.removeAttribute('disabled');
  summonRavenButton?.removeAttribute('disabled');
  if (submitButton) submitButton.textContent = 'Présenter le code';
  if (invitationCodeError) invitationCodeError.textContent = '';
  ravenWarning?.setAttribute('aria-hidden', 'true');
  setEnvelopeStatus('');
  document.body.classList.remove('invitation-modal-open');
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

function showInvitationPopup() {
  if (!invitationPopup || invitationWasShown) return;
  invitationWasShown = true;
  invitationPopup.setAttribute('aria-hidden', 'false');
  invitationPopup.classList.add('is-visible', 'is-raven-arriving');
  document.body.classList.add('invitation-modal-open');

  queueInvitationAnimation(() => {
    invitationPopup.classList.remove('is-raven-arriving');
    invitationPopup.classList.add('is-raven-landed');
    ravenDeliveryRunning = false;
    summonRavenButton?.removeAttribute('disabled');
    invitationCodeInput?.focus({ preventScroll: true });
  }, reducedMotion ? 80 : 1900);
}

function summonRaven() {
  if (ravenDeliveryRunning || invitationPopup?.classList.contains('is-visible')) return;
  ravenDeliveryRunning = true;
  summonRavenButton?.setAttribute('disabled', '');
  ensureAudioContext();
  startRealmTheme();
  showInvitationPopup();
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
    ravenDeliveryStage?.removeAttribute('aria-busy');
    invitationCodeInput?.removeAttribute('disabled');
    submitButton?.removeAttribute('disabled');
    if (submitButton) submitButton.textContent = 'Présenter le code';
    invitationCodeInput?.focus({ preventScroll: true });
  }, delay);
}

function showWrongCode(message, delay) {
  if (!invitationPopup) return;
  invitationPopup.classList.remove('mistake-raven');
  void invitationPopup.offsetWidth;
  invitationPopup.classList.add('mistake-raven');
  if (ravenWarningText) ravenWarningText.textContent = message;
  ravenWarning?.setAttribute('aria-hidden', 'false');
  if (invitationCodeError) invitationCodeError.textContent = `${message} Nouvelle tentative dans ${Math.ceil(delay / 1000)} s.`;

  window.clearTimeout(warningTimer);
  warningTimer = window.setTimeout(() => {
    invitationPopup.classList.remove('mistake-raven');
    ravenWarning?.setAttribute('aria-hidden', 'true');
  }, 1900);

  restoreCodeForm(delay);
}

function exchangeCodeForLetter(result, code) {
  if (!invitationPopup || letterExchangeRunning) return;
  letterExchangeRunning = true;
  clearInvitationAnimationTimers();
  validatedInvitationCode = code;
  validatedInvitationRoute = result.route;
  if (validatedHousehold) validatedHousehold.textContent = result.household_name;
  if (invitationCodeError) invitationCodeError.textContent = 'La corneille reconnaît votre Maison.';
  invitationPopup.classList.remove('is-validating');
  invitationPopup.classList.add('is-raven-departing');
  ravenDeliveryStage?.setAttribute('aria-busy', 'true');
  closeInvitationButton?.setAttribute('disabled', '');

  queueInvitationAnimation(() => {
    invitationPopup.classList.add('is-envelope-ready');
    openInvitationButton?.removeAttribute('disabled');
    openInvitationButton?.closest('.delivered-envelope')?.setAttribute('aria-hidden', 'false');
    setEnvelopeStatus('La corneille vous remet l’enveloppe royale. Touchez le sceau pour poursuivre.');
    ravenDeliveryStage?.removeAttribute('aria-busy');
    closeInvitationButton?.removeAttribute('disabled');
    letterExchangeRunning = false;
    openInvitationButton?.focus({ preventScroll: true });
  }, reducedMotion ? 80 : 780);
}

async function openPersonalInvitation(event) {
  event.preventDefault();
  if (!invitationCodeInput || !invitationPopup) return;

  const now = Date.now();
  if (now < nextCodeAttemptAt) {
    const remaining = Math.max(1, Math.ceil((nextCodeAttemptAt - now) / 1000));
    if (invitationCodeError) invitationCodeError.textContent = `La corneille attend encore ${remaining} s.`;
    return;
  }

  const code = normalizeInvitationCode(invitationCodeInput.value);
  if (!/^(?:[A-Z0-9]{6,40}|ADMIN!!!)$/.test(code)) {
    wrongCodeAttempts += 1;
    const delay = Math.min(7000, 900 + (wrongCodeAttempts * 700));
    nextCodeAttemptAt = Date.now() + delay;
    showWrongCode('La corneille refuse ce code : il ne correspond à aucun serment connu.', delay);
    return;
  }

  const submitButton = invitationCodeForm?.querySelector('button[type="submit"]');
  invitationPopup.classList.add('is-validating');
  ravenDeliveryStage?.setAttribute('aria-busy', 'true');
  invitationCodeInput.setAttribute('disabled', '');
  submitButton?.setAttribute('disabled', '');
  if (submitButton) submitButton.textContent = 'La corneille vérifie…';
  if (invitationCodeError) invitationCodeError.textContent = '';

  try {
    const result = await validateInvitationCode(code);
    if (!result) {
      wrongCodeAttempts += 1;
      const delay = Math.min(8000, 1100 + (wrongCodeAttempts * 850));
      nextCodeAttemptAt = Date.now() + delay;
      const message = wrongCodeAttempts % 2 === 0
        ? 'Le troisième œil reste fermé : cette Maison lui est inconnue.'
        : 'La corneille ne reconnaît pas cette Maison.';
      showWrongCode(message, delay);
      return;
    }

    wrongCodeAttempts = 0;
    nextCodeAttemptAt = 0;
    exchangeCodeForLetter(result, code);
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
  setEnvelopeStatus('Le sceau de cire se brise. Votre invitation va s’ouvrir.');
  realmThemePausedByInactivity = false;
  fadeThemeTo(0, reducedMotion ? 40 : 450, true);
  playWaxSealBreak();

  const sealBreakDelay = reducedMotion ? 20 : 260;
  const transitionDelay = reducedMotion ? 40 : 620;
  const navigationDelay = reducedMotion ? 120 : 1050;

  queueInvitationAnimation(() => {
    invitationPopup.classList.add('is-seal-broken');
  }, sealBreakDelay);

  queueInvitationAnimation(() => {
    try {
      if (validatedInvitationRoute.includes('invitation.html')) {
        sessionStorage.setItem('dhinaut-weller-envelope-transition', '1');
      } else {
        sessionStorage.removeItem('dhinaut-weller-envelope-transition');
      }
      sessionStorage.removeItem(musicTimeKey);
      sessionStorage.removeItem(musicHandoffKey);
    } catch {}
  }, transitionDelay);
  queueInvitationAnimation(() => {
    if (validatedInvitationCode && validatedInvitationRoute) {
      window.location.assign(validatedInvitationRoute);
    }
  }, navigationDelay);
}

function closeInvitation() {
  if (!invitationPopup) return;
  if (invitationPopup.classList.contains('is-seal-cracking') || letterExchangeRunning) return;
  invitationPopup.classList.remove('is-visible');
  invitationPopup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('invitation-modal-open');
  window.setTimeout(resetInvitationPopup, 560);
}

openKingdomButton?.addEventListener('click', openKingdom);
soundToggle?.addEventListener('click', toggleSound);
summonRavenButton?.addEventListener('click', summonRaven);
openInvitationButton?.addEventListener('click', openInvitation);
closeInvitationButton?.addEventListener('click', closeInvitation);
invitationCodeForm?.addEventListener('submit', openPersonalInvitation);

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
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}
