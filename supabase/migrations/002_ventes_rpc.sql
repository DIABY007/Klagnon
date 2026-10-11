-- ============================================================
-- Migration: Phase 5 — Module de Vente et Facturation
-- Application: Klagnon — Gestion Financière Agricole
-- ============================================================

-- 1. VUE DÉTAILLÉE DES VENTES
-- ============================================================

CREATE OR REPLACE VIEW vue_ventes_details AS
SELECT
  v.id,
  v.date,
  v.client_id,
  t.nom AS client_nom,
  t.contact AS client_contact,
  v.quantite,
  v.prix_unitaire,
  v.mode_encaissement,
  v.statut_paiement,
  v.notes,
  (v.quantite * v.prix_unitaire) AS montant_total,
  v.created_at
FROM Ventes v
JOIN Tiers t ON t.id = v.client_id;

-- VUE: Stock disponible (alias plus parlant)
CREATE OR REPLACE VIEW stock_disponible AS
SELECT
  COALESCE(SUM(CASE WHEN type = 'Entrée' THEN quantite ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN type IN ('Sortie', 'Perte') THEN quantite ELSE 0 END), 0) AS stock_tonnes
FROM Mouvements_Stock;

-- 2. FONCTION RPC : Enregistrer une vente complète
-- ============================================================

CREATE OR REPLACE FUNCTION enregistrer_vente_complet(
  p_date DATE,
  p_client_id UUID,
  p_quantite NUMERIC,
  p_prix_unitaire NUMERIC,
  p_mode_encaissement mode_paiement,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vente_id UUID;
  v_stock_actuel NUMERIC;
  v_montant_total NUMERIC;
BEGIN
  -- 1. Vérifier le stock disponible
  SELECT COALESCE(stock_tonnes, 0) INTO v_stock_actuel
  FROM stock_disponible;

  IF v_stock_actuel < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible : %, demandé : %', v_stock_actuel, p_quantite
      USING HINT = 'Veuillez réduire la quantité ou approvisionner le stock.';
  END IF;

  -- 2. Insérer la vente
  INSERT INTO Ventes (date, client_id, quantite, prix_unitaire, mode_encaissement, notes)
  VALUES (p_date, p_client_id, p_quantite, p_prix_unitaire, p_mode_encaissement, p_notes)
  RETURNING id INTO v_vente_id;

  -- 3. Mouvement de stock (Sortie)
  INSERT INTO Mouvements_Stock (date, type, quantite, reference_id, reference_type, notes)
  VALUES (p_date, 'Sortie', p_quantite, v_vente_id, 'Vente',
          'Sortie liée à la vente du ' || p_date);

  -- 4. Mouvement de caisse (Entrée)
  v_montant_total := p_quantite * p_prix_unitaire;

  INSERT INTO Mouvements_Caisse (date, type_compte, type_mouvement, montant, reference_id, reference_type, description)
  VALUES (p_date, p_mode_encaissement::type_compte, 'Entrée', v_montant_total, v_vente_id, 'Vente',
          'Encaissement vente du ' || p_date);

  -- 5. Retourner le résultat
  RETURN JSONB_BUILD_OBJECT(
    'success', TRUE,
    'vente_id', v_vente_id,
    'montant_total', v_montant_total
  );
END;
$$;

-- 3. FONCTION RPC : Vérifier le stock disponible (utilitaire côté client)
-- ============================================================

CREATE OR REPLACE FUNCTION verifier_stock_disponible()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stock NUMERIC;
BEGIN
  SELECT COALESCE(stock_tonnes, 0) INTO v_stock
  FROM stock_disponible;

  RETURN v_stock;
END;
$$;

-- ============================================================
-- Fin de la migration Phase 5
-- ============================================================