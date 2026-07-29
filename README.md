# Mariage Dhinaut-Weller

Site de mariage de **Benjamin Dhinaut** et **Annaël Weller**, union prévue en **2028**.

## Univers

- Benjamin : Roi du Nord, Maison Dhinaut
- Annaël : Reine des Dragons, Maison Weller
- Maison commune : Dhinaut-Weller
- Devise : « Le feu et la neige ne formeront plus qu'un royaume. »
- Début de la relation : 3 avril 2022
- Fiançailles : 3 septembre 2025
- Lieu envisagé : La Robertsau, Strasbourg

Le design utilise un univers fantasy royal original inspiré des grandes sagas médiévales, sans reprendre les logos et illustrations officiels d'une série.

## Pages disponibles

- `index.html` : page d'accueil responsive
- `invitation.html?code=DEMO` : aperçu de l'invitation et du formulaire RSVP

## Structure

```text
mariage-dhinaut-weller/
├── index.html
├── invitation.html
├── css/
│   ├── style.css
│   └── invitation.css
├── js/
│   ├── app.js
│   ├── invitation.js
│   └── supabase-config.example.js
└── supabase/
    └── schema.sql
```

## Connexion Supabase

1. Créer un nouveau projet Supabase réservé au mariage.
2. Exécuter `supabase/schema.sql` dans le SQL Editor.
3. Ajouter les politiques RLS et les fonctions RPC d'accès par code privé.
4. Copier `js/supabase-config.example.js` vers `js/supabase-config.js`.
5. Renseigner l'URL du projet et la clé publique `anon`.
6. Charger le fichier de configuration avant `js/invitation.js` dans `invitation.html`.

Ne jamais placer la clé `service_role` dans un fichier du site ou dans GitHub Pages.

## Prochaines étapes

- créer le projet Supabase et ses règles de sécurité ;
- créer l'espace privé « Conseil Restreint » ;
- gérer les foyers et les personnes invitées ;
- envoyer les invitations personnalisées par email ;
- ajouter la date exacte, le domaine, le programme et le menu ;
- activer GitHub Pages et connecter un nom de domaine.
