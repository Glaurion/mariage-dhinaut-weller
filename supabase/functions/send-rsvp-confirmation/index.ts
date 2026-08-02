import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

type WebhookPayload = {
  email_log_id?: string;
  record?: { id?: string };
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const webhookSecret = Deno.env.get('WEDDING_WEBHOOK_SECRET') ?? '';
const siteUrl = (Deno.env.get('WEDDING_SITE_URL') ?? 'https://glaurion.github.io/mariage-dhinaut-weller/').replace(/\/$/, '');
const sender = Deno.env.get('WEDDING_EMAIL_FROM') ?? 'Annaël et Benjamin <invitations@example.com>';
const weddingDate = Deno.env.get('WEDDING_DATE_LABEL') ?? 'en 2028';
const weddingVenue = Deno.env.get('WEDDING_VENUE_LABEL') ?? 'La Robertsau, Strasbourg';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function generateInvitationPdf(invitation: Record<string, unknown>, response: Record<string, unknown>, guests: Array<Record<string, unknown>>) {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const titleFont = await document.embedFont(StandardFonts.TimesRomanBold);
  const bodyFont = await document.embedFont(StandardFonts.TimesRoman);
  const italicFont = await document.embedFont(StandardFonts.TimesRomanItalic);
  const gold = rgb(0.56, 0.38, 0.16);
  const ink = rgb(0.18, 0.13, 0.08);
  const margin = 58;
  let y = 770;

  page.drawRectangle({ x: 24, y: 24, width: 547, height: 794, borderColor: gold, borderWidth: 1 });
  page.drawRectangle({ x: 34, y: 34, width: 527, height: 774, borderColor: rgb(0.74, 0.61, 0.39), borderWidth: .5 });
  page.drawText('ANNAËL & BENJAMIN', { x: margin, y, size: 24, font: titleFont, color: gold });
  y -= 34;
  page.drawText('THE WEDDING IS COMING · 2028', { x: margin, y, size: 10, font: bodyFont, color: ink });
  y -= 52;
  page.drawText(String(invitation.household_name ?? 'Maison invitée'), { x: margin, y, size: 21, font: titleFont, color: ink });
  y -= 30;
  page.drawText('Votre réponse au rassemblement des deux royaumes', { x: margin, y, size: 13, font: italicFont, color: ink });
  y -= 38;

  const lines = [
    ['Invités', guests.map((guest) => `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim()).join(', ') || '—'],
    ['Réponse', response.status === 'present' ? 'Présent' : response.status === 'uncertain' ? 'Encore incertain' : 'Absent'],
    ['Participants', String(response.participants_count ?? 0)],
    ['Date', weddingDate],
    ['Lieu', weddingVenue],
    ['Régime alimentaire', String(response.dietary_preferences ?? 'Aucun renseignement')],
    ['Allergies', String(response.allergies ?? 'Aucune renseignée')],
    ['Transport', String(response.transport_needs ?? 'Aucun besoin')],
    ['Hébergement', String(response.accommodation_needs ?? 'Aucun besoin')]
  ];

  for (const [label, value] of lines) {
    page.drawText(`${label} :`, { x: margin, y, size: 11, font: titleFont, color: gold });
    page.drawText(value.slice(0, 72), { x: 185, y, size: 11, font: bodyFont, color: ink });
    y -= 25;
  }

  y -= 24;
  page.drawText('Revoir ou modifier votre invitation :', { x: margin, y, size: 11, font: titleFont, color: gold });
  y -= 20;
  page.drawText(`${siteUrl}/index.html`, { x: margin, y, size: 10, font: bodyFont, color: rgb(0.18, 0.3, 0.48) });
  y -= 42;
  page.drawText('Conservez votre code personnel : il vous sera demandé à l’entrée du royaume.', { x: margin, y, size: 10, font: italicFont, color: ink });
  page.drawText('Annaël et Benjamin vous remercient pour votre réponse.', { x: margin, y: 72, size: 12, font: italicFont, color: gold });
  return await document.save();
}

async function failLog(logId: string, message: string) {
  await supabase.from('email_logs').update({ status: 'failed', error_message: message.slice(0, 2000) }).eq('id', logId);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!webhookSecret || request.headers.get('x-wedding-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return new Response('Server configuration incomplete', { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const logId = payload.email_log_id ?? payload.record?.id;
  if (!logId) return new Response('Missing email_log_id', { status: 400 });

  const { data: log, error: logError } = await supabase
    .from('email_logs')
    .select('id, invitation_id, rsvp_id, recipient, status')
    .eq('id', logId)
    .single();
  if (logError || !log) return new Response('Email log not found', { status: 404 });
  if (log.status === 'sent') return Response.json({ success: true, already_sent: true });

  await supabase.from('email_logs').update({ status: 'processing', error_message: null }).eq('id', log.id);

  try {
    const [invitationResult, responseResult, guestsResult] = await Promise.all([
      supabase.from('invitations').select('id, household_name, house, provenance').eq('id', log.invitation_id).single(),
      supabase.from('rsvps').select('*').eq('id', log.rsvp_id).single(),
      supabase.from('guests').select('first_name, last_name, is_child').eq('invitation_id', log.invitation_id).order('sort_order')
    ]);
    if (invitationResult.error) throw invitationResult.error;
    if (responseResult.error) throw responseResult.error;
    if (guestsResult.error) throw guestsResult.error;

    const invitation = invitationResult.data;
    const response = responseResult.data;
    const guests = guestsResult.data ?? [];
    const firstName = guests[0]?.first_name ?? invitation.household_name;
    const statusText = response.status === 'present'
      ? 'votre présence est confirmée'
      : response.status === 'uncertain'
        ? 'votre réponse reste incertaine'
        : 'votre absence a bien été enregistrée';
    const pdfBytes = await generateInvitationPdf(invitation, response, guests);

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: sender,
        to: [log.recipient],
        subject: `Votre réponse au royaume — Annaël & Benjamin`,
        html: `
          <div style="background:#090b10;padding:32px;color:#e9dfc9;font-family:Georgia,serif">
            <div style="max-width:620px;margin:auto;border:1px solid #c49a52;padding:36px">
              <p style="color:#e7c57d;letter-spacing:.16em;text-transform:uppercase;font-size:12px">Message porté par les corbeaux</p>
              <h1 style="font-weight:normal">Bonjour ${escapeHtml(firstName)},</h1>
              <p>Le Conseil Restreint confirme que ${escapeHtml(statusText)} pour le mariage d’Annaël et Benjamin.</p>
              <p><strong>Participants enregistrés :</strong> ${Number(response.participants_count ?? 0)}</p>
              <p><strong>Date :</strong> ${escapeHtml(weddingDate)}<br><strong>Lieu :</strong> ${escapeHtml(weddingVenue)}</p>
              <p>Vous pourrez revoir et modifier votre réponse depuis <a style="color:#e7c57d" href="${siteUrl}/index.html">les portes du royaume</a> avec votre code personnel.</p>
              <p style="margin-top:30px;color:#c49a52">Annaël & Benjamin · The Wedding Is Coming</p>
            </div>
          </div>`,
        attachments: [{
          filename: 'invitation-annael-benjamin.pdf',
          content: bytesToBase64(pdfBytes)
        }]
      })
    });
    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(emailResult.message ?? 'Resend request failed');

    await supabase.from('email_logs').update({
      status: 'sent',
      provider_message_id: emailResult.id,
      sent_at: new Date().toISOString(),
      error_message: null
    }).eq('id', log.id);
    return Response.json({ success: true, message_id: emailResult.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failLog(log.id, message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});
