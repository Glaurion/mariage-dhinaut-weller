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
const feedbackElement = document.querySelector('#form-feedback');
const invitationShell = document.querySelector('.invitation-shell');
const summaryDialog = document.querySelector('#rsvp-summary');
const summaryList = document.querySelector('#summary-list');
const confirmRsvpButton = document.querySelector('#confirm-rsvp');
const ravenDispatch = document.querySelector('#raven-dispatch');
const dispatchSkipButton = document.querySelector('#dispatch-skip');
const dispatchCloseButton = document.querySelector('#dispatch-close');
const dispatchLetterHouse = document.querySelector('#dispatch-letter-house');
const dispatchConfirmationMessage = document.querySelector('#dispatch-confirmation-message');
const dispatchLiveStatus = document.querySelector('#dispatch-live-status');
const realmGatheringLink = document.querySelector('.dispatch-confirmation-actions a[href^="royaume.html"]');
const realmTheme = document.querySelector('#realm-theme');
const soundToggle = document.querySelector('#sound-toggle');

const params = new URLSearchParams(window.location.search);
const invitationCode = params.get('code')?.trim() ?? '';
const supabaseConfig = window.SUPABASE_CONFIG ?? null;

let supabaseClient = null;
let currentInvitation = null;
let pendingPayload = null;
let dispatchConfirmationTimer = null;
let soundEnabled = localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off';

if (invitationCode) {
  sessionStorage.setItem('dhinaut-weller-invitation-code', invitationCode);
  if (realmGatheringLink) realmGatheringLink.href = `royaume.html?code=${encodeURIComponent(invitationCode)}`;
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
  realmTheme.volume = 0.11;
  const savedTime = Number(sessionStorage.getItem(MUSIC_TIME_KEY));
  if (Number.isFinite(savedTime) && savedTime > 0 && realmTheme.currentTime < 1) {
    realmTheme.currentTime = savedTime;
  }
  try {
    await realmTheme.play();
  } catch {
    document.addEventListener('pointerdown', startRealmMusic, { once: true });
  }
}

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
    feedbackElement.textContent = 'Votre réponse précédente a été retrouvée. Vous pouvez la modifier sans créer de doublon.';
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

async function submitRsvp() {
  if (!pendingPayload) return;
  const submitButton = rsvpForm.querySelector('button[type="submit"]');
  confirmRsvpButton.disabled = true;
  confirmRsvpButton.textContent = 'Le sceau est apposé…';

  try {
    if (currentInvitation?.is_demo) {
      currentInvitation.response = pendingPayload;
      feedbackElement.textContent = 'Aperçu validé : lancement du messager royal.';
      summaryDialog.close();
      playRavenDispatch(true);
      return;
    }

    let result = await supabaseClient.rpc('submit_rsvp', {
      p_code: invitationCode,
      p_payload: pendingPayload
    });
    if (result.error?.code === 'PGRST202' || result.error?.message?.includes('p_payload')) {
      result = await supabaseClient.rpc('submit_rsvp', {
        p_code: invitationCode,
        p_status: pendingPayload.status === 'uncertain' ? 'absent' : pendingPayload.status,
        p_dietary_notes: [pendingPayload.dietary_preferences, pendingPayload.allergies].filter(Boolean).join(' · '),
        p_message: pendingPayload.message
      });
    }
    if (result.error) throw result.error;
    currentInvitation.response = { ...pendingPayload, ...(result.data?.response ?? {}) };
    feedbackElement.textContent = 'Votre réponse a bien été transmise au Conseil Restreint.';
    summaryDialog.close();
    playRavenDispatch();
  } catch (error) {
    console.error('Impossible d’enregistrer la réponse :', error);
    summaryDialog.close();
    feedbackElement.textContent = 'Le corbeau n’a pas pu partir. Réessayez dans quelques instants.';
  } finally {
    pendingPayload = null;
    confirmRsvpButton.disabled = false;
    confirmRsvpButton.textContent = 'Sceller définitivement';
    submitButton.disabled = false;
  }
}

confirmRsvpButton?.addEventListener('click', submitRsvp);
summaryDialog?.addEventListener('close', () => {
  if (summaryDialog.returnValue === 'cancel') pendingPayload = null;
});

function revealDispatchConfirmation() {
  if (!ravenDispatch || ravenDispatch.classList.contains('is-confirmed')) return;
  window.clearTimeout(dispatchConfirmationTimer);
  ravenDispatch.classList.add('is-confirmed');
  dispatchSkipButton?.setAttribute('disabled', '');
  if (dispatchLiveStatus) dispatchLiveStatus.textContent = 'Votre réponse a été scellée. Le corbeau est arrivé au château.';
  window.setTimeout(() => dispatchCloseButton?.focus({ preventScroll: true }), 850);
}

function playRavenDispatch(isDemo = false) {
  if (!ravenDispatch) return;
  const householdName = currentInvitation?.household_name ?? 'Votre Maison';
  if (dispatchLetterHouse) dispatchLetterHouse.textContent = householdName;
  if (dispatchConfirmationMessage) {
    dispatchConfirmationMessage.textContent = isDemo
      ? `L’aperçu de la réponse de ${householdName} est terminé. En conditions réelles, le message serait enregistré au château.`
      : `La réponse de ${householdName} a bien été scellée et confiée aux corbeaux. Elle est arrivée au château d’Annaël et Benjamin.`;
  }

  window.clearTimeout(dispatchConfirmationTimer);
  ravenDispatch.classList.remove('is-running', 'is-confirmed', 'is-closing');
  ravenDispatch.hidden = false;
  ravenDispatch.setAttribute('aria-hidden', 'false');
  dispatchSkipButton?.removeAttribute('disabled');
  if (dispatchLiveStatus) dispatchLiveStatus.textContent = '';
  document.body.classList.add('dispatch-open');
  if (invitationShell) invitationShell.inert = true;
  void ravenDispatch.offsetWidth;
  ravenDispatch.classList.add('is-running');
  dispatchSkipButton?.focus({ preventScroll: true });
  dispatchConfirmationTimer = window.setTimeout(revealDispatchConfirmation, 8200);
}

function closeRavenDispatch() {
  if (!ravenDispatch || ravenDispatch.hidden) return;
  window.clearTimeout(dispatchConfirmationTimer);
  ravenDispatch.classList.add('is-closing');
  window.setTimeout(() => {
    ravenDispatch.classList.remove('is-running', 'is-confirmed', 'is-closing');
    ravenDispatch.setAttribute('aria-hidden', 'true');
    ravenDispatch.hidden = true;
    document.body.classList.remove('dispatch-open');
    if (invitationShell) invitationShell.inert = false;
    rsvpForm?.querySelector('button[type="submit"]')?.focus({ preventScroll: true });
  }, 360);
}

dispatchSkipButton?.addEventListener('click', revealDispatchConfirmation);
dispatchCloseButton?.addEventListener('click', closeRavenDispatch);

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || ravenDispatch?.hidden) return;
  if (ravenDispatch.classList.contains('is-confirmed')) closeRavenDispatch();
  else revealDispatchConfirmation();
});

renderRoleOptions();
loadInvitation();
