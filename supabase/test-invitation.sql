-- À exécuter après supabase/schema.sql dans le SQL Editor.
-- Crée ou met à jour une invitation réelle de test sans conserver le code en clair.

do $$
declare
  v_invitation_id uuid;
  v_code text := 'TEST-ROYAL-2028';
  v_hash text := public.hash_invitation_code(v_code);
begin
  select id into v_invitation_id
  from public.invitations
  where external_ref = 'TEST-ROYAL-2028'
  limit 1;

  if v_invitation_id is null then
    insert into public.invitations (
      external_ref,
      household_name,
      house,
      provenance,
      email,
      invitation_code_hash,
      code_hint,
      maximum_guests,
      personalised_text,
      invitation_status,
      is_active
    ) values (
      'TEST-ROYAL-2028',
      'Maison de Test du Royaume',
      'Maison unie',
      'Strasbourg',
      null,
      v_hash,
      'TES•••',
      2,
      'Annaël et Benjamin ont l’honneur de convier votre Maison au rassemblement de leurs deux royaumes.',
      'ready',
      true
    ) returning id into v_invitation_id;
  else
    update public.invitations
    set household_name = 'Maison de Test du Royaume',
        invitation_code_hash = v_hash,
        code_hint = 'TES•••',
        maximum_guests = 2,
        is_active = true,
        updated_at = now()
    where id = v_invitation_id;
  end if;

  delete from public.guests where invitation_id = v_invitation_id;
  insert into public.guests (invitation_id, first_name, last_name, is_child, sort_order)
  values
    (v_invitation_id, 'Arya', 'Exemple', false, 1),
    (v_invitation_id, 'Jon', 'Exemple', false, 2);
end;
$$;

-- Ouvrir ensuite : invitation.html?code=TEST-ROYAL-2028
