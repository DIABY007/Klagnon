-- ============================================================
-- Migration: Phase 2 — Modélisation de la Base de Données
-- Application: Klagnon — Gestion Financière Agricole
-- ============================================================

-- 1. CRÉATION DES TYPES ENUM
-- ============================================================

CREATE TYPE type_tiers AS ENUM ('Client', 'Fournisseur');
CREATE TYPE mode_paiement AS ENUM ('Espèces', 'MoMo');
CREATE TYPE statut_paiement AS ENUM ('Payé', 'En attente', 'Partiel');
CREATE TYPE type_mouvement_stock AS ENUM ('Entrée', 'Sortie', 'Perte');
CREATE TYPE type_compte AS ENUM ('Caisse', 'MoMo');
CREATE TYPE type_mouvement_caisse AS ENUM ('Entrée', 'Sortie');
CREATE TYPE type_frais AS ENUM ('Transport', 'Chargement', 'Déchargement', 'Autre');
CREATE TYPE cause_perte AS ENUM ('Humidité', 'Séchage', 'Rongeurs', 'Autre');

-- 2. TABLE TIERS (Clients et Fournisseurs)
-- ============================================================

CREATE TABLE Tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type type_tiers NOT NULL,
  contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index sur le type pour filtrage rapide Clients / Fournisseurs
CREATE INDEX idx_tiers_type ON Tiers (type);

-- 3. TABLE ACHATS
-- ============================================================

CREATE TABLE Achats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  fournisseur_id UUID NOT NULL REFERENCES Tiers(id) ON DELETE RESTRICT,
  quantite_tonnes NUMERIC(10, 3) NOT NULL CHECK (quantite_tonnes > 0),
  prix_unitaire NUMERIC(12, 2) NOT NULL CHECK (prix_unitaire >= 0),
  mode_paiement mode_paiement NOT NULL DEFAULT 'Espèces',
  statut_paiement statut_paiement NOT NULL DEFAULT 'Payé',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les recherches par fournisseur et par date
CREATE INDEX idx_achats_fournisseur ON Achats (fournisseur_id);
CREATE INDEX idx_achats_date ON Achats (date DESC);

-- 4. TABLE FRAIS_ANNEXES
-- ============================================================

CREATE TABLE Frais_Annexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id UUID NOT NULL REFERENCES Achats(id) ON DELETE CASCADE,
  type_frais type_frais NOT NULL,
  montant NUMERIC(12, 2) NOT NULL CHECK (montant >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour retrouver les frais d'un achat rapidement
CREATE INDEX idx_frais_annexes_achat ON Frais_Annexes (achat_id);

-- 5. TABLE MOUVEMENTS_STOCK
-- ============================================================

CREATE TABLE Mouvements_Stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type type_mouvement_stock NOT NULL,
  quantite NUMERIC(10, 3) NOT NULL CHECK (quantite > 0),
  cause_perte cause_perte,
  reference_id UUID,       -- ID de l'achat (Entrée) ou vente (Sortie) lié
  reference_type TEXT,     -- 'Achat', 'Vente', ou NULL pour perte manuelle
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les calculs de stock (somme par type)
CREATE INDEX idx_mouvements_stock_type ON Mouvements_Stock (type);

-- 6. TABLE VENTES
-- ============================================================

CREATE TABLE Ventes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID NOT NULL REFERENCES Tiers(id) ON DELETE RESTRICT,
  quantite NUMERIC(10, 3) NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC(12, 2) NOT NULL CHECK (prix_unitaire >= 0),
  mode_encaissement mode_paiement NOT NULL DEFAULT 'Espèces',
  statut_paiement statut_paiement NOT NULL DEFAULT 'En attente',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les recherches par client et par date
CREATE INDEX idx_ventes_client ON Ventes (client_id);
CREATE INDEX idx_ventes_date ON Ventes (date DESC);

-- 7. TABLE MOUVEMENTS_CAISSE
-- ============================================================

CREATE TABLE Mouvements_Caisse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type_compte type_compte NOT NULL,
  type_mouvement type_mouvement_caisse NOT NULL,
  montant NUMERIC(12, 2) NOT NULL CHECK (montant >= 0),
  reference_id UUID,         -- ID de l'achat ou vente lié
  reference_type TEXT,       -- 'Achat', 'Vente', 'Paiement'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les calculs de solde par type de compte
CREATE INDEX idx_mouvements_caisse_compte ON Mouvements_Caisse (type_compte);

-- 8. TRIGGER: Mise à jour automatique de updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tiers_updated_at
  BEFORE UPDATE ON Tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_achats_updated_at
  BEFORE UPDATE ON Achats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_ventes_updated_at
  BEFORE UPDATE ON Ventes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. VUE: Stock Physique Actuel
-- ============================================================

CREATE OR REPLACE VIEW stock_actuel AS
SELECT
  COALESCE(SUM(CASE WHEN type = 'Entrée' THEN quantite ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN type IN ('Sortie', 'Perte') THEN quantite ELSE 0 END), 0) AS stock_tonnes
FROM Mouvements_Stock;

-- 10. ACTIVATION RLS (Row Level Security)
-- ============================================================

ALTER TABLE Tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE Achats ENABLE ROW LEVEL SECURITY;
ALTER TABLE Frais_Annexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE Mouvements_Stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE Ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE Mouvements_Caisse ENABLE ROW LEVEL SECURITY;

-- Politiques pour les Agents (lecture et insertion uniquement)
CREATE POLICY "Agents peuvent lire Tiers" ON Tiers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Agents peuvent inserer Tiers" ON Tiers
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents peuvent lire Achats" ON Achats
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Agents peuvent inserer Achats" ON Achats
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents peuvent lire Frais_Annexes" ON Frais_Annexes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Agents peuvent inserer Frais_Annexes" ON Frais_Annexes
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents peuvent lire Mouvements_Stock" ON Mouvements_Stock
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Agents peuvent inserer Mouvements_Stock" ON Mouvements_Stock
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents peuvent lire Ventes" ON Ventes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Agents peuvent inserer Ventes" ON Ventes
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents peuvent lire Mouvements_Caisse" ON Mouvements_Caisse
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Agents peuvent inserer Mouvements_Caisse" ON Mouvements_Caisse
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Politiques pour les Admins (tous droits)
-- Note: Les Admins sont identifiés via user_metadata.role = 'Admin'
CREATE POLICY "Admins peuvent modifier Tiers" ON Tiers
  FOR UPDATE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin')
  WITH CHECK ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Admins peuvent supprimer Tiers" ON Tiers
  FOR DELETE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Admins peuvent modifier Achats" ON Achats
  FOR UPDATE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin')
  WITH CHECK ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Admins peuvent supprimer Achats" ON Achats
  FOR DELETE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Admins peuvent modifier Ventes" ON Ventes
  FOR UPDATE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin')
  WITH CHECK ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Admins peuvent supprimer Ventes" ON Ventes
  FOR DELETE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Admins peuvent supprimer Mouvements_Caisse" ON Mouvements_Caisse
  FOR DELETE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

-- ============================================================
-- Fin de la migration Phase 2
-- ============================================================