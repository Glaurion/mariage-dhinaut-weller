const introScreen = document.querySelector('#intro-screen');
const openKingdomButton = document.querySelector('#open-kingdom');
const revealElements = document.querySelectorAll('.reveal');
const invitationTrigger = document.querySelector('#invitation');
const invitationPopup = document.querySelector('#invitation-popup');
const openInvitationButton = document.querySelector('#open-invitation');
const closeInvitationButton = document.querySelector('.invitation-popup-close');
const invitationCodeForm = document.querySelector('#invitation-code-form');
const invitationCodeInput = document.querySelector('#invitation-code');
const invitationCodeError = document.querySelector('#invitation-code-error');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let invitationWasShown = false;

function playCastleDoorSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audioContext = new AudioContext();
  const startTime = audioContext.currentTime;
  const duration = 2.1;
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, startTime);
  masterGain.gain.exponentialRampToValueAtTime(0.42, startTime + 0.08);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  masterGain.connect(audioContext.destination);

  const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = (Math.random() * 2 - 1) * (1 - index / noiseData.length);
  }

  const noise = audioContext.createBufferSource();
  const woodFilter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  noise.buffer = noiseBuffer;
  woodFilter.type = 'bandpass';
  woodFilter.frequency.setValueAtTime(120, startTime);
  woodFilter.frequency.exponentialRampToValueAtTime(55, startTime + duration);
  woodFilter.Q.value = 1.4;
  noiseGain.gain.setValueAtTime(0.32, startTime);
  noiseGain.gain.linearRampToValueAtTime(0.08, startTime + duration);
  noise.connect(woodFilter).connect(noiseGain).connect(masterGain);

  const creak = audioContext.createOscillator();
  const creakGain = audioContext.createGain();
  const creakFilter = audioContext.createBiquadFilter();
  creak.type = 'sawtooth';
  creak.frequency.setValueAtTime(76, startTime);
  creak.frequency.linearRampToValueAtTime(43, startTime + 0.7);
  creak.frequency.linearRampToValueAtTime(68, startTime + 1.3);
  creak.frequency.linearRampToValueAtTime(34, startTime + duration);
  creakFilter.type = 'lowpass';
  creakFilter.frequency.value = 480;
  creakGain.gain.setValueAtTime(0.0001, startTime);
  creakGain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.12);
  creakGain.gain.exponentialRampToValueAtTime(0.035, startTime + duration);
  creak.connect(creakFilter).connect(creakGain).connect(masterGain);

  [0, 0.72, 1.45].forEach((offset, index) => {
    const impact = audioContext.createOscillator();
    const impactGain = audioContext.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(64 - index * 8, startTime + offset);
    impact.frequency.exponentialRampToValueAtTime(28, startTime + offset + 0.28);
    impactGain.gain.setValueAtTime(0.24 - index * 0.04, startTime + offset);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, startTime + offset + 0.32);
    impact.connect(impactGain).connect(masterGain);
    impact.start(startTime + offset);
    impact.stop(startTime + offset + 0.34);
  });

  noise.start(startTime);
  noise.stop(startTime + duration);
  creak.start(startTime);
  creak.stop(startTime + duration);
  window.setTimeout(() => audioContext.close(), (duration + 0.4) * 1000);
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

function revealSite() {
  document.body.classList.remove('intro-active', 'gates-opening');
  document.body.classList.add('intro-complete');
  window.setTimeout(() => introScreen?.remove(), reducedMotion ? 50 : 250);
}

function openKingdom() {
  if (document.body.classList.contains('gates-opening')) return;
  createOpeningTextPanels();
  playCastleDoorSound();
  document.body.classList.add('gates-opening');
  openKingdomButton?.setAttribute('disabled', '');
  window.setTimeout(revealSite, reducedMotion ? 100 : 2050);
}

function showInvitationPopup() {
  if (!invitationPopup || invitationWasShown) return;
  invitationWasShown = true;
  invitationPopup.setAttribute('aria-hidden', 'false');
  invitationPopup.classList.add('is-visible');
  document.body.classList.add('invitation-modal-open');
  window.setTimeout(() => openInvitationButton?.focus(), reducedMotion ? 0 : 450);
}

function openInvitation() {
  if (!invitationPopup || invitationPopup.classList.contains('is-breaking')) return;
  invitationPopup.classList.add('is-breaking');
  openInvitationButton?.setAttribute('disabled', '');
  window.setTimeout(() => invitationPopup.classList.add('is-open'), reducedMotion ? 0 : 520);
  window.setTimeout(() => closeInvitationButton?.focus(), reducedMotion ? 0 : 1750);
}

function closeInvitation() {
  if (!invitationPopup) return;
  invitationPopup.classList.remove('is-visible', 'is-breaking', 'is-open');
  invitationPopup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('invitation-modal-open');
  openInvitationButton?.removeAttribute('disabled');
}

function openPersonalInvitation(event) {
  event.preventDefault();
  const invitationCode = invitationCodeInput?.value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  if (!invitationCode || !/^[A-ZÀ-ÖØ-Ý0-9-]{4,40}$/.test(invitationCode)) {
    if (invitationCodeError) {
      invitationCodeError.textContent = 'Saisissez un code valide composé de lettres et de chiffres.';
    }
    invitationCodeInput?.focus();
    return;
  }

  if (invitationCodeError) invitationCodeError.textContent = '';
  window.location.href = `invitation.html?code=${encodeURIComponent(invitationCode)}`;
}

openKingdomButton?.addEventListener('click', openKingdom);
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

  if (invitationTrigger) {
    const invitationObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        showInvitationPopup();
        invitationObserver.disconnect();
      },
      { threshold: 0.5 }
    );

    invitationObserver.observe(invitationTrigger);
  }
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80) {
      showInvitationPopup();
    }
  }, { passive: true });
}
