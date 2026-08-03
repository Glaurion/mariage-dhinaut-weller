const SOUND_PREFERENCE_KEY = 'dhinaut-weller-sound';
const MUSIC_TIME_KEY = 'dhinaut-weller-music-time';
const MUSIC_HANDOFF_KEY = 'dhinaut-weller-music-handoff';

const params = new URLSearchParams(window.location.search);
const invitationCode = params.get('code')?.trim() || sessionStorage.getItem('dhinaut-weller-invitation-code') || '';
const reviewInvitationLink = document.querySelector('#review-invitation');
const gatheringStatus = document.querySelector('#gathering-status');
const participantList = document.querySelector('#participant-list');
const treasuryLink = document.querySelector('#treasury-link');
const realmTheme = document.querySelector('#realm-theme');
const soundToggle = document.querySelector('#sound-toggle');
const supabaseConfig = window.SUPABASE_CONFIG ?? null;

let soundEnabled = localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off';
let shouldResumeMusic = false;
let pageAudioActive = document.visibilityState !== 'hidden';
let musicPausedByInactivity = false;

try {
  shouldResumeMusic = sessionStorage.getItem(MUSIC_HANDOFF_KEY) === '1';
  sessionStorage.removeItem(MUSIC_HANDOFF_KEY);
  if (!shouldResumeMusic) sessionStorage.removeItem(MUSIC_TIME_KEY);
} catch {
  shouldResumeMusic = false;
}

if (reviewInvitationLink && invitationCode) {
  reviewInvitationLink.href = `invitation.html?code=${encodeURIComponent(invitationCode)}`;
}

function updateSoundButton() {
  soundToggle?.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle?.setAttribute('aria-label', soundEnabled ? 'Couper la musique' : 'Activer la musique');
  const label = soundToggle?.querySelector('.sound-toggle-label');
  if (label) label.textContent = soundEnabled ? 'Musique' : 'Muet';
}

async function startMusic() {
  if (!realmTheme || !soundEnabled) return;
  if (!pageAudioActive) {
    musicPausedByInactivity = true;
    return;
  }
  realmTheme.volume = 0.11;
  if (shouldResumeMusic) {
    const savedTime = Number(sessionStorage.getItem(MUSIC_TIME_KEY));
    if (Number.isFinite(savedTime) && savedTime > 0 && realmTheme.currentTime < 1) realmTheme.currentTime = savedTime;
    shouldResumeMusic = false;
  }
  try {
    await realmTheme.play();
  } catch {
    document.addEventListener('pointerdown', startMusic, { once: true });
  }
}

function setPageAudioActive(isActive) {
  const nextState = Boolean(isActive && !document.hidden);
  if (nextState === pageAudioActive) return;
  pageAudioActive = nextState;

  if (!pageAudioActive) {
    musicPausedByInactivity = Boolean(realmTheme && !realmTheme.paused);
    realmTheme?.pause();
    return;
  }

  if (soundEnabled && musicPausedByInactivity) startMusic();
  musicPausedByInactivity = false;
}

document.addEventListener('visibilitychange', () => {
  setPageAudioActive(!document.hidden && document.hasFocus());
});
window.addEventListener('blur', () => setPageAudioActive(false));
window.addEventListener('focus', () => setPageAudioActive(!document.hidden));

soundToggle?.addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_PREFERENCE_KEY, soundEnabled ? 'on' : 'off');
  updateSoundButton();
  if (soundEnabled) await startMusic();
  else realmTheme?.pause();
});

function saveMusicPosition() {
  if (realmTheme && Number.isFinite(realmTheme.currentTime)) sessionStorage.setItem(MUSIC_TIME_KEY, String(realmTheme.currentTime));
}

window.addEventListener('pagehide', saveMusicPosition);
window.setInterval(saveMusicPosition, 4000);
updateSoundButton();
startMusic();

function setText(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element && value) element.textContent = value;
}

function renderParticipants(participants = []) {
  participantList.replaceChildren();
  if (!participants.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Aucune Maison n’a encore choisi de rendre sa venue visible.';
    participantList.append(empty);
    return;
  }
  participants.forEach((name) => {
    const item = document.createElement('span');
    item.className = 'participant-name';
    item.textContent = name;
    participantList.append(item);
  });
}

function renderUpdates(updates = []) {
  if (!updates.length) return;
  const list = document.querySelector('#updates-list');
  list.replaceChildren();
  updates.forEach((update) => {
    const article = document.createElement('article');
    const time = document.createElement('time');
    time.dateTime = update.published_at ?? '';
    time.textContent = update.date_label ?? 'Annonce royale';
    const text = document.createElement('p');
    text.textContent = update.message;
    article.append(time, text);
    list.append(article);
  });
}

function renderSummary(data) {
  const content = data?.content ?? {};
  setText('venue-description', content.venue_description);
  setText('date-description', content.date_description);
  setText('transport-description', content.transport_description);
  setText('accommodation-description', content.accommodation_description);
  setText('treasury-description', content.treasury_description);
  renderParticipants(data?.participants ?? []);
  renderUpdates(data?.updates ?? []);

  if (content.treasury_url && treasuryLink) {
    treasuryLink.href = content.treasury_url;
    treasuryLink.textContent = 'Ouvrir la cagnotte';
    treasuryLink.classList.remove('is-disabled');
    treasuryLink.removeAttribute('aria-disabled');
    treasuryLink.target = '_blank';
    treasuryLink.rel = 'noreferrer';
  }

  gatheringStatus.textContent = data?.household_name
    ? `Bienvenue, ${data.household_name}. Ces archives sont réservées aux Maisons conviées.`
    : 'Ces informations sont réservées aux Maisons conviées.';
}

async function loadRealmSummary() {
  if (invitationCode.toUpperCase() === 'DEMO') {
    renderSummary({
      household_name: 'Maison de démonstration',
      participants: ['Annaël', 'Benjamin', 'Sansa', 'Lyanna']
    });
    return;
  }

  if (!invitationCode || !supabaseConfig?.url || !supabaseConfig?.anonKey) {
    gatheringStatus.textContent = 'Saisissez votre code depuis le coffre pour consulter les archives privées.';
    renderParticipants([]);
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
    const { data, error } = await supabase.rpc('get_realm_summary', { p_code: invitationCode });
    if (error) throw error;
    renderSummary(data);
  } catch (error) {
    console.error('Impossible de charger les archives privées :', error);
    gatheringStatus.textContent = 'Les corbeaux n’ont pas encore rapporté les dernières archives. Les informations générales restent disponibles.';
    renderParticipants([]);
  }
}

loadRealmSummary();
