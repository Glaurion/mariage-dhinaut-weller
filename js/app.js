const introScreen = document.querySelector('#intro-screen');
const revealElements = document.querySelectorAll('.reveal');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function revealSite() {
  document.body.classList.remove('intro-active');
  document.body.classList.add('intro-complete');
  window.setTimeout(() => introScreen?.remove(), reducedMotion ? 50 : 1200);
}

window.setTimeout(revealSite, reducedMotion ? 500 : 3000);

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -40px' }
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}
