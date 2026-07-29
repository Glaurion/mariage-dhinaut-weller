-- Base Supabase sécurisée du mariage Dhinaut-Weller
-- À exécuter en une seule fois dans Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_name text not null,
  email text,
  invitation_code text not null unique default upper(encode(gen_random_bytes(12), 'hex')),
  maximum_guests integer not null default 1 check (maximum_guests between 1 and 20),
  is_active boolean not null default true,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invitations
  alter column invitation_code set default upper(encode(gen_random_bytes(12), 'hex'));

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

create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  dietary_notes text not null default '',
  message text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invitations_code_index
  on public.invitations (invitation_code);

create index if not exists guest_members_invitation_index
  on public.guest_members (invitation_id, sort_order);

alter table public.admins enable row level security;
alter table public.invitations enable row level security;
alter table public.guest_members enable row level security;
alter table public.rsvp_responses enable row level security;

-- Vérification centralisée du statut administrateur.
create or replace function public.is_wedding_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_wedding_admin() from public;
grant execute on function public.is_wedding_admin() to authenticated;

-- Politiques administrateur.
drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self"
on public.admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "wedding_admins_manage_invitations" on public.invitations;
create policy "wedding_admins_manage_invitations"
on public.invitations
for all
to authenticated
using (public.is_wedding_admin())
with check (public.is_wedding_admin());

drop policy if exists "wedding_admins_manage_members" on public.guest_members;
create policy "wedding_admins_manage_members"
on public.guest_members
for all
to authenticated
using (public.is_wedding_admin())
with check (public.is_wedding_admin());

drop policy if exists "wedding_admins_manage_responses" on public.rsvp_responses;
create policy "wedding_admins_manage_responses"
on public.rsvp_responses
for all
to authenticated
using (public.is_wedding_admin())
with check (public.is_wedding_admin());

-- Aucun accès direct aux données privées pour les visiteurs anonymes.
revoke all on table public.admins from anon;
revoke all on table public.invitations from anon;
revoke all on table public.guest_members from anon;
revoke all on table public.rsvp_responses from anon;

-- Autorisations nécessaires au futur tableau de bord, filtrées par RLS.
grant select on table public.admins to authenticated;
grant select, insert, update, delete on table public.invitations to authenticated;
grant select, insert, update, delete on table public.guest_members to authenticated;
grant select, insert, update, delete on table public.rsvp_responses to authenticated;

-- Renvoie uniquement le foyer associé au code privé fourni.
create or replace function public.get_invitation_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.invitations%rowtype;
  v_result jsonb;
begin
  if p_code is null or length(trim(p_code)) < 6 then
    return null;
  end if;

  select *
  into v_invitation
  from public.invitations
  where invitation_code = upper(trim(p_code))
    and is_active = true
  limit 1;

  if not found then
    return null;
  end if;

  update public.invitations
  set opened_at = coalesce(opened_at, now()),
      updated_at = now()
  where id = v_invitation.id;

  select jsonb_build_object(
    'household_name', v_invitation.household_name,
    'members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'first_name', gm.first_name,
            'last_name', gm.last_name,
            'is_child', gm.is_child
          ) order by gm.sort_order, gm.created_at
        )
        from public.guest_members gm
        where gm.invitation_id = v_invitation.id
          and gm.is_invited = true
      ),
      '[]'::jsonb
    ),
    'response', (
      select jsonb_build_object(
        'status', rr.status,
        'dietary_notes', rr.dietary_notes,
        'message', rr.message,
        'submitted_at', rr.submitted_at
      )
      from public.rsvp_responses rr
      where rr.invitation_id = v_invitation.id
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- Enregistre ou modifie la réponse d'un foyer à partir de son code privé.
create or replace function public.submit_rsvp(
  p_code text,
  p_status text,
  p_dietary_notes text default '',
  p_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation_id uuid;
begin
  if p_status not in ('present', 'absent') then
    raise exception 'Statut RSVP invalide';
  end if;

  select id
  into v_invitation_id
  from public.invitations
  where invitation_code = upper(trim(p_code))
    and is_active = true
  limit 1;

  if v_invitation_id is null then
    raise exception 'Invitation invalide ou inactive';
  end if;

  insert into public.rsvp_responses (
    invitation_id,
    status,
    dietary_notes,
    message
  ) values (
    v_invitation_id,
    p_status,
    left(coalesce(p_dietary_notes, ''), 2000),
    left(coalesce(p_message, ''), 3000)
  )
  on conflict (invitation_id)
  do update set
    status = excluded.status,
    dietary_notes = excluded.dietary_notes,
    message = excluded.message,
    updated_at = now();

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.get_invitation_by_code(text) from public;
revoke all on function public.submit_rsvp(text, text, text, text) from public;

grant execute on function public.get_invitation_by_code(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, text, text) to anon, authenticated;

-- Après avoir créé votre compte dans Authentication > Users,
-- remplacez l'UUID ci-dessous puis exécutez la ligne sans les deux tirets :
-- insert into public.admins (user_id, display_name)
-- values ('UUID_DU_COMPTE_BENJAMIN', 'Benjamin Dhinaut');
