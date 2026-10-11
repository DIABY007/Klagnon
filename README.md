# Klagnon — Gestion Financière Agricole

Application de gestion financière pour l'achat et la revente de produits agricoles. Construite avec **Next.js (App Router)**, **Supabase**, **Tailwind CSS** et **Shadcn UI**.

## Fonctionnalités

- **Authentification** — Connexion email/mot de passe via Supabase Auth, middleware de protection des routes
- **Gestion des Achats** — Formulaire multi-sections avec frais annexes dynamiques, coût de revient unitaire (CRU)
- **Gestion des Stocks** — Stock en temps réel, déclaration de pertes (humidité, séchage, rongeurs)
- **Gestion des Ventes** — Validation stock disponible, génération de facture PDF
- **Trésorerie** — Suivi Caisse Physique et Mobile Money, paiements partiels/totaux
- **Créances Clients** — Suivi des impayés, barre de progression des paiements

## Stack Technique

| Composant | Technologie |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| UI | Shadcn UI, Tailwind CSS 4, Lucide Icons |
| Formulaire | React Hook Form + Zod |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/mot de passe, RLS) |
| PDF | jspdf + jspdf-autotable |
| Feedback | Sonner (Toasts) |

## Configuration

1. Copier `.env.example` vers `.env.local`
2. Remplir les variables Supabase :
   ```
   NEXT_PUBLIC_SUPABASE_URL=votre_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
   ```
3. Exécuter les migrations SQL dans le dossier `supabase/migrations/`
4. Lancer le projet :

```bash
npm install
npm run dev
```

## Structure du Projet

```
src/
├── app/
│   ├── (auth)/login/          # Page de connexion
│   └── dashboard/
│       ├── achats/            # Gestion des achats
│       ├── stock/             # Gestion des stocks
│       ├── ventes/            # Gestion des ventes + factures
│       └── tresorerie/        # Trésorerie + créances
├── components/
│   ├── FactureButton.tsx      # Générateur de facture PDF
│   └── ui/                    # Composants Shadcn
└── utils/supabase/            # Client, middleware, serveur
supabase/migrations/           # Migrations SQL
```

## Rôles

- **Admin** — Tous les droits (CRUD complet)
- **Agent de saisie** — Lecture et insertion uniquement