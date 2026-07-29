-- À exécuter après supabase/schema.sql dans le SQL Editor.
-- Crée une invitation réelle de test dans Supabase.

do $$
declare
  v_invitation_id uuid;
begin
  insert into public.invitations (
    household_name,
    email,
    invitation_code,
    maximum_guests,
    is_active
  ) values (
    'Maison de Test du Royaume',
    null,
    'TEST-ROYAL-2028',
    2,
    true
  )
  on conflict (invitation_code)
  do update set
    household_name = excluded.household_name,
    maximum_guests = excluded.maximum_guests,
    is_active = true,
    updated_at = now()
  returning id into v_invitation_id;

  delete from public.guest_members
  where invitation_id = v_invitation_id;

  insert into public.guest_members (
    invitation_id,
    first_name,
    last_name,
    is_child,
    sort_order
  ) values
    (v_invitation_id, 'Arya', 'Exemple', false, 1),
    (v_invitation_id, 'Jon', 'Exemple', false, 2);
end;
$$;

-- Une fois exécuté, ouvrez :
-- invitation.html?code=TEST-ROYAL-2028
