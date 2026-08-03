# Mariage Dhinaut-Weller

Site immersif du mariage d’**Annaël Weller** et **Benjamin Dhinaut**, prévu en **2028**.

## Parcours

- `index.html` : portes du château, dragon, feu, fumée, musique et récit en chapitres.
- `invitation.html?code=DEMO` : parchemin RSVP complet en mode démonstration.
- `royaume.html?code=DEMO` : informations privées du rassemblement.
- `admin.html` : Conseil Restreint protégé par Supabase Auth et les règles RLS.

Le code `BENDHI` ouvre l’invitation de démonstration. Le code `ADMIN!!!` ouvre un aperçu du tableau de bord contenant uniquement des personnages fictifs. Les vraies données restent accessibles seulement depuis `admin.html` après authentification Supabase.

## Fonctionnalités

- introduction cinématique de moins de six secondes, passable et adaptée à `prefers-reduced-motion` ;
- ambiance sonore avec choix mémorisé pendant la navigation ;
- sommaire fixe et chapitres plein écran ;
- coffre gardé par un dragon, code personnel, chaînes, cadenas, enveloppe et sceau ;
- invitation personnalisée avec présence, participants, coordonnées, repas, allergies, transport et hébergement ;
- choix de missions volontaires et récapitulatif avant validation ;
- réponse unique modifiable, historique des changements et consentement d’affichage ;
- animation finale de lettre pliée, enveloppe scellée et corneille vers le château ;
- page privée du rassemblement avec lieu, programme, cagnotte et participants consentants ;
- administration avec statistiques, filtres, import Excel/CSV, exports CSV/Excel/PDF, rôles et contenus ;
- e-mail serveur et PDF personnel via Supabase Edge Function et Resend.

## Structure

```text
.
├── index.html
├── invitation.html
├── royaume.html
├── admin.html
├── assets/
├── css/
├── js/
└── supabase/
    ├── schema.sql
    ├── test-invitation.sql
    ├── README.md
    └── functions/send-rsvp-confirmation/index.ts
```

## Activation Supabase

1. Ouvrir le SQL Editor du projet Supabase.
2. Exécuter intégralement `supabase/schema.sql`.
3. Créer les comptes Benjamin et Annaël dans `Authentication > Users`.
4. Ajouter leurs UUID dans `public.admin_profiles` comme expliqué dans `supabase/README.md`.
5. Tester avec `supabase/test-invitation.sql` et le code `TEST-ROYAL-2028`.

La clé présente dans `js/supabase-config.js` est une clé publique destinée au navigateur. La sécurité dépend des politiques RLS et des fonctions RPC. Ne jamais placer une clé `service_role`, Resend ou un secret de webhook dans le dépôt.

## Développement local

Depuis la racine du projet :

```powershell
python -m http.server 4179
```

Puis ouvrir `http://127.0.0.1:4179/`.

## Publication

Le site statique fonctionne sur GitHub Pages. Le schéma, l’authentification et la fonction d’e-mail doivent être déployés séparément dans Supabase avant d’utiliser de vrais codes invités.
