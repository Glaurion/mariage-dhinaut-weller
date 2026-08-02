const ROLE_OPTIONS = [
  ['barman', 'Barman'], ['animateur', 'Animateur'], ['dj', 'DJ'],
  ['photographe', 'Photographe amateur'], ['jeux', 'Responsable des jeux'],
  ['ceremonie', 'Maître de cérémonie'], ['decoration', 'Décoration'],
  ['installation', 'Installation'], ['rangement', 'Rangement'],
  ['conducteur', 'Conducteur'], ['accueil', 'Accueil'], ['enfants', 'Enfants'],
  ['other', 'Autre mission']
];
const ROLE_LABELS = new Map(ROLE_OPTIONS);

const loginSection = document.querySelector('#admin-login');
const adminApp = document.querySelector('#admin-app');
const loginForm = document.querySelector('#login-form');
const loginFeedback = document.querySelector('#login-feedback');
const adminWelcome = document.querySelector('#admin-welcome');
const lastRefresh = document.querySelector('#last-refresh');
const guestTableBody = document.querySelector('#guest-table-body');
const registryFeedback = document.querySelector('#registry-feedback');
const searchInput = document.querySelector('#guest-search');
const houseFilter = document.querySelector('#house-filter');
const statusFilter = document.querySelector('#status-filter');
const roleDashboard = document.querySelector('#role-dashboard');
const contentForm = document.querySelector('#content-form');
const contentFeedback = document.querySelector('#content-feedback');
const importDialog = document.querySelector('#import-dialog');
const importFile = document.querySelector('#import-file');
const importSummary = document.querySelector('#import-summary');
const importPreviewHead = document.querySelector('#import-preview-head');
const importPreviewBody = document.querySelector('#import-preview-body');
const importFeedback = document.querySelector('#import-feedback');
const confirmImportButton = document.querySelector('#confirm-import');
const guestDialog = document.querySelector('#guest-dialog');
const guestDialogTitle = document.querySelector('#guest-dialog-title');
const guestDetail = document.querySelector('#guest-detail');
const guestDialogFeedback = document.querySelector('#guest-dialog-feedback');
const currentAssignments = document.querySelector('#current-assignments');
const assignmentRole = document.querySelector('#assignment-role');
const assignmentNote = document.querySelector('#assignment-note');
const rsvpHistory = document.querySelector('#rsvp-history');
const codeDialog = document.querySelector('#code-dialog');
const generatedCodeOutput = document.querySelector('#generated-code');

const supabaseConfig = window.SUPABASE_CONFIG ?? null;
const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
let supabase = null;
let invitations = [];
let emailLogs = [];
let importRows = [];
let selectedInvitationId = null;
let lastGeneratedCode = '';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function responseFor(invitation) {
  return Array.isArray(invitation.rsvps) ? invitation.rsvps[0] ?? null : invitation.rsvps ?? null;
}

function statusFor(invitation) {
  return responseFor(invitation)?.status ?? 'waiting';
}

function statusLabel(status) {
  return { present: 'Présent', absent: 'Absent', uncertain: 'Incertain', waiting: 'En attente' }[status] ?? status;
}

function setMetric(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = String(value);
}

async function createSupabaseClient() {
  if (!supabaseConfig?.url || !supabaseConfig?.anonKey) throw new Error('Configuration Supabase manquante.');
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
}

async function verifyAdmin(session) {
  if (!session) return false;
  const { data, error } = await supabase.rpc('is_wedding_admin');
  if (error) throw error;
  return data === true;
}

function showLogin(message = '') {
  loginSection.classList.remove('hidden');
  adminApp.classList.add('hidden');
  loginFeedback.textContent = message;
}

async function showAdmin(session) {
  loginSection.classList.add('hidden');
  adminApp.classList.remove('hidden');
  adminWelcome.textContent = `Compte autorisé : ${session.user.email ?? 'administrateur'}`;
  await loadAllData();
}

async function initialiseAdmin() {
  if (demoMode) {
    showDemoAdmin();
    return;
  }
  try {
    await createSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showLogin();
      return;
    }
    if (!(await verifyAdmin(session))) {
      await supabase.auth.signOut();
      showLogin('Ce compte ne siège pas au Conseil Restreint.');
      return;
    }
    await showAdmin(session);
  } catch (error) {
    console.error(error);
    showLogin('Le registre Supabase est indisponible ou le nouveau schéma n’est pas encore installé.');
  }
}

function showDemoAdmin() {
  const now = new Date().toISOString();
  invitations = [
    {
      id: 'demo-1', household_name: 'Maison Stark', house: 'loup', provenance: 'Strasbourg',
      email: 'sansa@example.com', phone: '', code_hint: 'SAN•••', maximum_guests: 2,
      invitation_status: 'answered', opened_at: now, created_at: now, updated_at: now,
      guests: [
        { id: 'g1', first_name: 'Sansa', last_name: 'Exemple', is_child: false, is_invited: true },
        { id: 'g2', first_name: 'Arya', last_name: 'Exemple', is_child: false, is_invited: true }
      ],
      rsvps: [{ id: 'r1', status: 'present', participants_count: 2, adults_count: 2, children_count: 0, contact_email: 'sansa@example.com', dietary_preferences: 'Végétarien', allergies: '', accommodation_needs: 'information', transport_needs: 'carpool', last_submitted_at: now, message: 'Nous serons là.' }],
      role_preferences: [{ role: 'decoration', details: '' }, { role: 'accueil', details: '' }],
      role_assignments: [{ id: 'a1', role: 'decoration', note: '', assigned_at: now }]
    },
    {
      id: 'demo-2', household_name: 'Maison Targaryen', house: 'dragon', provenance: 'Colmar',
      email: 'daenerys@example.com', phone: '', code_hint: 'DAE•••', maximum_guests: 3,
      invitation_status: 'opened', opened_at: now, created_at: now, updated_at: now,
      guests: [
        { id: 'g3', first_name: 'Daenerys', last_name: 'Exemple', is_child: false, is_invited: true },
        { id: 'g4', first_name: 'Rhaella', last_name: 'Exemple', is_child: true, is_invited: true }
      ],
      rsvps: [{ id: 'r2', status: 'uncertain', participants_count: 2, adults_count: 1, children_count: 1, contact_email: 'daenerys@example.com', dietary_preferences: '', allergies: 'Fruits à coque', accommodation_needs: 'needed', transport_needs: 'none', last_submitted_at: now, message: '' }],
      role_preferences: [{ role: 'jeux', details: '' }], role_assignments: []
    },
    {
      id: 'demo-3', household_name: 'Maison Tyrell', house: 'royaume', provenance: 'Nancy',
      email: 'margaery@example.com', phone: '', code_hint: 'MAR•••', maximum_guests: 2,
      invitation_status: 'sent', opened_at: null, created_at: now, updated_at: now,
      guests: [{ id: 'g5', first_name: 'Margaery', last_name: 'Exemple', is_child: false, is_invited: true }],
      rsvps: [], role_preferences: [], role_assignments: []
    }
  ];
  emailLogs = [
    { status: 'sent' }, { status: 'sent' }, { status: 'pending' }
  ];
  loginSection.classList.add('hidden');
  adminApp.classList.remove('hidden');
  document.body.classList.add('admin-demo-mode');
  adminWelcome.textContent = 'Mode aperçu sécurisé : uniquement des personnages fictifs, aucune donnée Supabase.';
  renderDashboard();
  renderRegistry();
  renderRoles();
  renderContent([]);
  lastRefresh.textContent = 'Aperçu local du Conseil Restreint.';
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginFeedback.textContent = 'Vérification du sceau…';
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    if (!supabase) await createSupabaseClient();
    const formData = new FormData(loginForm);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? '')
    });
    if (error) throw error;
    if (!(await verifyAdmin(data.session))) {
      await supabase.auth.signOut();
      throw new Error('Compte authentifié mais non autorisé comme administrateur.');
    }
    loginForm.reset();
    await showAdmin(data.session);
  } catch (error) {
    loginFeedback.textContent = error.message || 'Connexion refusée.';
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#sign-out')?.addEventListener('click', async () => {
  await supabase?.auth.signOut();
  invitations = [];
  showLogin('Vous avez quitté le Conseil Restreint.');
});

document.querySelector('#refresh-data')?.addEventListener('click', () => {
  if (demoMode) {
    lastRefresh.textContent = 'Aperçu actualisé — aucune donnée réelle n’est chargée.';
    return;
  }
  loadAllData();
});

async function loadAllData() {
  lastRefresh.textContent = 'Les corbeaux rassemblent les registres…';
  registryFeedback.textContent = '';
  try {
    const [invitationsResult, emailResult, contentResult] = await Promise.all([
      supabase.from('invitations').select(`
        id, external_ref, household_name, house, provenance, address, email, phone,
        code_hint, maximum_guests, invitation_status, sent_at, opened_at, created_at, updated_at,
        guests(id, first_name, last_name, is_child, is_invited, sort_order),
        rsvps(id, status, participants_count, adults_count, children_count, contact_email,
          contact_phone, dietary_preferences, allergies, special_needs, accommodation_needs,
          transport_needs, message, display_name_consent, first_submitted_at, last_submitted_at),
        role_preferences(id, role, details),
        role_assignments(id, role, note, assigned_at)
      `).order('created_at', { ascending: false }),
      supabase.from('email_logs').select('id, invitation_id, recipient, email_type, status, requested_at, sent_at, error_message').order('requested_at', { ascending: false }).limit(500),
      supabase.from('wedding_content').select('content_key, content_type, content_value, is_published, sort_order')
    ]);
    if (invitationsResult.error) throw invitationsResult.error;
    if (emailResult.error) throw emailResult.error;
    if (contentResult.error) throw contentResult.error;
    invitations = invitationsResult.data ?? [];
    emailLogs = emailResult.data ?? [];
    renderDashboard();
    renderRegistry();
    renderRoles();
    renderContent(contentResult.data ?? []);
    lastRefresh.textContent = `Registres actualisés le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}.`;
  } catch (error) {
    console.error('Chargement administrateur impossible :', error);
    lastRefresh.textContent = 'Le registre n’a pas pu être chargé.';
    registryFeedback.textContent = 'Vérifiez que supabase/schema.sql a bien été exécuté et que votre compte figure dans admin_profiles.';
  }
}

function renderDashboard() {
  const guests = invitations.flatMap((invitation) => invitation.guests ?? []).filter((guest) => guest.is_invited !== false);
  const responses = invitations.map(responseFor).filter(Boolean);
  const presentResponses = responses.filter((response) => response.status === 'present');
  const absentResponses = responses.filter((response) => response.status === 'absent');
  const uncertainResponses = responses.filter((response) => response.status === 'uncertain');

  setMetric('metric-guests', guests.length);
  setMetric('metric-opened', invitations.filter((invitation) => invitation.opened_at).length);
  setMetric('metric-responses', responses.length);
  setMetric('metric-present', presentResponses.reduce((sum, response) => sum + (response.participants_count || 0), 0));
  setMetric('metric-absent', absentResponses.length);
  setMetric('metric-waiting', invitations.length - responses.length + uncertainResponses.length);
  setMetric('metric-adults', presentResponses.reduce((sum, response) => sum + (response.adults_count || 0), 0));
  setMetric('metric-children', presentResponses.reduce((sum, response) => sum + (response.children_count || 0), 0));

  const dietary = responses.flatMap((response) => [response.dietary_preferences, response.allergies]).filter(Boolean);
  document.querySelector('#dietary-insights').innerHTML = dietary.length
    ? dietary.slice(0, 8).map((item) => `<p>• ${escapeHtml(item)}</p>`).join('')
    : '<p>Aucune information.</p>';

  const accommodationCount = responses.filter((response) => response.accommodation_needs && response.accommodation_needs !== 'none').length;
  const transportCount = responses.filter((response) => response.transport_needs && response.transport_needs !== 'none').length;
  document.querySelector('#travel-insights').innerHTML = `<p>${accommodationCount} demande(s) d’hébergement</p><p>${transportCount} besoin(s) de transport</p>`;

  const emailCounts = emailLogs.reduce((counts, log) => {
    counts[log.status] = (counts[log.status] || 0) + 1;
    return counts;
  }, {});
  document.querySelector('#email-insights').innerHTML = `<p>${emailCounts.sent || 0} envoyé(s)</p><p>${emailCounts.pending || 0} en attente</p><p>${emailCounts.failed || 0} échec(s)</p>`;
}

function filteredInvitations() {
  const query = searchInput.value.trim().toLocaleLowerCase('fr');
  const house = houseFilter.value;
  const status = statusFilter.value;
  return invitations.filter((invitation) => {
    const haystack = [
      invitation.household_name, invitation.house, invitation.provenance, invitation.email, invitation.phone,
      ...(invitation.guests ?? []).flatMap((guest) => [guest.first_name, guest.last_name])
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr');
    return (!query || haystack.includes(query))
      && (!house || String(invitation.house).toLocaleLowerCase('fr').includes(house))
      && (!status || statusFor(invitation) === status);
  });
}

function renderRegistry() {
  const rows = filteredInvitations();
  guestTableBody.replaceChildren();
  if (!rows.length) {
    guestTableBody.innerHTML = '<tr><td colspan="7">Aucune Maison ne correspond à ces filtres.</td></tr>';
    return;
  }

  rows.forEach((invitation) => {
    const response = responseFor(invitation);
    const status = statusFor(invitation);
    const guests = (invitation.guests ?? []).map((guest) => `${guest.first_name} ${guest.last_name}`.trim()).join(', ');
    const contact = response?.contact_email || invitation.email || response?.contact_phone || invitation.phone || '—';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(invitation.household_name)}</strong><br><small>${escapeHtml(invitation.provenance || '—')}</small></td>
      <td>${escapeHtml(guests || 'Aucun membre')}</td>
      <td>${escapeHtml(contact)}</td>
      <td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></td>
      <td>${response ? `${response.participants_count || 0} / ${invitation.maximum_guests}` : `0 / ${invitation.maximum_guests}`}</td>
      <td>${escapeHtml(formatDate(response?.last_submitted_at))}</td>
      <td><button type="button" data-open-invitation="${invitation.id}">Ouvrir la fiche</button></td>`;
    guestTableBody.append(row);
  });
}

[searchInput, houseFilter, statusFilter].forEach((control) => control?.addEventListener('input', renderRegistry));

guestTableBody?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-invitation]');
  if (button) openGuestDialog(button.dataset.openInvitation);
});

function renderRoles() {
  const preferenceCounts = new Map();
  const assignmentCounts = new Map();
  invitations.forEach((invitation) => {
    (invitation.role_preferences ?? []).forEach((preference) => preferenceCounts.set(preference.role, (preferenceCounts.get(preference.role) || 0) + 1));
    (invitation.role_assignments ?? []).forEach((assignment) => assignmentCounts.set(assignment.role, (assignmentCounts.get(assignment.role) || 0) + 1));
  });
  roleDashboard.replaceChildren();
  ROLE_OPTIONS.forEach(([role, label]) => {
    const card = document.createElement('article');
    card.className = 'role-stat';
    card.innerHTML = `<strong>${preferenceCounts.get(role) || 0}</strong><span>${escapeHtml(label)} · ${assignmentCounts.get(role) || 0} attribuée(s)</span>`;
    roleDashboard.append(card);
  });
}

function renderContent(items) {
  const content = new Map(items.map((item) => [item.content_key, item.content_value]));
  [...contentForm.elements].forEach((field) => {
    if (field.name && content.has(field.name)) field.value = content.get(field.name) ?? '';
  });
}

contentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (demoMode) {
    contentFeedback.textContent = 'Aperçu validé. La publication réelle sera disponible après connexion Supabase.';
    return;
  }
  contentFeedback.textContent = 'Publication des annonces…';
  const formData = new FormData(contentForm);
  const rows = [...formData.entries()].map(([contentKey, value], index) => ({
    content_key: contentKey,
    content_type: contentKey === 'treasury_url' ? 'link' : 'information',
    content_value: String(value).trim(),
    is_published: true,
    sort_order: (index + 1) * 10
  }));
  const { error } = await supabase.from('wedding_content').upsert(rows, { onConflict: 'content_key' });
  contentFeedback.textContent = error ? `Publication impossible : ${error.message}` : 'Les nouvelles informations sont publiées.';
});

function normaliseColumnName(name) {
  return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function firstValue(row, aliases) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function mapImportRow(rawRow, index) {
  const row = Object.fromEntries(Object.entries(rawRow).map(([key, value]) => [normaliseColumnName(key), value]));
  const mapped = {
    line: index + 2,
    external_ref: String(firstValue(row, ['identifiant', 'id', 'reference', 'external_ref'])).trim(),
    first_name: String(firstValue(row, ['prenom', 'first_name'])).trim(),
    last_name: String(firstValue(row, ['nom', 'last_name'])).trim(),
    household_name: String(firstValue(row, ['foyer', 'maison_invitee', 'household_name'])).trim(),
    house: String(firstValue(row, ['cote', 'maison', 'house'])).trim().toLowerCase() || 'royaume',
    provenance: String(firstValue(row, ['provenance', 'ville'])).trim(),
    address: String(firstValue(row, ['adresse', 'address'])).trim(),
    email: String(firstValue(row, ['email', 'adresse_email', 'e_mail'])).trim(),
    phone: String(firstValue(row, ['telephone', 'phone', 'tel'])).trim(),
    maximum_guests: Number(firstValue(row, ['nombre_maximal_de_personnes', 'maximum_guests', 'places', 'accompagnant_autorise'])) || 1,
    is_child: ['oui', 'true', '1', 'enfant'].includes(String(firstValue(row, ['enfant', 'is_child'])).trim().toLowerCase()),
    personalised_text: String(firstValue(row, ['texte_personnalise', 'personalised_text'])).trim(),
    private_note: String(firstValue(row, ['note_privee', 'private_note'])).trim(),
    code: String(firstValue(row, ['code_personnel', 'code'])).trim()
  };
  mapped.errors = [];
  if (!mapped.first_name) mapped.errors.push('prénom manquant');
  if (!mapped.last_name) mapped.errors.push('nom manquant');
  if (mapped.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) mapped.errors.push('e-mail invalide');
  if (mapped.maximum_guests < 1 || mapped.maximum_guests > 20) mapped.errors.push('nombre de places invalide');
  return mapped;
}

async function parseImportFile(file) {
  if (!window.XLSX) throw new Error('Le lecteur Excel n’a pas pu être chargé. Réessayez avec une connexion active.');
  const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = window.XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  if (!rawRows.length) throw new Error('Le fichier ne contient aucune ligne exploitable.');
  importRows = rawRows.map(mapImportRow);
  const seen = new Set();
  importRows.forEach((row) => {
    const signature = `${row.external_ref}|${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}`;
    if (seen.has(signature)) row.errors.push('doublon dans le fichier');
    seen.add(signature);
  });
  renderImportPreview();
}

function renderImportPreview() {
  const validCount = importRows.filter((row) => !row.errors.length).length;
  const errorCount = importRows.length - validCount;
  importSummary.innerHTML = `<span>${importRows.length} ligne(s)</span><span>${validCount} valide(s)</span><span>${errorCount} en erreur</span>`;
  importPreviewHead.innerHTML = '<tr><th>Ligne</th><th>Prénom</th><th>Nom</th><th>Foyer</th><th>Maison</th><th>E-mail</th><th>État</th></tr>';
  importPreviewBody.innerHTML = importRows.map((row) => `
    <tr class="${row.errors.length ? 'has-error' : ''}">
      <td>${row.line}</td><td>${escapeHtml(row.first_name)}</td><td>${escapeHtml(row.last_name)}</td>
      <td>${escapeHtml(row.household_name || `Maison ${row.last_name}`)}</td><td>${escapeHtml(row.house)}</td>
      <td>${escapeHtml(row.email)}</td><td>${row.errors.length ? escapeHtml(row.errors.join(', ')) : 'Prête'}</td>
    </tr>`).join('');
  confirmImportButton.disabled = validCount === 0 || errorCount > 0;
}

document.querySelector('#open-import')?.addEventListener('click', () => {
  importRows = [];
  importFile.value = '';
  importSummary.textContent = '';
  importPreviewHead.textContent = '';
  importPreviewBody.textContent = '';
  importFeedback.textContent = '';
  confirmImportButton.disabled = true;
  importDialog.showModal();
});

importFile?.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  importFeedback.textContent = 'Lecture du registre…';
  try {
    await parseImportFile(file);
    importFeedback.textContent = 'Vérifiez l’aperçu avant de confirmer.';
  } catch (error) {
    importRows = [];
    confirmImportButton.disabled = true;
    importFeedback.textContent = error.message;
  }
});

confirmImportButton?.addEventListener('click', async () => {
  const validRows = importRows.filter((row) => !row.errors.length);
  if (demoMode) {
    importFeedback.textContent = `${validRows.length} ligne(s) sont prêtes. Connectez un compte administrateur réel pour les importer.`;
    return;
  }
  confirmImportButton.disabled = true;
  const generated = [];
  let failures = 0;
  for (let index = 0; index < validRows.length; index += 1) {
    const row = validRows[index];
    importFeedback.textContent = `Import ${index + 1} / ${validRows.length}…`;
    const { data, error } = await supabase.rpc('admin_import_invitation', { p_payload: row });
    if (error) {
      failures += 1;
      row.errors.push(error.message);
    } else if (data?.generated_code) {
      generated.push({
        prenom: row.first_name,
        nom: row.last_name,
        foyer: row.household_name || `Maison ${row.last_name}`,
        code: data.generated_code,
        lien: `${new URL('.', window.location.href).href}invitation.html?code=${encodeURIComponent(data.generated_code)}`
      });
    }
  }
  if (generated.length) downloadCsv(generated, 'codes-invitations-dhinaut-weller.csv');
  importFeedback.textContent = failures
    ? `${failures} ligne(s) ont échoué. Corrigez-les puis recommencez.`
    : `${validRows.length} ligne(s) importées. Le registre des codes a été téléchargé.`;
  if (!failures) {
    await loadAllData();
    window.setTimeout(() => importDialog.close(), 900);
  } else {
    renderImportPreview();
  }
});

function exportRows() {
  return filteredInvitations().map((invitation) => {
    const response = responseFor(invitation);
    return {
      foyer: invitation.household_name,
      maison: invitation.house,
      invites: (invitation.guests ?? []).map((guest) => `${guest.first_name} ${guest.last_name}`.trim()).join(' | '),
      provenance: invitation.provenance,
      email: response?.contact_email || invitation.email || '',
      telephone: response?.contact_phone || invitation.phone || '',
      statut: statusLabel(statusFor(invitation)),
      participants: response?.participants_count ?? 0,
      adultes: response?.adults_count ?? 0,
      enfants: response?.children_count ?? 0,
      regimes: response?.dietary_preferences ?? '',
      allergies: response?.allergies ?? '',
      hebergement: response?.accommodation_needs ?? '',
      transport: response?.transport_needs ?? '',
      roles_souhaites: (invitation.role_preferences ?? []).map((role) => ROLE_LABELS.get(role.role) || role.details || role.role).join(' | '),
      roles_attribues: (invitation.role_assignments ?? []).map((role) => ROLE_LABELS.get(role.role) || role.role).join(' | '),
      message: response?.message ?? '',
      derniere_reponse: response?.last_submitted_at ?? ''
    };
  });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = `\uFEFF${headers.map(csvCell).join(';')}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(';')).join('\n')}`;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelector('#export-csv')?.addEventListener('click', () => downloadCsv(exportRows(), 'reponses-mariage-dhinaut-weller.csv'));
document.querySelector('#export-xlsx')?.addEventListener('click', () => {
  const rows = exportRows();
  if (!rows.length || !window.XLSX) return;
  const workbook = window.XLSX.utils.book_new();
  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Réponses');
  window.XLSX.writeFile(workbook, 'reponses-mariage-dhinaut-weller.xlsx');
});
document.querySelector('#print-report')?.addEventListener('click', () => window.print());

function detailRow(term, value) {
  return `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`;
}

async function openGuestDialog(invitationId) {
  selectedInvitationId = invitationId;
  const invitation = invitations.find((item) => item.id === invitationId);
  if (!invitation) return;
  const response = responseFor(invitation);
  guestDialogTitle.textContent = invitation.household_name;
  guestDetail.innerHTML = `<dl class="guest-detail-grid">
    ${detailRow('Maison', invitation.house)}${detailRow('Provenance', invitation.provenance)}${detailRow('Code', invitation.code_hint)}
    ${detailRow('Membres', (invitation.guests ?? []).map((guest) => `${guest.first_name} ${guest.last_name}`).join(', '))}
    ${detailRow('Réponse', statusLabel(statusFor(invitation)))}${detailRow('Participants', response ? `${response.participants_count} / ${invitation.maximum_guests}` : `0 / ${invitation.maximum_guests}`)}
    ${detailRow('E-mail', response?.contact_email || invitation.email)}${detailRow('Téléphone', response?.contact_phone || invitation.phone)}${detailRow('Dernière réponse', formatDate(response?.last_submitted_at))}
    ${detailRow('Régime', response?.dietary_preferences)}${detailRow('Allergies', response?.allergies)}${detailRow('Besoins particuliers', response?.special_needs)}
    ${detailRow('Hébergement', response?.accommodation_needs)}${detailRow('Transport', response?.transport_needs)}${detailRow('Message', response?.message)}
  </dl>`;
  renderAssignments(invitation);
  guestDialogFeedback.textContent = '';
  guestDialog.showModal();
  await loadHistory(invitationId);
}

function renderAssignments(invitation) {
  currentAssignments.replaceChildren();
  const assignments = invitation.role_assignments ?? [];
  if (!assignments.length) {
    currentAssignments.innerHTML = '<p>Aucune mission attribuée.</p>';
    return;
  }
  assignments.forEach((assignment) => {
    const chip = document.createElement('span');
    chip.className = 'assignment-chip';
    chip.innerHTML = `${escapeHtml(ROLE_LABELS.get(assignment.role) || assignment.role)} <button type="button" data-remove-assignment="${assignment.id}" aria-label="Retirer cette mission">×</button>`;
    currentAssignments.append(chip);
  });
}

async function loadHistory(invitationId) {
  if (demoMode) {
    rsvpHistory.innerHTML = '<article class="history-item"><strong>Aujourd’hui</strong><br>Première validation de démonstration.</article>';
    return;
  }
  rsvpHistory.textContent = 'Chargement de l’historique…';
  const { data, error } = await supabase.from('rsvp_history').select('id, old_values, new_values, changed_at').eq('invitation_id', invitationId).order('changed_at', { ascending: false }).limit(30);
  if (error) {
    rsvpHistory.textContent = error.message;
    return;
  }
  if (!data.length) {
    rsvpHistory.textContent = 'Aucune modification enregistrée.';
    return;
  }
  rsvpHistory.innerHTML = data.map((entry) => {
    const oldValues = entry.old_values ?? {};
    const newValues = entry.new_values ?? {};
    const changed = Object.keys(newValues).filter((key) => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key]) && !['updated_at', 'last_submitted_at'].includes(key));
    return `<article class="history-item"><strong>${escapeHtml(formatDate(entry.changed_at))}</strong><br>${escapeHtml(changed.join(', ') || 'Première validation')}</article>`;
  }).join('');
}

document.querySelector('#close-guest-dialog')?.addEventListener('click', () => guestDialog.close());

document.querySelector('#reset-code')?.addEventListener('click', async () => {
  if (!selectedInvitationId || !window.confirm('L’ancien code cessera immédiatement de fonctionner. Continuer ?')) return;
  if (demoMode) {
    lastGeneratedCode = `DEMO${Math.floor(10 + Math.random() * 90)}`;
    generatedCodeOutput.textContent = lastGeneratedCode;
    guestDialog.close();
    codeDialog.showModal();
    return;
  }
  guestDialogFeedback.textContent = 'Forge du nouveau code…';
  const { data, error } = await supabase.rpc('admin_reset_invitation_code', { p_invitation_id: selectedInvitationId });
  if (error) {
    guestDialogFeedback.textContent = error.message;
    return;
  }
  lastGeneratedCode = data.generated_code;
  generatedCodeOutput.textContent = lastGeneratedCode;
  guestDialog.close();
  codeDialog.showModal();
  await loadAllData();
});

document.querySelector('#copy-code')?.addEventListener('click', async () => {
  const base = new URL('.', window.location.href).href;
  await navigator.clipboard.writeText(`${lastGeneratedCode}\n${base}invitation.html?code=${encodeURIComponent(lastGeneratedCode)}`);
  document.querySelector('#copy-code').textContent = 'Code et lien copiés';
});
document.querySelector('#close-code-dialog')?.addEventListener('click', () => codeDialog.close());

document.querySelector('#queue-email')?.addEventListener('click', async () => {
  const invitation = invitations.find((item) => item.id === selectedInvitationId);
  const response = responseFor(invitation);
  const recipient = response?.contact_email || invitation?.email;
  if (!recipient) {
    guestDialogFeedback.textContent = 'Aucune adresse e-mail disponible.';
    return;
  }
  if (demoMode) {
    guestDialogFeedback.textContent = `Aperçu : une confirmation PDF serait envoyée à ${recipient}.`;
    return;
  }
  const { error } = await supabase.from('email_logs').insert({
    invitation_id: invitation.id,
    rsvp_id: response?.id ?? null,
    recipient,
    email_type: 'rsvp_confirmation',
    status: 'pending'
  });
  guestDialogFeedback.textContent = error ? error.message : 'Confirmation ajoutée à la file d’envoi.';
});

assignmentRole.innerHTML = ROLE_OPTIONS.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join('');
document.querySelector('#save-assignment')?.addEventListener('click', async () => {
  if (!selectedInvitationId) return;
  if (demoMode) {
    const invitation = invitations.find((item) => item.id === selectedInvitationId);
    invitation.role_assignments ??= [];
    const existing = invitation.role_assignments.find((item) => item.role === assignmentRole.value);
    if (existing) existing.note = assignmentNote.value.trim();
    else invitation.role_assignments.push({ id: `demo-${Date.now()}`, role: assignmentRole.value, note: assignmentNote.value.trim(), assigned_at: new Date().toISOString() });
    assignmentNote.value = '';
    renderAssignments(invitation);
    renderRoles();
    return;
  }
  const { error } = await supabase.from('role_assignments').upsert({
    invitation_id: selectedInvitationId,
    role: assignmentRole.value,
    note: assignmentNote.value.trim(),
    assigned_by: (await supabase.auth.getUser()).data.user?.id ?? null
  }, { onConflict: 'invitation_id,role' });
  if (error) {
    guestDialogFeedback.textContent = error.message;
    return;
  }
  assignmentNote.value = '';
  await loadAllData();
  const refreshed = invitations.find((item) => item.id === selectedInvitationId);
  renderAssignments(refreshed);
});

currentAssignments?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-remove-assignment]');
  if (!button) return;
  if (demoMode) {
    const invitation = invitations.find((item) => item.id === selectedInvitationId);
    invitation.role_assignments = (invitation.role_assignments ?? []).filter((item) => item.id !== button.dataset.removeAssignment);
    renderAssignments(invitation);
    renderRoles();
    return;
  }
  const { error } = await supabase.from('role_assignments').delete().eq('id', button.dataset.removeAssignment);
  if (error) {
    guestDialogFeedback.textContent = error.message;
    return;
  }
  await loadAllData();
  renderAssignments(invitations.find((item) => item.id === selectedInvitationId));
});

initialiseAdmin();
