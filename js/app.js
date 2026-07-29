const introScreen = document.querySelector('#intro-screen');
const openKingdomButton = document.querySelector('#open-kingdom');
const revealElements = document.querySelectorAll('.reveal');
const invitationTrigger = document.querySelector('#invitation');
const invitationPopup = document.querySelector('#invitation-popup');
const openInvitationButton = document.querySelector('#open-invitation');
const closeInvitationButton = document.querySelector('.invitation-popup-close');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let invitationWasShown = false;

function revealSite() {
  document.body.classList.remove('intro-active', 'gates-opening');
  document.body.classList.add('intro-complete');
  window.setTimeout(() => introScreen?.remove(), reducedMotion ? 50 : 250);
}

function openKingdom() {
  if (document.body.classList.contains('gates-opening')) return;
  document.body.classList.add('gates-opening');
  openKingdomButton?.setAttribute('disabled', '');
  window.setTimeout(revealSite, reducedMotion ? 100 : 1550);
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
  if (!invitationPopup) return;
  invitationPopup.classList.add('is-open');
  window.setTimeout(() => closeInvitationButton?.focus(), reducedMotion ? 0 : 900);
}

function closeInvitation() {
  if (!invitationPopup) return;
  invitationPopup.classList.remove('is-visible', 'is-open');
  invitationPopup.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('invitation-modal-open');
}

openKingdomButton?.addEventListener('click', openKingdom);
openInvitationButton?.addEventListener('click', openInvitation);
closeInvitationButton?.addEventListener('click', closeInvitation);

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
