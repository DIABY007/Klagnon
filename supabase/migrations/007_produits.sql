-- ============================================================
-- Migration: Module Produits
-- Application: Klagnon — Gestion Financière Agricole
-- ============================================================

-- 1. TABLE PRODUITS
-- ============================================================

CREATE TABLE Produits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  unite TEXT NOT NULL DEFAULT 'Tonnes',
  prix_achat_recommande NUMERIC(12, 2),
  prix_vente_recommande NUMERIC(12, 2),
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_produits_nom ON Produits (nom);
CREATE INDEX idx_produits_actif ON Produits (actif);

-- Trigger updated_at
CREATE TRIGGER trigger_produits_updated_at
  BEFORE UPDATE ON Produits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. AJOUT DE produit_id DANS LES TABLES EXISTANTES
-- ============================================================

ALTER TABLE Achats ADD COLUMN produit_id UUID REFERENCES Produits(id) ON DELETE RESTRICT;
CREATE INDEX idx_achats_produit ON Achats (produit_id);

ALTER TABLE Ventes ADD COLUMN produit_id UUID REFERENCES Produits(id) ON DELETE RESTRICT;
CREATE INDEX idx_ventes_produit ON Ventes (produit_id);

ALTER TABLE Mouvements_Stock ADD COLUMN produit_id UUID REFERENCES Produits(id) ON DELETE RESTRICT;
CREATE INDEX idx_mouvements_stock_produit ON Mouvements_Stock (produit_id);

-- 3. MISE À JOUR DES RPC
-- ============================================================

-- RPC : Achat avec produit_id
DROP FUNCTION IF EXISTS enregistrer_achat_complet(date, uuid, numeric, numeric, text, text, jsonb);

CREATE OR REPLACE FUNCTION enregistrer_achat_complet(
  p_date DATE,
  p_fournisseur_id UUID,
  p_quantite_tonnes NUMERIC,
  p_prix_unitaire NUMERIC,
  p_mode_paiement TEXT DEFAULT 'Espèces',
  p_notes TEXT DEFAULT NULL,
  p_frais JSONB DEFAULT '[]'::JSONB,
  p_produit_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_achat_id UUID; v_frais JSONB; v_compte TEXT;
BEGIN
  INSERT INTO Achats (date, fournisseur_id, quantite_tonnes, prix_unitaire, mode_paiement, notes, produit_id)
  VALUES (p_date, p_fournisseur_id, p_quantite_tonnes, p_prix_unitaire, p_mode_paiement::public.mode_paiement, p_notes, p_produit_id)
  RETURNING id INTO v_achat_id;
  FOR v_frais IN SELECT * FROM jsonb_array_elements(p_frais) LOOP
    INSERT INTO Frais_Annexes (achat_id, type_frais, montant, description)
    VALUES (v_achat_id, (v_frais->>'type_frais')::public.type_frais, (v_frais->>'montant')::NUMERIC, v_frais->>'description');
  END LOOP;
  INSERT INTO Mouvements_Stock (date, type, quantite, reference_id, reference_type, notes, produit_id)
  VALUES (p_date, 'Entrée', p_quantite_tonnes, v_achat_id, 'Achat', '', p_produit_id);
  v_compte := CASE WHEN p_mode_paiement = 'Espèces' THEN 'Caisse' ELSE 'MoMo' END;
  INSERT INTO Mouvements_Caisse (date, type_compte, type_mouvement, montant, reference_id, reference_type, description)
  VALUES (p_date, v_compte::public.type_compte, 'Sortie', p_quantite_tonnes * p_prix_unitaire, v_achat_id, 'Achat', '');
  RETURN v_achat_id;
END; $$;

-- RPC : Vente avec produit_id
DROP FUNCTION IF EXISTS enregistrer_vente_complet(date, uuid, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION enregistrer_vente_complet(
  p_date DATE,
  p_client_id UUID,
  p_quantite NUMERIC,
  p_prix_unitaire NUMERIC,
  p_mode_encaissement TEXT DEFAULT 'Espèces',
  p_notes TEXT DEFAULT NULL,
  p_produit_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_vente_id UUID; v_stock_actuel NUMERIC; v_montant_total NUMERIC; v_compte TEXT;
BEGIN
  SELECT COALESCE(stock_tonnes, 0) INTO v_stock_actuel FROM stock_actuel;
  IF v_stock_actuel < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible : %, demandé : %', v_stock_actuel, p_quantite;
  END IF;
  INSERT INTO Ventes (date, client_id, quantite, prix_unitaire, mode_encaissement, statut_paiement, notes, produit_id)
  VALUES (p_date, p_client_id, p_quantite, p_prix_unitaire, p_mode_encaissement::public.mode_paiement, 'Payé', p_notes, p_produit_id)
  RETURNING id INTO v_vente_id;
  INSERT INTO Mouvements_Stock (date, type, quantite, reference_id, reference_type, notes, produit_id)
  VALUES (p_date, 'Sortie', p_quantite, v_vente_id, 'Vente', '', p_produit_id);
  v_montant_total := p_quantite * p_prix_unitaire;
  v_compte := CASE WHEN p_mode_encaissement = 'Espèces' THEN 'Caisse' ELSE 'MoMo' END;
  INSERT INTO Mouvements_Caisse (date, type_compte, type_mouvement, montant, reference_id, reference_type, description)
  VALUES (p_date, v_compte::public.type_compte, 'Entrée', v_montant_total, v_vente_id, 'Vente', '');
  RETURN JSONB_BUILD_OBJECT('success', TRUE, 'vente_id', v_vente_id, 'montant_total', v_montant_total);
END; $$;

-- 4. VUE : Achats avec infos produit
-- ============================================================

DROP VIEW IF EXISTS vue_achats_cru;
CREATE OR REPLACE VIEW vue_achats_cru AS
SELECT
  a.id,
  a.date,
  t.nom AS fournisseur,
  t.id AS fournisseur_id,
  a.quantite_tonnes,
  a.prix_unitaire,
  (a.quantite_tonnes * a.prix_unitaire) AS montant_achat,
  COALESCE(SUM(f.montant), 0) AS total_frais,
  (a.quantite_tonnes * a.prix_unitaire) + COALESCE(SUM(f.montant), 0) AS cout_total,
  CASE WHEN a.quantite_tonnes > 0 THEN
    ((a.quantite_tonnes * a.prix_unitaire) + COALESCE(SUM(f.montant), 0)) / a.quantite_tonnes
    ELSE 0 END AS cru_unitaire,
  a.mode_paiement,
  a.statut_paiement,
  p.nom AS produit_nom,
  p.id AS produit_id
FROM Achats a
JOIN Tiers t ON t.id = a.fournisseur_id
LEFT JOIN Frais_Annexes f ON f.achat_id = a.id
LEFT JOIN Produits p ON p.id = a.produit_id
GROUP BY a.id, t.nom, t.id, p.nom, p.id;

-- 5. RLS
-- ============================================================

ALTER TABLE Produits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents peuvent lire Produits" ON Produits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Agents peuvent inserer Produits" ON Produits
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins peuvent modifier Produits" ON Produits
  FOR UPDATE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin')
  WITH CHECK ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Admins peuvent supprimer Produits" ON Produits
  FOR DELETE TO authenticated
  USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'Admin');

-- ============================================================
-- Fin de la migration
-- ============================================================