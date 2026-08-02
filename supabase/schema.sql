-- Base Supabase sécurisée du mariage Dhinaut-Weller.
-- Ce script est idempotent : il peut être rejoué après une mise à jour du site.
-- À exécuter dans Supabase > SQL Editor avec un compte propriétaire du projet.

create extension if not exists pgcrypto;

-- Normalisation utilisée pour tous les codes personnels.
create or replace function public.normalize_invitation_code(p_code text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(coalesce(p_code, ''));
begin
  v_code := replace(replace(v_code, 'Œ', 'OE'), 'Æ', 'AE');
  v_code := translate(v_code, 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸ', 'AAAAAACEEEEIIIINOOOOOUUUUYY');
  return regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
end;
$$;

create or replace function public.hash_invitation_code(p_code text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(digest(public.normalize_invitation_code(p_code), 'sha256'), 'hex');
$$;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_profiles (user_id, display_name, created_at)
select user_id, display_name, created_at from public.admins
on conflict (user_id) do nothing;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  household_name text not null,
  house text not null default 'royaume',
  provenance text not null default '',
  address text not null default '',
  email text,
  phone text,
  invitation_code text,
  invitation_code_hash text,
  code_hint text,
  maximum_guests integer not null default 1 check (maximum_guests between 1 and 20),
  personalised_text text not null default '',
  private_note text not null default '',
  invitation_status text not null default 'draft' check (invitation_status in ('draft', 'ready', 'sent', 'opened', 'answered', 'archived')),
  allow_uncertain boolean not null default true,
  is_active boolean not null default true,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invitations add column if not exists external_ref text;
alter table public.invitations add column if not exists house text not null default 'royaume';
alter table public.invitations add column if not exists provenance text not null default '';
alter table public.invitations add column if not exists address text not null default '';
alter table public.invitations add column if not exists phone text;
alter table public.invitations add column if not exists invitation_code_hash text;
alter table public.invitations add column if not exists code_hint text;
alter table public.invitations add column if not exists personalised_text text not null default '';
alter table public.invitations add column if not exists private_note text not null default '';
alter table public.invitations add column if not exists invitation_status text not null default 'draft';
alter table public.invitations add column if not exists allow_uncertain boolean not null default true;
alter table public.invitations alter column invitation_code drop not null;
alter table public.invitations alter column invitation_code drop default;

update public.invitations
set invitation_code_hash = public.hash_invitation_code(invitation_code),
    code_hint = left(public.normalize_invitation_code(invitation_code), 3) || '•••'
where invitation_code_hash is null
  and nullif(trim(invitation_code), '') is not null;

-- Le code en clair est effacé après migration. Le champ reste uniquement pour compatibilité SQL.
update public.invitations
set invitation_code = null
where invitation_code_hash is not null
  and invitation_code is not null;

create unique index if not exists invitations_external_ref_unique
  on public.invitations (external_ref)
  where external_ref is not null;

create unique index if not exists invitations_code_hash_unique
  on public.invitations (invitation_code_hash)
  where invitation_code_hash is not null;

create index if not exists invitations_status_index
  on public.invitations (invitation_status, is_active);

-- Ancienne table conservée le temps de la migration des premiers essais.
create table if not exists public.guest_members (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  is_child boolean not null default false,
  is_invited boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  provenance text not null default '',
  address text not null default '',
  email text,
  phone text,
  is_child boolean not null default false,
  is_invited boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.guests (id, invitation_id, first_name, last_name, is_child, is_invited, sort_order, created_at)
select id, invitation_id, first_name, last_name, is_child, is_invited, sort_order, created_at
from public.guest_members
on conflict (id) do nothing;

create index if not exists guests_invitation_index
  on public.guests (invitation_id, sort_order, created_at);

-- Ancienne table conservée et migrée vers rsvps.
create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  dietary_notes text not null default '',
  message text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'uncertain')),
  attending_guest_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(attending_guest_ids) = 'array'),
  participants_count integer not null default 0 check (participants_count between 0 and 20),
  adults_count integer not null default 0 check (adults_count between 0 and 20),
  children_count integer not null default 0 check (children_count between 0 and 20),
  contact_email text not null default '',
  contact_phone text not null default '',
  dietary_preferences text not null default '',
  allergies text not null default '',
  special_needs text not null default '',
  accommodation_needs text not null default 'none',
  transport_needs text not null default 'none',
  ceremony_attendance text not null default 'unknown',
  meal_attendance text not null default 'unknown',
  brunch_attendance text not null default 'unknown',
  message text not null default '',
  display_name_consent boolean not null default false,
  first_submitted_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.rsvps (
  id, invitation_id, status, dietary_preferences, message,
  first_submitted_at, last_submitted_at, created_at, updated_at
)
select id, invitation_id, status, dietary_notes, message, submitted_at, updated_at, submitted_at, updated_at
from public.rsvp_responses
on conflict (invitation_id) do nothing;

create table if not exists public.rsvp_history (
  id bigint generated by default as identity primary key,
  rsvp_id uuid not null references public.rsvps(id) on delete cascade,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  old_values jsonb,
  new_values jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists rsvp_history_invitation_index
  on public.rsvp_history (invitation_id, changed_at desc);

create table if not exists public.role_preferences (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  role text not null,
  details text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invitation_id, role)
);

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  role text not null,
  note text not null default '',
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invitation_id, role)
);

create table if not exists public.wedding_content (
  content_key text primary key,
  content_type text not null default 'information' check (content_type in ('information', 'program', 'update', 'link')),
  content_value jsonb not null default 'null'::jsonb,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  rsvp_id uuid references public.rsvps(id) on delete set null,
  recipient text not null,
  email_type text not null default 'rsvp_confirmation',
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_status_index
  on public.email_logs (status, requested_at);

create table if not exists public.invitation_access_attempts (
  id bigint generated by default as identity primary key,
  fingerprint_hash text not null,
  attempted_code_hash text not null,
  was_successful boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists invitation_attempts_rate_index
  on public.invitation_access_attempts (fingerprint_hash, attempted_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['admin_profiles', 'invitations', 'guests', 'rsvps', 'role_preferences', 'role_assignments', 'wedding_content']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', v_table, v_table);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', v_table, v_table);
  end loop;
end;
$$;

create or replace function public.record_rsvp_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or to_jsonb(old) is distinct from to_jsonb(new) then
    insert into public.rsvp_history (rsvp_id, invitation_id, changed_by, old_values, new_values)
    values (
      new.id,
      new.invitation_id,
      auth.uid(),
      case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
      to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists record_rsvp_history_trigger on public.rsvps;
create trigger record_rsvp_history_trigger
after insert or update on public.rsvps
for each row execute function public.record_rsvp_history();

create or replace function public.is_wedding_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid())
      or exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Row Level Security : les visiteurs n'accèdent jamais directement aux tables privées.
alter table public.admins enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.guest_members enable row level security;
alter table public.guests enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.rsvps enable row level security;
alter table public.rsvp_history enable row level security;
alter table public.role_preferences enable row level security;
alter table public.role_assignments enable row level security;
alter table public.wedding_content enable row level security;
alter table public.email_logs enable row level security;
alter table public.invitation_access_attempts enable row level security;

drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self" on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "admin_profiles_read_self" on public.admin_profiles;
create policy "admin_profiles_read_self" on public.admin_profiles for select to authenticated using (user_id = auth.uid());

do $$
declare
  v_table text;
  v_policy text;
begin
  foreach v_table in array array['invitations', 'guest_members', 'guests', 'rsvp_responses', 'rsvps', 'rsvp_history', 'role_preferences', 'role_assignments', 'wedding_content', 'email_logs']
  loop
    v_policy := 'wedding_admins_manage_' || v_table;
    execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_wedding_admin()) with check (public.is_wedding_admin())', v_policy, v_table);
  end loop;
end;
$$;

revoke all on table public.admins, public.admin_profiles, public.invitations, public.guest_members,
  public.guests, public.rsvp_responses, public.rsvps, public.rsvp_history,
  public.role_preferences, public.role_assignments, public.wedding_content,
  public.email_logs, public.invitation_access_attempts from anon;

grant select on table public.admins, public.admin_profiles to authenticated;
grant select, insert, update, delete on table public.invitations, public.guest_members,
  public.guests, public.rsvp_responses, public.rsvps, public.rsvp_history,
  public.role_preferences, public.role_assignments, public.wedding_content,
  public.email_logs to authenticated;

-- Fonction centrale de lecture par code, avec limitation souple par appareil.
create or replace function public.get_invitation_by_code(p_code text, p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normalized text := public.normalize_invitation_code(p_code);
  v_code_hash text := public.hash_invitation_code(p_code);
  v_fingerprint_hash text := public.hash_invitation_code(coalesce(nullif(p_fingerprint, ''), 'anonymous-device'));
  v_invitation public.invitations%rowtype;
  v_result jsonb;
  v_failed_attempts integer;
  v_code_is_valid boolean := false;
begin
  if length(v_normalized) < 6 or length(v_normalized) > 32 then
    return null;
  end if;

  select count(*) into v_failed_attempts
  from public.invitation_access_attempts
  where fingerprint_hash = v_fingerprint_hash
    and was_successful = false
    and attempted_at > now() - interval '10 minutes';

  if v_failed_attempts >= 8 then
    raise exception 'Le dragon exige quelques instants de patience avant une nouvelle tentative.';
  end if;

  select * into v_invitation
  from public.invitations
  where invitation_code_hash = v_code_hash
    and is_active = true
  limit 1;
  v_code_is_valid := found;

  insert into public.invitation_access_attempts (fingerprint_hash, attempted_code_hash, was_successful)
  values (v_fingerprint_hash, v_code_hash, v_code_is_valid);

  if not v_code_is_valid then
    return null;
  end if;

  update public.invitations
  set opened_at = coalesce(opened_at, now()),
      invitation_status = case when invitation_status in ('draft', 'ready', 'sent') then 'opened' else invitation_status end,
      updated_at = now()
  where id = v_invitation.id;

  select jsonb_build_object(
    'household_name', v_invitation.household_name,
    'house', v_invitation.house,
    'provenance', v_invitation.provenance,
    'email', v_invitation.email,
    'phone', v_invitation.phone,
    'maximum_guests', v_invitation.maximum_guests,
    'personalised_text', v_invitation.personalised_text,
    'allow_uncertain', v_invitation.allow_uncertain,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'first_name', g.first_name,
        'last_name', g.last_name,
        'is_child', g.is_child,
        'is_invited', g.is_invited
      ) order by g.sort_order, g.created_at)
      from public.guests g
      where g.invitation_id = v_invitation.id and g.is_invited = true
    ), '[]'::jsonb),
    'response', (
      select to_jsonb(r) || jsonb_build_object(
        'role_preferences', coalesce((
          select jsonb_agg(jsonb_build_object('role', rp.role, 'details', rp.details) order by rp.created_at)
          from public.role_preferences rp
          where rp.invitation_id = v_invitation.id
        ), '[]'::jsonb),
        'other_role', coalesce((
          select rp.details from public.role_preferences rp
          where rp.invitation_id = v_invitation.id and rp.role = 'other'
          limit 1
        ), '')
      ) - 'invitation_id'
      from public.rsvps r
      where r.invitation_id = v_invitation.id
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_invitation_by_code(p_code text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.get_invitation_by_code(p_code, 'legacy-browser');
$$;

-- Enregistrement unique : l'upsert met toujours à jour la même réponse.
create or replace function public.submit_rsvp(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.invitations%rowtype;
  v_rsvp public.rsvps%rowtype;
  v_status text := coalesce(p_payload->>'status', '');
  v_participants integer := greatest(0, coalesce((p_payload->>'participants_count')::integer, 0));
  v_adults integer := 0;
  v_children integer := 0;
  v_guest_ids jsonb := coalesce(p_payload->'attending_guest_ids', '[]'::jsonb);
  v_roles jsonb := coalesce(p_payload->'role_preferences', '[]'::jsonb);
  v_other_role text := left(coalesce(p_payload->>'other_role', ''), 120);
begin
  select * into v_invitation
  from public.invitations
  where invitation_code_hash = public.hash_invitation_code(p_code)
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Invitation invalide ou inactive';
  end if;
  if v_status not in ('present', 'absent', 'uncertain') then
    raise exception 'Statut RSVP invalide';
  end if;
  if v_status = 'uncertain' and not v_invitation.allow_uncertain then
    raise exception 'La réponse incertaine n’est pas disponible pour cette invitation';
  end if;
  if jsonb_typeof(v_guest_ids) <> 'array' or jsonb_typeof(v_roles) <> 'array' then
    raise exception 'Format de réponse invalide';
  end if;
  if v_status = 'absent' then
    v_participants := 0;
    v_guest_ids := '[]'::jsonb;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_guest_ids) selected(id)
    where not exists (
      select 1 from public.guests g
      where g.id::text = selected.id and g.invitation_id = v_invitation.id and g.is_invited = true
    )
  ) then
    raise exception 'Un membre sélectionné ne fait pas partie de cette invitation';
  end if;

  select
    count(*) filter (where g.is_child = false),
    count(*) filter (where g.is_child = true)
  into v_adults, v_children
  from public.guests g
  where g.invitation_id = v_invitation.id
    and v_guest_ids ? g.id::text;
  v_participants := v_adults + v_children;
  if v_participants > v_invitation.maximum_guests then
    raise exception 'Nombre maximal de participants dépassé';
  end if;

  insert into public.rsvps (
    invitation_id, status, attending_guest_ids, participants_count, adults_count, children_count,
    contact_email, contact_phone, dietary_preferences, allergies, special_needs,
    accommodation_needs, transport_needs, ceremony_attendance, meal_attendance,
    brunch_attendance, message, display_name_consent, first_submitted_at, last_submitted_at
  ) values (
    v_invitation.id,
    v_status,
    v_guest_ids,
    v_participants,
    v_adults,
    v_children,
    left(coalesce(p_payload->>'contact_email', ''), 320),
    left(coalesce(p_payload->>'contact_phone', ''), 60),
    left(coalesce(p_payload->>'dietary_preferences', ''), 2000),
    left(coalesce(p_payload->>'allergies', ''), 2000),
    left(coalesce(p_payload->>'special_needs', ''), 2000),
    left(coalesce(p_payload->>'accommodation_needs', 'none'), 80),
    left(coalesce(p_payload->>'transport_needs', 'none'), 80),
    left(coalesce(p_payload->>'ceremony_attendance', 'unknown'), 20),
    left(coalesce(p_payload->>'meal_attendance', 'unknown'), 20),
    left(coalesce(p_payload->>'brunch_attendance', 'unknown'), 20),
    left(coalesce(p_payload->>'message', ''), 3000),
    coalesce((p_payload->>'display_name_consent')::boolean, false),
    now(),
    now()
  )
  on conflict (invitation_id) do update set
    status = excluded.status,
    attending_guest_ids = excluded.attending_guest_ids,
    participants_count = excluded.participants_count,
    adults_count = excluded.adults_count,
    children_count = excluded.children_count,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    dietary_preferences = excluded.dietary_preferences,
    allergies = excluded.allergies,
    special_needs = excluded.special_needs,
    accommodation_needs = excluded.accommodation_needs,
    transport_needs = excluded.transport_needs,
    ceremony_attendance = excluded.ceremony_attendance,
    meal_attendance = excluded.meal_attendance,
    brunch_attendance = excluded.brunch_attendance,
    message = excluded.message,
    display_name_consent = excluded.display_name_consent,
    last_submitted_at = now(),
    updated_at = now()
  returning * into v_rsvp;

  delete from public.role_preferences where invitation_id = v_invitation.id;
  insert into public.role_preferences (invitation_id, role)
  select v_invitation.id, roles.role
  from (
    select distinct left(value, 80) as role
    from jsonb_array_elements_text(v_roles)
  ) roles
  where roles.role in ('barman', 'animateur', 'dj', 'photographe', 'jeux', 'ceremonie', 'decoration', 'installation', 'rangement', 'conducteur', 'accueil', 'enfants');

  if nullif(trim(v_other_role), '') is not null then
    insert into public.role_preferences (invitation_id, role, details)
    values (v_invitation.id, 'other', v_other_role)
    on conflict (invitation_id, role) do update set details = excluded.details, updated_at = now();
  end if;

  update public.invitations
  set invitation_status = 'answered', updated_at = now()
  where id = v_invitation.id;

  if nullif(trim(v_rsvp.contact_email), '') is not null then
    insert into public.email_logs (invitation_id, rsvp_id, recipient)
    values (v_invitation.id, v_rsvp.id, v_rsvp.contact_email);
  end if;

  return jsonb_build_object('success', true, 'response', to_jsonb(v_rsvp) - 'invitation_id', 'email_queued', nullif(trim(v_rsvp.contact_email), '') is not null);
end;
$$;

-- Compatibilité avec le premier formulaire publié.
create or replace function public.submit_rsvp(
  p_code text,
  p_status text,
  p_dietary_notes text default '',
  p_message text default ''
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.submit_rsvp(p_code, jsonb_build_object(
    'status', p_status,
    'dietary_preferences', coalesce(p_dietary_notes, ''),
    'message', coalesce(p_message, ''),
    'participants_count', case when p_status = 'present' then 1 else 0 end,
    'adults_count', case when p_status = 'present' then 1 else 0 end,
    'children_count', 0,
    'attending_guest_ids', '[]'::jsonb,
    'role_preferences', '[]'::jsonb
  ));
$$;

create or replace function public.get_realm_summary(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  select * into v_invitation
  from public.invitations
  where invitation_code_hash = public.hash_invitation_code(p_code) and is_active = true
  limit 1;
  if not found then return null; end if;

  return jsonb_build_object(
    'household_name', v_invitation.household_name,
    'content', coalesce((
      select jsonb_object_agg(content_key, content_value)
      from public.wedding_content
      where is_published = true and content_type <> 'update'
    ), '{}'::jsonb),
    'participants', coalesce((
      select jsonb_agg(distinct g.first_name order by g.first_name)
      from public.rsvps r
      join public.guests g on g.invitation_id = r.invitation_id
      where r.status = 'present'
        and r.display_name_consent = true
        and r.attending_guest_ids ? g.id::text
    ), '[]'::jsonb),
    'updates', coalesce((
      select jsonb_agg(content_value order by sort_order desc, updated_at desc)
      from public.wedding_content
      where is_published = true and content_type = 'update'
    ), '[]'::jsonb)
  );
end;
$$;

-- Import sécurisé réservé aux administrateurs. Le code en clair n'est renvoyé qu'une fois.
create or replace function public.admin_import_invitation(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation_id uuid;
  v_external_ref text := nullif(trim(p_payload->>'external_ref'), '');
  v_first_name text := left(trim(coalesce(p_payload->>'first_name', '')), 120);
  v_last_name text := left(trim(coalesce(p_payload->>'last_name', '')), 120);
  v_base_code text;
  v_code text;
  v_hash text;
  v_suffix integer := 0;
  v_is_new boolean := false;
begin
  if not public.is_wedding_admin() then raise exception 'Accès administrateur requis'; end if;
  if v_first_name = '' or v_last_name = '' then raise exception 'Prénom et nom requis'; end if;

  if v_external_ref is not null then
    select id into v_invitation_id from public.invitations where external_ref = v_external_ref limit 1;
  end if;
  v_is_new := v_invitation_id is null;

  v_base_code := rpad(left(public.normalize_invitation_code(v_first_name), 3), 3, 'X')
    || rpad(left(public.normalize_invitation_code(v_last_name), 3), 3, 'X');
  v_code := coalesce(nullif(public.normalize_invitation_code(p_payload->>'code'), ''), v_base_code);
  if length(v_code) < 6 then v_code := v_base_code; end if;
  loop
    v_hash := public.hash_invitation_code(v_code);
    exit when not exists (
      select 1 from public.invitations where invitation_code_hash = v_hash and id is distinct from v_invitation_id
    );
    v_suffix := v_suffix + 1;
    v_code := v_base_code || lpad(v_suffix::text, 2, '0');
  end loop;

  if v_invitation_id is null then
    insert into public.invitations (
      external_ref, household_name, house, provenance, address, email, phone,
      invitation_code_hash, code_hint, maximum_guests, personalised_text,
      private_note, invitation_status, is_active
    ) values (
      v_external_ref,
      left(coalesce(nullif(trim(p_payload->>'household_name'), ''), 'Maison ' || v_last_name), 180),
      left(coalesce(nullif(trim(p_payload->>'house'), ''), 'royaume'), 60),
      left(coalesce(p_payload->>'provenance', ''), 200),
      left(coalesce(p_payload->>'address', ''), 500),
      nullif(left(trim(coalesce(p_payload->>'email', '')), 320), ''),
      nullif(left(trim(coalesce(p_payload->>'phone', '')), 60), ''),
      v_hash,
      left(v_code, 3) || '•••',
      greatest(1, least(20, coalesce((p_payload->>'maximum_guests')::integer, 1))),
      left(coalesce(p_payload->>'personalised_text', ''), 4000),
      left(coalesce(p_payload->>'private_note', ''), 3000),
      'ready',
      true
    ) returning id into v_invitation_id;
  else
    update public.invitations set
      household_name = left(coalesce(nullif(trim(p_payload->>'household_name'), ''), household_name), 180),
      house = left(coalesce(nullif(trim(p_payload->>'house'), ''), house), 60),
      provenance = left(coalesce(p_payload->>'provenance', provenance), 200),
      address = left(coalesce(p_payload->>'address', address), 500),
      email = coalesce(nullif(left(trim(coalesce(p_payload->>'email', '')), 320), ''), email),
      phone = coalesce(nullif(left(trim(coalesce(p_payload->>'phone', '')), 60), ''), phone),
      maximum_guests = greatest(1, least(20, coalesce((p_payload->>'maximum_guests')::integer, maximum_guests))),
      personalised_text = left(coalesce(p_payload->>'personalised_text', personalised_text), 4000),
      private_note = left(coalesce(p_payload->>'private_note', private_note), 3000),
      updated_at = now()
    where id = v_invitation_id;
  end if;

  if not exists (
    select 1 from public.guests
    where invitation_id = v_invitation_id and lower(first_name) = lower(v_first_name) and lower(last_name) = lower(v_last_name)
  ) then
    insert into public.guests (invitation_id, first_name, last_name, provenance, address, email, phone, is_child, sort_order)
    values (
      v_invitation_id, v_first_name, v_last_name,
      left(coalesce(p_payload->>'provenance', ''), 200),
      left(coalesce(p_payload->>'address', ''), 500),
      nullif(left(trim(coalesce(p_payload->>'email', '')), 320), ''),
      nullif(left(trim(coalesce(p_payload->>'phone', '')), 60), ''),
      coalesce((p_payload->>'is_child')::boolean, false),
      coalesce((p_payload->>'sort_order')::integer, 0)
    );
  end if;

  return jsonb_build_object(
    'invitation_id', v_invitation_id,
    'generated_code', case when v_is_new then v_code else null end,
    'code_hint', case when v_is_new then left(v_code, 3) || '•••' else (select code_hint from public.invitations where id = v_invitation_id) end
  );
end;
$$;

create or replace function public.admin_reset_invitation_code(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_guest public.guests%rowtype;
  v_code text;
  v_hash text;
begin
  if not public.is_wedding_admin() then raise exception 'Accès administrateur requis'; end if;
  select * into v_guest from public.guests where invitation_id = p_invitation_id order by sort_order, created_at limit 1;
  if not found then raise exception 'Aucun invité associé'; end if;
  v_code := rpad(left(public.normalize_invitation_code(v_guest.first_name), 3), 3, 'X')
    || rpad(left(public.normalize_invitation_code(v_guest.last_name), 3), 3, 'X')
    || lpad((floor(random() * 90) + 10)::integer::text, 2, '0');
  v_hash := public.hash_invitation_code(v_code);
  while exists (select 1 from public.invitations where invitation_code_hash = v_hash and id <> p_invitation_id) loop
    v_code := left(v_code, 6) || lpad((floor(random() * 90) + 10)::integer::text, 2, '0');
    v_hash := public.hash_invitation_code(v_code);
  end loop;
  update public.invitations set invitation_code_hash = v_hash, code_hint = left(v_code, 3) || '•••', updated_at = now() where id = p_invitation_id;
  return jsonb_build_object('generated_code', v_code, 'code_hint', left(v_code, 3) || '•••');
end;
$$;

revoke all on function public.is_wedding_admin() from public;
revoke all on function public.get_invitation_by_code(text, text) from public;
revoke all on function public.get_invitation_by_code(text) from public;
revoke all on function public.submit_rsvp(text, jsonb) from public;
revoke all on function public.submit_rsvp(text, text, text, text) from public;
revoke all on function public.get_realm_summary(text) from public;
revoke all on function public.admin_import_invitation(jsonb) from public;
revoke all on function public.admin_reset_invitation_code(uuid) from public;

grant execute on function public.is_wedding_admin() to authenticated;
grant execute on function public.get_invitation_by_code(text, text) to anon, authenticated;
grant execute on function public.get_invitation_by_code(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, jsonb) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, text, text) to anon, authenticated;
grant execute on function public.get_realm_summary(text) to anon, authenticated;
grant execute on function public.admin_import_invitation(jsonb) to authenticated;
grant execute on function public.admin_reset_invitation_code(uuid) to authenticated;

insert into public.wedding_content (content_key, content_type, content_value, sort_order)
values
  ('venue_description', 'information', to_jsonb('Le rassemblement est envisagé dans les terres verdoyantes de La Robertsau, à Strasbourg. L’adresse exacte sera révélée aux invités confirmés.'::text), 10),
  ('date_description', 'information', to_jsonb('La date précise et les horaires seront annoncés dès qu’ils seront scellés.'::text), 20),
  ('transport_description', 'information', to_jsonb('Train jusqu’à Strasbourg, transports urbains et covoiturages entre Maisons seront organisés.'::text), 30),
  ('accommodation_description', 'information', to_jsonb('Une sélection d’hébergements proches du domaine sera publiée ici.'::text), 40),
  ('treasury_description', 'information', to_jsonb('Votre présence est déjà un présent. Une cagnotte facultative pourra être ajoutée ici.'::text), 50)
on conflict (content_key) do nothing;

-- Après avoir créé les comptes dans Authentication > Users :
-- insert into public.admin_profiles (user_id, display_name)
-- values ('UUID_DU_COMPTE', 'Benjamin Dhinaut');
