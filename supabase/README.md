# Déploiement Supabase

## 1. Installer le schéma

Dans `Supabase > SQL Editor`, exécuter tout le fichier `schema.sql`. Il peut être rejoué : les migrations utilisent `if not exists`, des mises à jour ciblées et des fonctions remplaçables.

Le script :

- migre les premières tables de démonstration ;
- hache puis efface les anciens codes stockés en clair ;
- active Row Level Security sur toutes les tables privées ;
- crée les RPC publiques minimales d’accès par code ;
- crée les tables de réponses, historiques, missions, contenus et e-mails.

## 2. Créer les administrateurs

Créer d’abord les utilisateurs dans `Authentication > Users`, puis exécuter :

```sql
insert into public.admin_profiles (user_id, display_name)
values
  ('UUID_BENJAMIN', 'Benjamin Dhinaut'),
  ('UUID_ANNAEL', 'Annaël Weller')
on conflict (user_id) do update set display_name = excluded.display_name;
```

L’URL `admin.html` ne donne aucun accès aux données sans cette authentification. Le code d’entrée `ADMIN!!!` ouvre seulement le mode aperçu avec des données fictives intégrées au navigateur.

## 3. Tester une invitation

Exécuter `test-invitation.sql`, puis ouvrir :

```text
invitation.html?code=TEST-ROYAL-2028
```

Une modification met à jour la même ligne de `rsvps` grâce à la contrainte unique sur `invitation_id`. Le déclencheur `record_rsvp_history_trigger` conserve les changements dans `rsvp_history`.

## 4. Déployer la fonction d’e-mail

Avec Supabase CLI connecté au projet :

```bash
supabase functions deploy send-rsvp-confirmation --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set WEDDING_WEBHOOK_SECRET=une-valeur-longue-et-aleatoire
supabase secrets set WEDDING_EMAIL_FROM="Annaël et Benjamin <invitations@votre-domaine.fr>"
supabase secrets set WEDDING_SITE_URL=https://glaurion.github.io/mariage-dhinaut-weller
supabase secrets set WEDDING_DATE_LABEL="Date à confirmer en 2028"
supabase secrets set WEDDING_VENUE_LABEL="La Robertsau, Strasbourg"
```

Dans Resend, vérifier le domaine utilisé par `WEDDING_EMAIL_FROM`.

## 5. Relier la file d’e-mails

Créer un Database Webhook sur les insertions de `public.email_logs` :

- méthode : `POST` ;
- URL : URL de la fonction `send-rsvp-confirmation` ;
- en-tête `x-wedding-webhook-secret` : même valeur que `WEDDING_WEBHOOK_SECRET` ;
- table : `email_logs` ;
- événement : `INSERT`.

La fonction accepte l’identifiant dans `record.id`, passe le journal à `processing`, génère le PDF, envoie via Resend, puis enregistre `sent` ou `failed`.

## 6. Importer le registre

Depuis `admin.html`, importer un fichier `.xlsx`, `.xls` ou `.csv`. Les noms de colonnes français sont normalisés. Colonnes recommandées :

```text
identifiant, prénom, nom, foyer, côté, provenance, adresse, email,
téléphone, nombre maximal de personnes, enfant, code personnel,
texte personnalisé, note privée
```

Un aperçu bloque l’import si une ligne est invalide. Les invitations existantes ne sont jamais supprimées. Les nouveaux codes sont téléchargés une seule fois dans un CSV, car la base ne conserve ensuite que leur hachage.

## 7. Sauvegarde et confidentialité

- activer les sauvegardes Supabase selon le niveau du projet ;
- ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` ou le secret du webhook ;
- exporter régulièrement les réponses depuis l’administration ;
- supprimer ou anonymiser les données après le mariage selon la durée de conservation choisie ;
- ne rendre visibles dans la page du rassemblement que les prénoms ayant reçu un consentement explicite.
