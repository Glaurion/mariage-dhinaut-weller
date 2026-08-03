if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

const ROLE_OPTIONS = [
  ['barman', 'Barman'],
  ['animateur', 'Animateur'],
  ['dj', 'DJ'],
  ['photographe', 'Photographe amateur'],
  ['jeux', 'Responsable des jeux'],
  ['ceremonie', 'Maître de cérémonie'],
  ['decoration', 'Aide à la décoration'],
  ['installation', 'Aide à l’installation'],
  ['rangement', 'Aide au rangement'],
  ['conducteur', 'Conducteur'],
  ['accueil', 'Accueil des invités'],
  ['enfants', 'Responsable des enfants']
];

const SOUND_PREFERENCE_KEY = 'dhinaut-weller-sound';
const MUSIC_TIME_KEY = 'dhinaut-weller-music-time';
const MUSIC_HANDOFF_KEY = 'dhinaut-weller-music-handoff';

const loadingState = document.querySelector('#invitation-loading');
const errorState = document.querySelector('#invitation-error');
const contentState = document.querySelector('#invitation-content');
const houseNameElement = document.querySelector('#house-name');
const assignedHouseElement = document.querySelector('#assigned-house');
const guestOriginElement = document.querySelector('#guest-origin');
const maximumGuestsElement = document.querySelector('#maximum-guests');
const personalMessageElement = document.querySelector('#personal-message');
const guestListElement = document.querySelector('#guest-list');
const memberChoiceList = document.querySelector('#member-choice-list');
const attendingMembersFieldset = document.querySelector('#attending-members-fieldset');
const roleGrid = document.querySelector('#role-grid');
const rsvpForm = document.querySelector('#rsvp-form');
const rsvpSubmitButton = rsvpForm?.querySelector('button[type="submit"]');
const feedbackElement = document.querySelector('#form-feedback');
const summaryDialog = document.querySelector('#rsvp-summary');
const summaryForm = summaryDialog?.querySelector('.summary-parchment');
const summaryList = document.querySelector('#summary-list');
const confirmRsvpButton = document.querySelector('#confirm-rsvp');
const rsvpConfirmation = document.querySelector('#rsvp-confirmation');
const confirmationSealHalo = document.querySelector('.royal-seal-impact-halo');
const fallingFeather = document.querySelector('.falling-feather');
const openRealmSummaryButton = document.querySelector('#open-realm-summary');
const realmTheme = document.querySelector('#realm-theme');
const soundToggle = document.querySelector('#sound-toggle');

const params = new URLSearchParams(window.location.search);
const invitationCode = params.get('code')?.trim() ?? '';
const supabaseConfig = window.SUPABASE_CONFIG ?? null;

let supabaseClient = null;
let currentInvitation = null;
let pendingPayload = null;
let soundEnabled = localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off';
let shouldResumeMusic = false;
let pageAudioActive = document.visibilityState !== 'hidden';
let musicPausedByInactivity = false;
let sealImpactAudioContext = null;

try {
  shouldResumeMusic = sessionStorage.getItem(MUSIC_HANDOFF_KEY) === '1';
  sessionStorage.removeItem(MUSIC_HANDOFF_KEY);
  if (!shouldResumeMusic) sessionStorage.removeItem(MUSIC_TIME_KEY);
} catch {
  shouldResumeMusic = false;
}

if (invitationCode) {
  sessionStorage.setItem('dhinaut-weller-invitation-code', invitationCode);
}

function scrollToPageTop() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

[0, 50, 150, 300].forEach((delay) => window.setTimeout(scrollToPageTop, delay));
window.addEventListener('pageshow', scrollToPageTop);

function showState(state) {
  loadingState?.classList.toggle('hidden', state !== 'loading');
  errorState?.classList.toggle('hidden', state !== 'error');
  contentState?.classList.toggle('hidden', state !== 'content');
}

function updateSoundButton() {
  if (!soundToggle) return;
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.setAttribute('aria-label', soundEnabled ? 'Couper la musique' : 'Activer la musique');
  soundToggle.classList.toggle('is-muted', !soundEnabled);
  const label = soundToggle.querySelector('.sound-toggle-label');
  if (label) label.textContent = soundEnabled ? 'Musique' : 'Muet';
}

async function startRealmMusic() {
  if (!realmTheme || !soundEnabled) return;
  if (!pageAudioActive) {
    musicPausedByInactivity = true;
    return;
  }
  realmTheme.volume = 0.11;
  if (shouldResumeMusic) {
    const savedTime = Number(sessionStorage.getItem(MUSIC_TIME_KEY));
    if (Number.isFinite(savedTime) && savedTime > 0 && realmTheme.currentTime < 1) {
      realmTheme.currentTime = savedTime;
    }
    shouldResumeMusic = false;
  }
  try {
    await realmTheme.play();
  } catch {
    document.addEventListener('pointerdown', startRealmMusic, { once: true });
  }
}

function ensureSealImpactAudioContext() {
  if (!soundEnabled || !pageAudioActive) return null;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;
  sealImpactAudioContext ??= new AudioContextClass();
  if (sealImpactAudioContext.state === 'suspended') {
    sealImpactAudioContext.resume().catch(() => {});
  }
  return sealImpactAudioContext;
}

function playRoyalSealImpact() {
  const context = ensureSealImpactAudioContext();
  if (!context || !soundEnabled || !pageAudioActive) return;

  const startedAt = context.currentTime;
  const impact = context.createOscillator();
  const impactFilter = context.createBiquadFilter();
  const impactGain = context.createGain();
  const wax = context.createBufferSource();
  const waxFilter = context.createBiquadFilter();
  const waxGain = context.createGain();
  const waxDuration = .16;
  const waxBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * waxDuration), context.sampleRate);
  const waxData = waxBuffer.getChannelData(0);

  for (let index = 0; index < waxData.length; index += 1) {
    const fade = 1 - (index / waxData.length);
    waxData[index] = (Math.random() * 2 - 1) * fade;
  }

  impact.type = 'triangle';
  impact.frequency.setValueAtTime(118, startedAt);
  impact.frequency.exponentialRampToValueAtTime(64, startedAt + .2);
  impactFilter.type = 'lowpass';
  impactFilter.frequency.value = 430;
  impactGain.gain.setValueAtTime(.0001, startedAt);
  impactGain.gain.exponentialRampToValueAtTime(.022, startedAt + .014);
  impactGain.gain.exponentialRampToValueAtTime(.0001, startedAt + .24);

  wax.buffer = waxBuffer;
  waxFilter.type = 'bandpass';
  waxFilter.frequency.value = 720;
  waxFilter.Q.value = .8;
  waxGain.gain.setValueAtTime(.0001, startedAt);
  waxGain.gain.exponentialRampToValueAtTime(.006, startedAt + .012);
  waxGain.gain.exponentialRampToValueAtTime(.0001, startedAt + waxDuration);

  impact.connect(impactFilter).connect(impactGain).connect(context.destination);
  wax.connect(waxFilter).connect(waxGain).connect(context.destination);
  impact.start(startedAt);
  impact.stop(startedAt + .25);
  wax.start(startedAt);
  wax.stop(startedAt + waxDuration);
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

  if (soundEnabled && musicPausedByInactivity) startRealmMusic();
  musicPausedByInactivity = false;
}

document.addEventListener('visibilitychange', () => {
  setPageAudioActive(!document.hidden && document.hasFocus());
});
window.addEventListener('blur', () => setPageAudioActive(false));
window.addEventListener('focus', () => setPageAudioActive(!document.hidden));

function saveMusicPosition() {
  if (realmTheme && Number.isFinite(realmTheme.currentTime)) {
    sessionStorage.setItem(MUSIC_TIME_KEY, String(realmTheme.currentTime));
  }
}

soundToggle?.addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_PREFERENCE_KEY, soundEnabled ? 'on' : 'off');
  updateSoundButton();
  if (soundEnabled) {
    await startRealmMusic();
  } else {
    realmTheme?.pause();
  }
});

window.addEventListener('pagehide', saveMusicPosition);
window.setInterval(saveMusicPosition, 4000);
updateSoundButton();
startRealmMusic();

function createDeviceFingerprint() {
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

function renderRoleOptions() {
  if (!roleGrid) return;
  roleGrid.replaceChildren();
  ROLE_OPTIONS.forEach(([value, label]) => {
    const option = document.createElement('label');
    option.className = 'role-choice';
    option.innerHTML = `<input type="checkbox" name="roles" value="${value}"><span>${label}</span>`;
    roleGrid.append(option);
  });
}

function getResponseValue(response, modernKey, legacyKey = modernKey) {
  return response?.[modernKey] ?? response?.[legacyKey] ?? '';
}

function setFieldValue(name, value) {
  const field = rsvpForm?.elements.namedItem(name);
  if (!field || value === null || value === undefined) return;
  if (field instanceof RadioNodeList) return;
  if (field.type === 'checkbox') {
    field.checked = Boolean(value);
  } else {
    field.value = String(value);
  }
}

function renderMembers(invitation) {
  guestListElement?.replaceChildren();
  memberChoiceList?.replaceChildren();
  const selectedIds = new Set(invitation.response?.attending_guest_ids ?? []);
  const hasSavedSelection = selectedIds.size > 0;

  invitation.members.forEach((member, index) => {
    const memberId = member.id ?? `demo-${index}`;
    const fullName = `${member.first_name} ${member.last_name}`.trim();

    const row = document.createElement('div');
    row.className = 'guest-person';
    row.innerHTML = `<strong>${escapeHtml(fullName)}</strong><small>${member.is_child ? 'Jeune membre de la Maison' : 'Membre de la Maison'}</small>`;
    guestListElement?.append(row);

    const choice = document.createElement('label');
    choice.className = 'member-choice';
    const checked = hasSavedSelection ? selectedIds.has(memberId) : member.is_invited !== false;
    choice.innerHTML = `<input type="checkbox" name="attending_members" value="${escapeHtml(memberId)}" data-child="${member.is_child ? 'true' : 'false'}" ${checked ? 'checked' : ''}><span><strong>${escapeHtml(fullName)}</strong><small>${member.is_child ? 'Enfant' : 'Adulte'}</small></span>`;
    memberChoiceList?.append(choice);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderInvitation(invitation) {
  currentInvitation = invitation;
  const members = Array.isArray(invitation.members) ? invitation.members : [];
  currentInvitation.members = members;

  houseNameElement.textContent = invitation.household_name ?? 'Maison invitée';
  assignedHouseElement.textContent = invitation.house ?? 'Royaume uni';
  guestOriginElement.textContent = invitation.provenance ?? 'Terres inconnues';
  const maximumGuests = Number(invitation.maximum_guests || members.length || 1);
  maximumGuestsElement.textContent = `${maximumGuests} ${maximumGuests > 1 ? 'personnes' : 'personne'}`;
  if (invitation.personalised_text) personalMessageElement.textContent = invitation.personalised_text;
  const uncertainChoice = rsvpForm.querySelector('input[name="attendance"][value="uncertain"]')?.closest('.choice-card');
  uncertainChoice?.classList.toggle('hidden', invitation.allow_uncertain === false);

  renderMembers(invitation);
  const response = invitation.response;
  if (response) {
    const attendanceInput = rsvpForm.querySelector(`input[name="attendance"][value="${response.status}"]`);
    if (attendanceInput) attendanceInput.checked = true;
    setFieldValue('email', getResponseValue(response, 'contact_email', 'email') || invitation.email);
    setFieldValue('phone', getResponseValue(response, 'contact_phone', 'phone') || invitation.phone);
    setFieldValue('dietary_preferences', getResponseValue(response, 'dietary_preferences', 'dietary_notes'));
    setFieldValue('allergies', response.allergies);
    setFieldValue('special_needs', response.special_needs);
    setFieldValue('accommodation_needs', response.accommodation_needs || 'none');
    setFieldValue('transport_needs', response.transport_needs || 'none');
    setFieldValue('ceremony_attendance', response.ceremony_attendance || 'unknown');
    setFieldValue('meal_attendance', response.meal_attendance || 'unknown');
    setFieldValue('brunch_attendance', response.brunch_attendance || 'unknown');
    setFieldValue('message', response.message);
    setFieldValue('display_name_consent', response.display_name_consent);
    setFieldValue('other_role', response.other_role);
    const savedRoles = new Set(response.role_preferences?.map((role) => role.role ?? role) ?? []);
    rsvpForm.querySelectorAll('input[name="roles"]').forEach((input) => {
      input.checked = savedRoles.has(input.value);
    });
    feedbackElement.textContent = 'Votre réponse est déjà consignée dans les archives royales. Vous pouvez la modifier sans créer de doublon.';
  } else {
    setFieldValue('email', invitation.email);
    setFieldValue('phone', invitation.phone);
  }

  updateAttendanceDetails();
  showState('content');
}

function renderDemo() {
  renderInvitation({
    household_name: 'Maison de démonstration',
    house: 'Maison du Nord et des Dragons',
    provenance: 'Strasbourg',
    maximum_guests: 2,
    email: 'demo@royaume.fr',
    personalised_text: 'Annaël et Benjamin ont l’honneur de vous convier à célébrer l’union de leurs deux Maisons. Que les portes du royaume s’ouvrent pour vous.',
    members: [
      { id: 'demo-sansa', first_name: 'Sansa', last_name: 'Exemple', is_child: false, is_invited: true },
      { id: 'demo-lyanna', first_name: 'Lyanna', last_name: 'Exemple', is_child: false, is_invited: true }
    ],
    response: null,
    is_demo: true
  });
  feedbackElement.textContent = 'Mode aperçu : la réponse sera simulée sans modifier la base.';
}

async function initialiseSupabase() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);
}

async function loadInvitation() {
  if (invitationCode.toUpperCase() === 'DEMO') {
    renderDemo();
    return;
  }
  if (!invitationCode || !supabaseConfig?.url || !supabaseConfig?.anonKey) {
    showState('error');
    return;
  }

  try {
    await initialiseSupabase();
    let result = await supabaseClient.rpc('get_invitation_by_code', {
      p_code: invitationCode,
      p_fingerprint: createDeviceFingerprint()
    });
    if (result.error?.code === 'PGRST202' || result.error?.message?.includes('p_fingerprint')) {
      result = await supabaseClient.rpc('get_invitation_by_code', { p_code: invitationCode });
    }
    if (result.error || !result.data) throw result.error ?? new Error('Invitation introuvable');
    renderInvitation(result.data);
  } catch (error) {
    console.error('Impossible de charger l’invitation :', error);
    showState('error');
  }
}

function selectedAttendance() {
  return rsvpForm.querySelector('input[name="attendance"]:checked')?.value ?? '';
}

function updateAttendanceDetails() {
  const status = selectedAttendance();
  const isAbsent = status === 'absent';
  document.querySelectorAll('.attendance-details').forEach((section) => {
    section.classList.toggle('is-unavailable', isAbsent);
    section.querySelectorAll('input, select, textarea').forEach((field) => {
      field.disabled = isAbsent;
    });
  });
  if (attendingMembersFieldset) {
    attendingMembersFieldset.disabled = isAbsent;
    attendingMembersFieldset.classList.toggle('is-unavailable', isAbsent);
  }
}

rsvpForm?.addEventListener('change', (event) => {
  if (event.target.name === 'attendance') updateAttendanceDetails();
});

function collectPayload() {
  const formData = new FormData(rsvpForm);
  const status = String(formData.get('attendance') ?? '');
  const memberInputs = [...rsvpForm.querySelectorAll('input[name="attending_members"]:checked')];
  const membersById = new Map(currentInvitation.members.map((member, index) => [String(member.id ?? `demo-${index}`), member]));
  const selectedMembers = memberInputs.map((input) => membersById.get(input.value)).filter(Boolean);
  const maximumGuests = Number(currentInvitation.maximum_guests || currentInvitation.members.length || 1);

  if (!status) throw new Error('Choisissez d’abord votre réponse au royaume.');
  if (status !== 'absent' && selectedMembers.length === 0) throw new Error('Sélectionnez au moins une personne présente.');
  if (selectedMembers.length > maximumGuests) throw new Error(`Votre invitation permet au maximum ${maximumGuests} personne${maximumGuests > 1 ? 's' : ''}.`);

  const attendingGuestIds = status === 'absent' ? [] : memberInputs.map((input) => input.value);
  const adultsCount = status === 'absent' ? 0 : selectedMembers.filter((member) => !member.is_child).length;
  const childrenCount = status === 'absent' ? 0 : selectedMembers.filter((member) => member.is_child).length;

  return {
    status,
    attending_guest_ids: attendingGuestIds,
    participants_count: attendingGuestIds.length,
    adults_count: adultsCount,
    children_count: childrenCount,
    contact_email: String(formData.get('email') ?? '').trim(),
    contact_phone: String(formData.get('phone') ?? '').trim(),
    dietary_preferences: String(formData.get('dietary_preferences') ?? '').trim(),
    allergies: String(formData.get('allergies') ?? '').trim(),
    special_needs: String(formData.get('special_needs') ?? '').trim(),
    accommodation_needs: String(formData.get('accommodation_needs') ?? 'none'),
    transport_needs: String(formData.get('transport_needs') ?? 'none'),
    ceremony_attendance: String(formData.get('ceremony_attendance') ?? 'unknown'),
    meal_attendance: String(formData.get('meal_attendance') ?? 'unknown'),
    brunch_attendance: String(formData.get('brunch_attendance') ?? 'unknown'),
    message: String(formData.get('message') ?? '').trim(),
    display_name_consent: formData.get('display_name_consent') === 'true',
    role_preferences: formData.getAll('roles').map(String),
    other_role: String(formData.get('other_role') ?? '').trim()
  };
}

function labelForSelect(name, value) {
  const field = rsvpForm.elements.namedItem(name);
  return field?.querySelector(`option[value="${CSS.escape(value)}"]`)?.textContent ?? value;
}

function addSummaryRow(term, description) {
  const row = document.createElement('div');
  row.className = 'summary-row';
  const title = document.createElement('dt');
  title.textContent = term;
  const value = document.createElement('dd');
  value.textContent = description || 'Non renseigné';
  row.append(title, value);
  summaryList.append(row);
}

function openSummary(payload) {
  pendingPayload = payload;
  summaryList.replaceChildren();
  const statusLabels = { present: 'Présente', uncertain: 'Encore incertaine', absent: 'Absente' };
  const roleLabels = new Map(ROLE_OPTIONS);
  addSummaryRow('Réponse', statusLabels[payload.status]);
  addSummaryRow('Participants', `${payload.participants_count} personne${payload.participants_count > 1 ? 's' : ''} · ${payload.adults_count} adulte${payload.adults_count > 1 ? 's' : ''} · ${payload.children_count} enfant${payload.children_count > 1 ? 's' : ''}`);
  const selectedNames = currentInvitation.members
    .filter((member, index) => payload.attending_guest_ids.includes(String(member.id ?? `demo-${index}`)))
    .map((member) => `${member.first_name} ${member.last_name}`.trim());
  addSummaryRow('Membres', selectedNames.join(', '));
  addSummaryRow('Contact', [payload.contact_email, payload.contact_phone].filter(Boolean).join(' · '));
  if (payload.status !== 'absent') {
    addSummaryRow('Temps forts', `Cérémonie : ${labelForSelect('ceremony_attendance', payload.ceremony_attendance)} · Repas : ${labelForSelect('meal_attendance', payload.meal_attendance)} · Brunch : ${labelForSelect('brunch_attendance', payload.brunch_attendance)}`);
    addSummaryRow('Régime et allergies', [payload.dietary_preferences, payload.allergies].filter(Boolean).join(' · '));
    addSummaryRow('Voyage', `${labelForSelect('accommodation_needs', payload.accommodation_needs)} · ${labelForSelect('transport_needs', payload.transport_needs)}`);
    addSummaryRow('Missions souhaitées', [...payload.role_preferences.map((role) => roleLabels.get(role)), payload.other_role].filter(Boolean).join(', '));
  }
  addSummaryRow('Message', payload.message);
  summaryDialog.showModal();
  summaryDialog.scrollTop = 0;
  document.querySelector('#rsvp-summary-title')?.focus({ preventScroll: true });
}

rsvpForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  feedbackElement.textContent = '';
  try {
    openSummary(collectPayload());
  } catch (error) {
    feedbackElement.textContent = error.message;
    feedbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function waitForTransition(element, propertyName, fallbackDelay) {
  if (!element || prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.removeEventListener('transitionend', handleTransitionEnd);
      window.clearTimeout(fallbackTimer);
      resolve();
    };
    const handleTransitionEnd = (event) => {
      if (event.target === element && event.propertyName === propertyName) finish();
    };
    const fallbackTimer = window.setTimeout(finish, fallbackDelay);
    element.addEventListener('transitionend', handleTransitionEnd);
  });
}

function waitForAnimation(element, animationName, fallbackDelay) {
  if (!element || prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.removeEventListener('animationend', handleAnimationEnd);
      window.clearTimeout(fallbackTimer);
      resolve();
    };
    const handleAnimationEnd = (event) => {
      if (event.target === element && event.animationName === animationName) finish();
    };
    const fallbackTimer = window.setTimeout(finish, fallbackDelay);
    element.addEventListener('animationend', handleAnimationEnd);
  });
}

function setSubmittingState(isSubmitting, responseSaved = false) {
  confirmRsvpButton.disabled = isSubmitting;
  confirmRsvpButton.classList.toggle('is-submitting', isSubmitting);
  confirmRsvpButton.setAttribute('aria-busy', String(isSubmitting));
  confirmRsvpButton.textContent = isSubmitting ? 'Transmission de la missive…' : 'Sceller définitivement';
  summaryForm?.classList.toggle('is-submitting', isSubmitting);
  summaryForm?.setAttribute('aria-busy', String(isSubmitting));
  if (rsvpSubmitButton) rsvpSubmitButton.disabled = isSubmitting || responseSaved;
}

async function playRoyalSealConfirmation() {
  if (!rsvpForm || !rsvpConfirmation) return;

  rsvpForm.classList.add('is-submit-success');
  await waitForTransition(rsvpForm, 'opacity', 720);
  rsvpForm.hidden = true;
  rsvpForm.classList.remove('is-submit-success');

  rsvpConfirmation.hidden = false;
  rsvpConfirmation.classList.remove('is-confirmation-visible', 'is-seal-impact', 'is-animation-complete');
  void rsvpConfirmation.offsetWidth;

  let impactPlayed = false;
  const triggerImpact = () => {
    if (impactPlayed) return;
    impactPlayed = true;
    rsvpConfirmation.classList.add('is-seal-impact');
    playRoyalSealImpact();
  };

  if (prefersReducedMotion()) {
    triggerImpact();
  } else {
    const impactFallback = window.setTimeout(triggerImpact, 1350);
    confirmationSealHalo?.addEventListener('animationstart', () => {
      window.clearTimeout(impactFallback);
      triggerImpact();
    }, { once: true });
  }

  rsvpConfirmation.classList.add('is-confirmation-visible');
  rsvpConfirmation.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });

  await waitForAnimation(fallingFeather, 'royalFeatherFall', 3800);
  rsvpConfirmation.classList.add('is-animation-complete');
}

async function submitRsvp() {
  if (!pendingPayload || confirmRsvpButton.disabled) return;
  const submittedPayload = pendingPayload;
  ensureSealImpactAudioContext();
  setSubmittingState(true);

  try {
    if (currentInvitation?.is_demo) {
      currentInvitation.response = submittedPayload;
    } else {
      let result = await supabaseClient.rpc('submit_rsvp', {
        p_code: invitationCode,
        p_payload: submittedPayload
      });
      if (result.error?.code === 'PGRST202' || result.error?.message?.includes('p_payload')) {
        result = await supabaseClient.rpc('submit_rsvp', {
          p_code: invitationCode,
          p_status: submittedPayload.status === 'uncertain' ? 'absent' : submittedPayload.status,
          p_dietary_notes: [submittedPayload.dietary_preferences, submittedPayload.allergies].filter(Boolean).join(' · '),
          p_message: submittedPayload.message
        });
      }
      if (result.error) throw result.error;
      currentInvitation.response = { ...submittedPayload, ...(result.data?.response ?? {}) };
    }
  } catch (error) {
    console.error('Impossible d’enregistrer la réponse RSVP :', error);
    pendingPayload = null;
    summaryDialog.close();
    setSubmittingState(false);
    feedbackElement.textContent = 'La missive n’a pas pu être transmise. Veuillez tenter de nouveau.';
    feedbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  pendingPayload = null;
  summaryDialog.close();
  setSubmittingState(false, true);
  feedbackElement.textContent = '';
  await playRoyalSealConfirmation();
}

confirmRsvpButton?.addEventListener('click', submitRsvp);
summaryDialog?.addEventListener('cancel', (event) => {
  if (confirmRsvpButton?.disabled) event.preventDefault();
});
summaryDialog?.addEventListener('close', () => {
  if (summaryDialog.returnValue === 'cancel') pendingPayload = null;
});

openRealmSummaryButton?.addEventListener('click', () => {
  saveMusicPosition();
  sessionStorage.setItem(MUSIC_HANDOFF_KEY, '1');
  const recapUrl = invitationCode
    ? `royaume.html?code=${encodeURIComponent(invitationCode)}`
    : 'royaume.html';
  window.location.assign(recapUrl);
});

renderRoleOptions();
loadInvitation();
