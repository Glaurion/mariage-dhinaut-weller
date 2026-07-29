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
window.addEventListener('pageshow', lockPageToTopDuringLoad);

const loadingState = document.querySelector('#invitation-loading');
const errorState = document.querySelector('#invitation-error');
const contentState = document.querySelector('#invitation-content');
const houseNameElement = document.querySelector('#house-name');
const guestListElement = document.querySelector('#guest-list');
const rsvpForm = document.querySelector('#rsvp-form');
const feedbackElement = document.querySelector('#form-feedback');

const params = new URLSearchParams(window.location.search);
const invitationCode = params.get('code')?.trim() ?? '';

// Cette configuration sera ajoutée lorsque le projet Supabase du mariage sera créé.
// Exemple attendu :
// window.SUPABASE_CONFIG = { url: 'https://xxx.supabase.co', anonKey: '...' };
const supabaseConfig = window.SUPABASE_CONFIG ?? null;
let supabaseClient = null;
let currentInvitation = null;

function showState(state) {
  loadingState?.classList.toggle('hidden', state !== 'loading');
  errorState?.classList.toggle('hidden', state !== 'error');
  contentState?.classList.toggle('hidden', state !== 'content');
}

function renderInvitation(invitation) {
  currentInvitation = invitation;
  houseNameElement.textContent = invitation.household_name;
  guestListElement.replaceChildren();

  invitation.members.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'guest-person';

    const name = document.createElement('strong');
    name.textContent = `${member.first_name} ${member.last_name}`.trim();

    const type = document.createElement('small');
    type.textContent = member.is_child ? 'Jeune membre de la Maison' : 'Membre de la Maison';

    row.append(name, type);
    guestListElement.append(row);
  });

  if (invitation.response) {
    const attendanceInput = rsvpForm.querySelector(
      `input[name="attendance"][value="${invitation.response.status}"]`
    );
    if (attendanceInput) attendanceInput.checked = true;

    rsvpForm.elements.dietary_notes.value = invitation.response.dietary_notes ?? '';
    rsvpForm.elements.message.value = invitation.response.message ?? '';
    feedbackElement.textContent = 'Votre réponse précédente a été retrouvée. Vous pouvez la modifier.';
  }

  showState('content');
}

function renderDemo() {
  renderInvitation({
    household_name: 'Maison de démonstration',
    members: [
      { first_name: 'Sansa', last_name: 'Exemple', is_child: false },
      { first_name: 'Jon', last_name: 'Exemple', is_child: false }
    ],
    response: null,
    is_demo: true
  });

  feedbackElement.textContent = 'Mode aperçu : aucune réponse ne sera enregistrée.';
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

    const { data, error } = await supabaseClient.rpc('get_invitation_by_code', {
      p_code: invitationCode
    });

    if (error || !data) throw error ?? new Error('Invitation introuvable');
    renderInvitation(data);
  } catch (error) {
    console.error('Impossible de charger l’invitation :', error);
    showState('error');
  }
}

rsvpForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  feedbackElement.textContent = '';

  const formData = new FormData(rsvpForm);
  const status = formData.get('attendance');

  if (!status) {
    feedbackElement.textContent = 'Choisissez d’abord votre réponse.';
    return;
  }

  if (currentInvitation?.is_demo) {
    feedbackElement.textContent = 'Aperçu validé : le véritable formulaire enregistrera la réponse dans Supabase.';
    return;
  }

  const submitButton = rsvpForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Le sceau est apposé…';

  try {
    const { error } = await supabaseClient.rpc('submit_rsvp', {
      p_code: invitationCode,
      p_status: status,
      p_dietary_notes: String(formData.get('dietary_notes') ?? ''),
      p_message: String(formData.get('message') ?? '')
    });

    if (error) throw error;
    feedbackElement.textContent = 'Votre réponse a bien été transmise au Conseil Restreint.';
  } catch (error) {
    console.error('Impossible d’enregistrer la réponse :', error);
    feedbackElement.textContent = 'Le corbeau n’a pas pu partir. Réessayez dans quelques instants.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Sceller notre réponse';
  }
});

loadInvitation();
