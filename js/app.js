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
const soundToggle = document.querySelector('#sound-toggle');
const soundToggleLabel = soundToggle?.querySelector('.sound-toggle-label');
const revealElements = document.querySelectorAll('.reveal');
const companionsGrid = document.querySelector('.companions-grid');
const yumeCard = document.querySelector('.companion-card-flame');
const invitationTrigger = document.querySelector('#invitation');
const invitationPopup = document.querySelector('#invitation-popup');
const treasureStage = document.querySelector('#treasure-stage');
const openInvitationButton = document.querySelector('#open-invitation');
const closeInvitationButton = document.querySelector('.invitation-popup-close');
const invitationCodeForm = document.querySelector('#invitation-code-form');
const invitationCodeInput = document.querySelector('#invitation-code');
const invitationCodeError = document.querySelector('#invitation-code-error');
const dragonWarning = document.querySelector('#dragon-warning');
const dragonWarningText = dragonWarning?.querySelector('p');
const validatedHousehold = document.querySelector('#validated-household');
const enterInvitationButton = document.querySelector('#enter-invitation');

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

const soundPreferenceKey = 'dhinaut-weller-sound';
const musicTimeKey = 'dhinaut-weller-music-time';
const realmTheme = new Audio('assets/realm-theme.mp3');
const castleDoorSound = new Audio('assets/castle-door-opening.mp3');
realmTheme.preload = 'metadata';
realmTheme.loop = true;
realmTheme.volume = 0;
castleDoorSound.preload = 'auto';
castleDoorSound.volume = 0.24;

realmTheme.addEventListener('loadedmetadata', () => {
  const savedTime = Number(sessionStorage.getItem(musicTimeKey));
  if (Number.isFinite(savedTime) && savedTime > 0 && savedTime < realmTheme.duration) {
    realmTheme.currentTime = savedTime;
  }
}, { once: true });

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
let introRunning = false;
let introFinished = false;
let introTimers = [];
let invitationWasShown = false;
let supabaseClient = null;
let validatedInvitationCode = '';
let validatedInvitationRoute = '';
let wrongCodeAttempts = 0;
let nextCodeAttemptAt = 0;
let warningTimer = null;

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
  if (!soundEnabled) return null;
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
  if (!soundEnabled) return;
  window.clearTimeout(castleDoorSoundTimer);
  castleDoorSound.pause();
  castleDoorSound.currentTime = 0.35;
  castleDoorSound.play().catch(() => {});
  castleDoorSoundTimer = window.setTimeout(() => castleDoorSound.pause(), 4300);
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
  document.body.classList.remove('intro-active', 'gates-opening', 'dragon-approach', 'dragon-fire', 'intro-revealing');
  document.body.classList.add('intro-complete');
  setCinematicCaption('');
  window.setTimeout(() => introScreen?.remove(), 260);
}

function revealSite() {
  if (introFinished) return;
  document.body.classList.add('intro-revealing');
  setCinematicCaption('La fumée se dissipe et révèle le royaume.');
  queueIntro(completeIntro, reducedMotion ? 220 : 1650);
}

function openKingdom() {
  if (introRunning || introFinished) return;
  introRunning = true;
  createOpeningTextPanels();
  introScreen?.getBoundingClientRect();
  ensureAudioContext();
  startRealmTheme();
  playCastleDoorSound();
  document.body.classList.add('gates-opening');
  openKingdomButton?.setAttribute('disabled', '');
  setCinematicCaption('Les lourdes portes du château s’ouvrent.');

  if (reducedMotion) {
    queueIntro(revealSite, 720);
    return;
  }

  queueIntro(() => {
    document.body.classList.add('dragon-approach');
    setCinematicCaption('Un dragon surgit au-dessus des remparts.');
  }, 980);

  queueIntro(() => {
    playDragonRoar();
    setCinematicCaption('Le rugissement du gardien traverse le royaume.');
  }, 1920);

  queueIntro(() => {
    document.body.classList.add('dragon-fire');
    playFireWhoosh();
    setCinematicCaption('Le dragon embrase les anciennes portes.');
  }, 2870);

  queueIntro(revealSite, 3520);
}

function skipIntro() {
  if (introFinished) return;
  introRunning = true;
  clearIntroTimers();
  startRealmTheme();
  document.body.classList.add('intro-revealing');
  setCinematicCaption('Le royaume vous ouvre ses portes.');
  queueIntro(completeIntro, reducedMotion ? 80 : 360);
}

function normalizeInvitationCode(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function resetInvitationPopup() {
  invitationWasShown = false;
  window.clearTimeout(warningTimer);
  invitationPopup?.classList.remove(
    'is-visible',
    'is-validating',
    'mistake-smoke',
    'mistake-stare',
    'is-unlocking',
    'is-chest-open',
    'is-envelope-ready',
    'is-breaking',
    'is-open',
    'is-letter-visible'
  );
  invitationPopup?.setAttribute('aria-hidden', 'true');
  treasureStage?.removeAttribute('aria-busy');
  openInvitationButton?.setAttribute('disabled', '');
  openInvitationButton?.closest('.chest-envelope')?.setAttribute('aria-hidden', 'true');
  invitationCodeInput?.removeAttribute('disabled');
  const submitButton = invitationCodeForm?.querySelector('button[type="submit"]');
  submitButton?.removeAttribute('disabled');
  if (submitButton) submitButton.textContent = 'Défier le dragon';
  if (invitationCodeError) invitationCodeError.textContent = '';
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
  invitationPopup.classList.add('is-visible');
  document.body.classList.add('invitation-modal-open');
  window.setTimeout(() => invitationCodeInput?.focus({ preventScroll: true }), reducedMotion ? 0 : 520);
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

function unlockTreasure(result, code) {
  if (!invitationPopup) return;
  validatedInvitationCode = code;
  validatedInvitationRoute = result.route;
  if (validatedHousehold) validatedHousehold.textContent = result.household_name;
  if (invitationCodeError) invitationCodeError.textContent = 'Le dragon reconnaît votre Maison.';
  invitationPopup.classList.remove('is-validating');
  invitationPopup.classList.add('is-unlocking');
  treasureStage?.removeAttribute('aria-busy');

  window.setTimeout(() => invitationPopup.classList.add('is-chest-open'), reducedMotion ? 0 : 820);
  window.setTimeout(() => {
    invitationPopup.classList.add('is-envelope-ready');
    openInvitationButton?.removeAttribute('disabled');
    openInvitationButton?.closest('.chest-envelope')?.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => openInvitationButton?.focus({ preventScroll: true }), reducedMotion ? 0 : 1050);
  }, reducedMotion ? 20 : 1780);
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
  if (!invitationPopup?.classList.contains('is-envelope-ready') || invitationPopup.classList.contains('is-breaking')) return;
  invitationPopup.classList.add('is-breaking');
  openInvitationButton?.setAttribute('disabled', '');
  window.setTimeout(() => invitationPopup.classList.add('is-open'), reducedMotion ? 0 : 620);
  window.setTimeout(() => invitationPopup.classList.add('is-letter-visible'), reducedMotion ? 10 : 1780);
  if (finePointer) {
    window.setTimeout(() => enterInvitationButton?.focus({ preventScroll: true }), reducedMotion ? 20 : 3800);
  }
}

function enterInvitation() {
  if (!validatedInvitationCode || !validatedInvitationRoute) return;
  window.location.href = validatedInvitationRoute;
}

function closeInvitation() {
  if (!invitationPopup) return;
  invitationPopup.classList.remove('is-visible');
  invitationPopup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('invitation-modal-open');
  window.setTimeout(resetInvitationPopup, 560);
}

openKingdomButton?.addEventListener('click', openKingdom);
skipIntroButton?.addEventListener('click', skipIntro);
soundToggle?.addEventListener('click', toggleSound);
openInvitationButton?.addEventListener('click', openInvitation);
enterInvitationButton?.addEventListener('click', enterInvitation);
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

  if (invitationTrigger) {
    const invitationObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        showInvitationPopup();
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
      showInvitationPopup();
    }
  }, { passive: true });
}
