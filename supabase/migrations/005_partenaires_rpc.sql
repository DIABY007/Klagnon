-- ============================================================
-- Migration: Module Partenaires (Fournisseurs & Clients)
-- Application: Klagnon — Gestion Financière Agricole
-- ============================================================

-- 1. RPC : Modifier un tiers (fournisseur ou client)
CREATE OR REPLACE FUNCTION modifier_tiers(
  p_id UUID,
  p_nom TEXT,
  p_type type_tiers,
  p_contact TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Vérifier que le tiers existe
  IF NOT EXISTS (SELECT 1 FROM Tiers WHERE id = p_id) THEN
    RAISE EXCEPTION 'Tiers introuvable' USING HINT = 'ID invalide.';
  END IF;

  -- Mise à jour
  UPDATE Tiers
  SET nom = p_nom,
      type = p_type,
      contact = p_contact,
      updated_at = now()
  WHERE id = p_id;

  RETURN JSONB_BUILD_OBJECT(
    'success', TRUE,
    'id', p_id
  );
END;
$$;

-- 2. RPC : Supprimer un tiers
CREATE OR REPLACE FUNCTION supprimer_tiers(
  p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_type type_tiers;
BEGIN
  -- Vérifier que le tiers existe et récupérer son type
  SELECT type INTO v_type FROM Tiers WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tiers introuvable' USING HINT = 'ID invalide.';
  END IF;

  -- Vérifier qu'il n'a pas d'achats ou ventes liés
  IF v_type = 'Fournisseur' AND EXISTS (SELECT 1 FROM Achats WHERE fournisseur_id = p_id) THEN
    RAISE EXCEPTION 'Impossible de supprimer : ce fournisseur a des achats liés'
      USING HINT = 'Supprimez d''abord les achats associés.';
  END IF;

  IF v_type = 'Client' AND EXISTS (SELECT 1 FROM Ventes WHERE client_id = p_id) THEN
    RAISE EXCEPTION 'Impossible de supprimer : ce client a des ventes liées'
      USING HINT = 'Supprimez d''abord les ventes associées.';
  END IF;

  -- Suppression
  DELETE FROM Tiers WHERE id = p_id;

  RETURN JSONB_BUILD_OBJECT(
    'success', TRUE,
    'id', p_id
  );
END;
$$;

-- ============================================================
-- Fin de la migration
-- ============================================================