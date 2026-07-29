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
const revealElements = document.querySelectorAll('.reveal');
const invitationTrigger = document.querySelector('#invitation');
const invitationPopup = document.querySelector('#invitation-popup');
const openInvitationButton = document.querySelector('#open-invitation');
const closeInvitationButton = document.querySelector('.invitation-popup-close');
const invitationCodeForm = document.querySelector('#invitation-code-form');
const invitationCodeInput = document.querySelector('#invitation-code');
const invitationCodeError = document.querySelector('#invitation-code-error');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const castleDoorSound = new Audio('assets/castle-door-opening.mp3');
castleDoorSound.preload = 'auto';
castleDoorSound.volume = 0.28;
let castleDoorSoundTimer = null;
let invitationWasShown = false;

function resetInvitationPopup() {
  invitationWasShown = false;
  invitationPopup?.classList.remove('is-visible', 'is-breaking', 'is-open', 'is-letter-visible');
  invitationPopup?.setAttribute('aria-hidden', 'true');
  openInvitationButton?.removeAttribute('disabled');
  document.body.classList.remove('invitation-modal-open');
}

window.addEventListener('pageshow', (event) => {
  lockPageToTopDuringLoad();
  resetInvitationPopup();

  if (event.persisted && !document.querySelector('#intro-screen')) {
    window.location.reload();
  }
});

function playCastleDoorSound() {
  window.clearTimeout(castleDoorSoundTimer);
  castleDoorSound.pause();
  castleDoorSound.currentTime = 0.35;
  castleDoorSound.play().catch(() => {});
  castleDoorSoundTimer = window.setTimeout(() => {
    castleDoorSound.pause();
  }, 4400);
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
  window.setTimeout(() => introScreen?.remove(), 250);
}

function openKingdom() {
  if (document.body.classList.contains('gates-opening')) return;
  createOpeningTextPanels();
  playCastleDoorSound();
  document.body.classList.add('gates-opening');
  openKingdomButton?.setAttribute('disabled', '');
  window.setTimeout(revealSite, 4000);
}

function showInvitationPopup() {
  if (!invitationPopup || invitationWasShown) return;
  invitationWasShown = true;
  invitationPopup.classList.remove('is-breaking', 'is-open', 'is-letter-visible');
  openInvitationButton?.removeAttribute('disabled');
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
  window.setTimeout(() => invitationPopup.classList.add('is-letter-visible'), reducedMotion ? 0 : 1450);
  window.setTimeout(() => closeInvitationButton?.focus(), reducedMotion ? 0 : 1750);
}

function closeInvitation() {
  if (!invitationPopup) return;
  invitationPopup.classList.remove('is-visible', 'is-breaking', 'is-open', 'is-letter-visible');
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

  if (invitationCode === 'ADMIN!!!') {
    window.location.href = 'invitation.html?code=DEMO&admin=1';
    return;
  }

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
