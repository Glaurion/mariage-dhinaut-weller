-- Base Supabase du mariage Dhinaut-Weller
-- À exécuter dans le SQL Editor d'un nouveau projet Supabase.

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
  invitation_code text not null unique,
  maximum_guests integer not null default 1,
  is_active boolean not null default true,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Les politiques détaillées seront ajoutées lors de la connexion du projet Supabase.
-- Ne désactivez pas la sécurité RLS et ne placez jamais la clé service_role dans le site.
