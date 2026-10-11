-- ============================================================
-- Migration: Phase 6 — Trésorerie et Suivi des Créances
-- Application: Klagnon — Gestion Financière Agricole
-- ============================================================

-- VUE: Solde par type de compte
CREATE OR REPLACE VIEW soldes_comptes AS
SELECT
  type_compte,
  COALESCE(SUM(CASE WHEN type_mouvement = 'Entrée' THEN montant ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN type_mouvement = 'Sortie' THEN montant ELSE 0 END), 0) AS solde
FROM Mouvements_Caisse
GROUP BY type_compte;

-- FONCTION RPC : Enregistrer un paiement sur une vente existante
CREATE OR REPLACE FUNCTION enregistrer_paiement_vente(
  p_vente_id UUID,
  p_montant NUMERIC,
  p_mode_paiement TEXT DEFAULT 'Espèces'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vente RECORD;
  v_total_paye NUMERIC;
  v_montant_total NUMERIC;
  v_nouveau_statut statut_paiement;
BEGIN
  -- 1. Récupérer la vente
  SELECT * INTO v_vente FROM Ventes WHERE id = p_vente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable' USING HINT = 'Vérifiez l''ID de la vente.';
  END IF;

  -- 2. Calculer le total déjà payé (via Mouvements_Caisse)
  SELECT COALESCE(SUM(montant), 0)
  INTO v_total_paye
  FROM Mouvements_Caisse
  WHERE reference_id = p_vente_id
    AND reference_type = 'Paiement'
    AND type_mouvement = 'Entrée';

  -- 3. Montant total de la vente
  v_montant_total := v_vente.quantite * v_vente.prix_unitaire;

  -- 4. Vérifier que le paiement ne dépasse pas le restant dû
  IF p_montant > (v_montant_total - v_total_paye) THEN
    RAISE EXCEPTION 'Le montant du paiement dépasse le restant dû. Restant : % FCFA',
      (v_montant_total - v_total_paye);
  END IF;

  -- 5. Insérer le mouvement de caisse
  INSERT INTO Mouvements_Caisse (
    date, type_compte, type_mouvement, montant,
    reference_id, reference_type, description
  )
  VALUES (
    CURRENT_DATE,
    p_mode_paiement::type_compte,
    'Entrée',
    p_montant,
    p_vente_id,
    'Paiement',
    'Paiement ' || CASE
      WHEN p_montant >= (v_montant_total - v_total_paye - p_montant) THEN 'final'
      ELSE 'partiel'
    END || ' pour vente #' || p_vente_id::TEXT
  );

  -- 6. Déterminer le nouveau statut
  IF (v_total_paye + p_montant) >= v_montant_total THEN
    v_nouveau_statut := 'Payé';
  ELSE
    v_nouveau_statut := 'Partiel';
  END IF;

  -- 7. Mettre à jour le statut de la vente
  UPDATE Ventes
  SET statut_paiement = v_nouveau_statut,
      updated_at = now()
  WHERE id = p_vente_id;

  -- 8. Retourner le résultat
  RETURN JSONB_BUILD_OBJECT(
    'success', TRUE,
    'vente_id', p_vente_id,
    'montant_paye', p_montant,
    'total_paye', v_total_paye + p_montant,
    'reste', GREATEST(v_montant_total - (v_total_paye + p_montant), 0),
    'nouveau_statut', v_nouveau_statut
  );
END;
$$;

-- ============================================================
-- Fin de la migration Phase 6
-- ============================================================