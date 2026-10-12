-- ============================================================
-- Migration corrective : SET search_path des RPCs
-- Application: Klagnon — Gestion Financière Agricole
-- ============================================================
-- Cause : Les RPCs avec SET search_path = '' ne trouvent
--         pas les tables du schema public (erreur 42P01).
-- Fix   : Remplacer par SET search_path = 'public'
-- ============================================================

-- 1. RPC : Enregistrer une vente complète
CREATE OR REPLACE FUNCTION enregistrer_vente_complet(
  p_date DATE,
  p_client_id UUID,
  p_quantite NUMERIC,
  p_prix_unitaire NUMERIC,
  p_mode_encaissement TEXT DEFAULT 'Espèces',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_vente_id UUID;
  v_stock_actuel NUMERIC;
  v_montant_total NUMERIC;
BEGIN
  -- 1. Vérifier le stock disponible
  SELECT COALESCE(stock_tonnes, 0) INTO v_stock_actuel
  FROM stock_actuel;

  IF v_stock_actuel < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible : %, demandé : %', v_stock_actuel, p_quantite
      USING HINT = 'Veuillez réduire la quantité ou approvisionner le stock.';
  END IF;

  -- 2. Insérer la vente
  INSERT INTO Ventes (date, client_id, quantite, prix_unitaire, mode_encaissement, notes)
  VALUES (p_date, p_client_id, p_quantite, p_prix_unitaire, p_mode_encaissement::public.mode_paiement, p_notes)
  RETURNING id INTO v_vente_id;

  -- 3. Mouvement de stock (Sortie)
  INSERT INTO Mouvements_Stock (date, type, quantite, reference_id, reference_type, notes)
  VALUES (p_date, 'Sortie', p_quantite, v_vente_id, 'Vente',
          'Sortie liée à la vente du ' || p_date);

  -- 4. Mouvement de caisse (Entrée)
  v_montant_total := p_quantite * p_prix_unitaire;

  INSERT INTO Mouvements_Caisse (date, type_compte, type_mouvement, montant, reference_id, reference_type, description)
  VALUES (p_date, p_mode_encaissement::public.type_compte, 'Entrée', v_montant_total, v_vente_id, 'Vente',
          'Encaissement vente du ' || p_date);

  -- 5. Retourner le résultat
  RETURN JSONB_BUILD_OBJECT(
    'success', TRUE,
    'vente_id', v_vente_id,
    'montant_total', v_montant_total
  );
END;
$$;

-- 2. Vérifier le stock disponible
CREATE OR REPLACE FUNCTION verifier_stock_disponible()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_stock NUMERIC;
BEGIN
  SELECT COALESCE(stock_tonnes, 0) INTO v_stock
  FROM stock_actuel;

  RETURN v_stock;
END;
$$;

-- 3. RPC : Enregistrer un achat complet
-- (si besoin, même correction)
CREATE OR REPLACE FUNCTION enregistrer_achat_complet(
  p_date DATE,
  p_fournisseur_id UUID,
  p_quantite_tonnes NUMERIC,
  p_prix_unitaire NUMERIC,
  p_mode_paiement TEXT DEFAULT 'Espèces',
  p_notes TEXT DEFAULT NULL,
  p_frais JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_achat_id UUID;
  v_frais JSONB;
BEGIN
  -- 1. Insérer l'achat
  INSERT INTO Achats (date, fournisseur_id, quantite_tonnes, prix_unitaire, mode_paiement, notes)
  VALUES (p_date, p_fournisseur_id, p_quantite_tonnes, p_prix_unitaire, p_mode_paiement::public.mode_paiement, p_notes)
  RETURNING id INTO v_achat_id;

  -- 2. Insérer les frais annexes
  FOR v_frais IN SELECT * FROM jsonb_array_elements(p_frais)
  LOOP
    INSERT INTO Frais_Annexes (achat_id, type_frais, montant, description)
    VALUES (
      v_achat_id,
      (v_frais->>'type_frais')::public.type_frais,
      (v_frais->>'montant')::NUMERIC,
      v_frais->>'description'
    );
  END LOOP;

  -- 3. Mouvement de stock (Entrée)
  INSERT INTO Mouvements_Stock (date, type, quantite, reference_id, reference_type, notes)
  VALUES (p_date, 'Entrée', p_quantite_tonnes, v_achat_id, 'Achat',
          'Entrée liée à l''achat du ' || p_date);

  -- 4. Mouvement de caisse (Sortie)
  INSERT INTO Mouvements_Caisse (date, type_compte, type_mouvement, montant, reference_id, reference_type, description)
  VALUES (p_date, p_mode_paiement::public.type_compte, 'Sortie',
          p_quantite_tonnes * p_prix_unitaire, v_achat_id, 'Achat',
          'Paiement achat du ' || p_date);

  RETURN v_achat_id;
END;
$$;

-- ============================================================
-- Fin de la migration corrective
-- ============================================================