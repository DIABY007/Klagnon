# Plan de Mise en Œuvre : Application de Gestion Financière KLAGNON

**Stack Technique :** Next.js (App Router), Supabase (PostgreSQL, Auth, RLS, RPC), Tailwind CSS, Shadcn UI.
**Règles pour le développeur IA :** 
- Ne passer à l'étape suivante que si le test de validation de l'étape courante est réussi.
- Séparer strictement la logique serveur (Server Actions/Supabase RPC) de l'interface client.
- Appliquer le principe de "Offline-first" / Optimistic UI pour les formulaires de saisie.

---

## Phase 1 : Initialisation et Authentification

### Étape 1.1 : Initialisation du projet Next.js et de l'UI
- **Instruction :** Créer un nouveau projet Next.js (App Router) avec TypeScript et Tailwind CSS. Initialiser Shadcn UI et installer les composants de base (Button, Input, Form, Table, Dialog, Select).
- **Test de validation :** Lancer l'application en local. Afficher une page blanche contenant un bouton Shadcn fonctionnel. Vérifier l'absence d'erreurs de compilation.

### Étape 1.2 : Configuration du client Supabase
- **Instruction :** Installer les dépendances Supabase pour le SSR (Server-Side Rendering). Créer les utilitaires pour instancier le client Supabase côté serveur et côté client à l'aide des variables d'environnement.
- **Test de validation :** Écrire un script de test simple qui ping la base de données Supabase depuis un Server Component et affiche le statut de connexion sur la page d'accueil.

### Étape 1.3 : Mise en place de l'Authentification et du Middleware
- **Instruction :** Créer un formulaire de connexion (Email/Mot de passe). Configurer un Middleware Next.js pour protéger toutes les routes sous le chemin `/dashboard`. Implémenter une gestion des rôles (Admin, Agent de saisie) basée sur les métadonnées de l'utilisateur Supabase.
- **Test de validation :** Tenter d'accéder à `/dashboard` sans être connecté (doit rediriger vers `/login`). Se connecter avec un compte test et vérifier la redirection réussie vers `/dashboard`.

---

## Phase 2 : Modélisation de la Base de Données (Supabase)

*Note : Les instructions suivantes doivent être exécutées via des migrations SQL ou via l'interface Supabase.*

### Étape 2.1 : Création des tables de référence
- **Instruction :** Créer la table `Tiers` (id, nom, type : 'Client' ou 'Fournisseur', contact).
- **Test de validation :** Insérer manuellement un client et un fournisseur via le dashboard Supabase et les requêter avec succès depuis l'application Next.js.

### Étape 2.2 : Création des tables d'Achat et de Frais Annexes
- **Instruction :** Créer la table `Achats` (id, date, fournisseur_id, quantite_tonnes, prix_unitaire, mode_paiement : 'Espèces' ou 'MoMo', statut_paiement). Créer la table `Frais_Annexes` (id, achat_id, type_frais : 'Transport', 'Chargement', 'Déchargement', 'Autre', montant). Mettre en place une clé étrangère avec suppression en cascade entre Frais_Annexes et Achats.
- **Test de validation :** Vérifier dans la base de données qu'il est impossible de créer un frais annexe sans un `achat_id` valide.

### Étape 2.3 : Création des tables de Stock, Ventes et Trésorerie
- **Instruction :** 
  - Créer la table `Mouvements_Stock` (id, date, type : 'Entrée', 'Sortie', 'Perte', quantite, cause_perte).
  - Créer la table `Ventes` (id, date, client_id, quantite, prix_unitaire, statut_paiement).
  - Créer la table `Mouvements_Caisse` (id, date, type_compte : 'Caisse' ou 'MoMo', type_mouvement : 'Entrée', 'Sortie', montant, reference_operation).
- **Test de validation :** Vérifier l'intégrité référentielle en s'assurant que les types d'énumération (ENUM ou contraintes CHECK) rejettent des valeurs invalides (ex: type de compte 'Banque').

### Étape 2.4 : Sécurité (Row Level Security - RLS)
- **Instruction :** Activer la RLS sur toutes les tables. Créer des politiques permettant aux Agents de lire et insérer des données, mais réserver les droits de modification (UPDATE/DELETE) et la lecture des vues financières globales (si applicables) aux Admins.
- **Test de validation :** Connecter l'application avec un compte Agent. Tenter de supprimer une ligne dans la table `Achats`. L'opération doit être rejetée par Supabase avec une erreur de permission.

---

## Phase 3 : Module d'Achat et Coût de Revient (Le cœur du système)

### Étape 3.1 : Formulaire d'Achat avec Frais dynamiques
- **Instruction :** Créer une page contenant un formulaire multi-sections (utilisation de React Hook Form + Zod). Section 1 : Détails de l'achat (Fournisseur, Quantité, Prix unitaire, Mode paiement). Section 2 : Ajout dynamique de frais annexes (bouton "Ajouter un frais" générant de nouveaux champs).
- **Test de validation :** Remplir le formulaire, vérifier que Zod bloque la soumission si un montant est négatif ou si la quantité est vide.

### Étape 3.2 : Transaction atomique via Supabase RPC (Procédure stockée)
- **Instruction :** Créer une fonction PostgreSQL (RPC) sur Supabase nommée `enregistrer_achat_complet`. Cette fonction doit, dans une même transaction : 1. Insérer l'Achat. 2. Insérer les Frais Annexes liés. 3. Insérer un mouvement d'Entrée dans `Mouvements_Stock`. 4. Insérer une Sortie dans `Mouvements_Caisse` selon le mode de paiement.
- **Test de validation :** Soumettre le formulaire. Vérifier dans la base de données que l'Achat, les Frais, le Mouvement de Stock et le Mouvement de Caisse ont tous été créés simultanément.

### Étape 3.3 : Calcul d'affichage du Coût de Revient Unitaire (CRU)
- **Instruction :** Créer un composant tableau affichant l'historique des achats. Pour chaque ligne, calculer et afficher le CRU (Formule : `( (Quantité * Prix unitaire) + Somme des frais annexes ) / Quantité`). Ce calcul doit être fait via une vue SQL ou directement dans la requête de récupération, pas côté client.
- **Test de validation :** Comparer le CRU affiché dans le tableau avec un calcul manuel sur calculatrice pour le même achat. Les valeurs doivent être strictement identiques.

---

## Phase 4 : Module de Stockage et Pertes

### Étape 4.1 : Tableau de bord du Stock en Temps Réel
- **Instruction :** Créer une requête (ou une vue SQL) qui calcule le stock physique actuel (Somme des 'Entrées' MOINS Somme des 'Sorties' MOINS Somme des 'Pertes'). Afficher cette métrique sur une carte globale en haut de la page de gestion des stocks.
- **Test de validation :** Ajouter manuellement une ligne d'Entrée (10T) et une ligne de Sortie (2T) dans la base. Rafraîchir la page, la carte doit afficher 8T.

### Étape 4.2 : Formulaire de déclaration de perte
- **Instruction :** Créer un formulaire (Dialog/Modal) permettant de déclarer une perte de stock. Champs requis : Date, Quantité perdue, Cause (Menu déroulant : Humidité, Séchage, Rongeurs, Autre). La soumission insère une ligne 'Perte' dans `Mouvements_Stock`.
- **Test de validation :** Déclarer une perte de 0.5T pour 'Humidité'. Vérifier que le stock global affiché à l'étape 4.1 est immédiatement mis à jour (déduit de 0.5T).

---

## Phase 5 : Module de Vente et Facturation

### Étape 5.1 : Formulaire de Vente et impact sur le stock
- **Instruction :** Créer le formulaire de saisie d'une vente (Client, Quantité, Prix unitaire de vente, Mode d'encaissement). La soumission doit exécuter une transaction RPC similaire à l'achat : création de la vente, mouvement de sortie de stock, mouvement d'entrée en caisse. Validation bloquante : Interdire la vente si la quantité demandée est supérieure au stock disponible.
- **Test de validation :** Tenter de vendre 50T alors que le stock (étape 4.1) est de 10T. L'application doit afficher une erreur claire et la transaction doit échouer.

### Étape 5.2 : Génération de Facture / Reçu
- **Instruction :** Intégrer une librairie de génération de PDF (ex: `jspdf` ou `@react-pdf/renderer`). Ajouter un bouton "Télécharger la facture" sur chaque ligne de l'historique des ventes. Le PDF doit inclure les coordonnées de KLAGNON, les informations du client, le détail de la transaction et un statut "Payé".
- **Test de validation :** Cliquer sur le bouton, ouvrir le PDF généré et vérifier que toutes les informations correspondent exactement à l'enregistrement de la vente dans la base de données.

---

## Phase 6 : Trésorerie et Suivi des Créances

### Étape 6.1 : Tableaux de bord des Caisses
- **Instruction :** Créer une page Trésorerie divisée en deux onglets : "Caisse Physique (Espèces)" et "Caisse Mobile Money". Chaque onglet doit afficher le solde actuel (Entrées - Sorties de la table `Mouvements_Caisse` filtré par `type_compte`) et un tableau d'historique des transactions.
- **Test de validation :** Effectuer un achat fictif payé par MoMo. Vérifier que seul le solde de l'onglet "Caisse Mobile Money" diminue, sans affecter la Caisse Physique.

### Étape 6.2 : Suivi des Créances Clients et Dettes Fournisseurs
- **Instruction :** Créer une vue "Créances" affichant les ventes dont le statut de paiement n'est pas "Payé en totalité". Créer un formulaire permettant d'enregistrer un paiement partiel ou total sur une vente existante (ce qui génère une entrée dans `Mouvements_Caisse` et met à jour le statut de la vente).
- **Test de validation :** Créer une vente de 100 000 FCFA marquée "En attente". Enregistrer un paiement de 40 000 FCFA. Vérifier que la vente affiche désormais un reste à recouvrer de 60 000 FCFA et que la caisse a augmenté de 40 000 FCFA.

---

## Phase 7 : Optimisation et Résilience (Offline-first basique)

### Étape 7.1 : Configuration de React Query (TanStack Query)
- **Instruction :** Configurer `TanStack Query` pour la gestion des requêtes côté client. Paramétrer le cache pour réduire les appels réseaux inutiles sur les tables de référence (ex: liste des fournisseurs).
- **Test de validation :** Naviguer entre la page d'accueil et la page de création d'achat. Vérifier dans l'onglet "Network" des outils de développement du navigateur que la liste des fournisseurs n'est pas re-téléchargée à chaque navigation.

### Étape 7.2 : Feedback visuel et soumission optimiste
- **Instruction :** Lors de la soumission de tout formulaire (Achat, Vente, Perte), désactiver le bouton de soumission, afficher un indicateur de chargement clair (spinner), et utiliser des "Toasts" (Shadcn) pour notifier le succès ou l'échec de la transaction.
- **Test de validation :** Simuler une connexion lente via les outils de développement (Network > Slow 3G). Soumettre un formulaire d'achat et vérifier que l'utilisateur ne peut pas cliquer deux fois sur le bouton de soumission pendant le temps de traitement de la requête.