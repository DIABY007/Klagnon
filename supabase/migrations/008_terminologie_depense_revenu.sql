-- ============================================================
-- Migration: Terminologie UI — dépense / revenu
-- Application: Klagnon — Gestion Financière Agricole
-- ============================================================
-- Contexte : l'interface utilise désormais « dépense » et
--            « revenu » à la place de « achat » et « vente ».
--            Ce script aligne les textes générés côté SQL.
--
-- Note : les noms de tables, colonnes, vues et fonctions
--        (Achats, Ventes, enregistrer_paiement_vente...) sont
--        conservés — seul le texte affiché à l'utilisateur change.
-- ============================================================


-- ============================================================
-- PARTIE 1 : RPC enregistrer_paiement_vente
-- ------------------------------------------------------------
-- Reprend la définition de la migration 004, avec deux changements :
--   1. Description du mouvement de caisse :
--      « Paiement final pour vente #xxx »  ->  « ... pour revenu #xxx »
--   2. BUGFIX : « p_mode_paiement::type_compte » échouait pour la
--      valeur « Espèces » (absente de l'enum type_compte, qui ne
--      contient que 'Caisse' et 'MoMo'). Le RPC échouait donc
--      silencieusement et l'app retombait sur le chemin de repli.
--      Même mapping que le reste du code : Espèces -> Caisse.
-- ============================================================

CREATE OR REPLACE FUNCTION enregistrer_paiement_vente(
  p_vente_id UUID,
  p_montant NUMERIC,
  p_mode_paiement TEXT DEFAULT 'Espèces'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    RAISE EXCEPTION 'Revenu introuvable'
      USING HINT = 'Vérifiez l''ID du revenu.';
  END IF;

  -- 2. Calculer le total déjà payé
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
    CASE WHEN p_mode_paiement = 'MoMo' THEN 'MoMo'::type_compte ELSE 'Caisse'::type_compte END,
    'Entrée',
    p_montant,
    p_vente_id,
    'Paiement',
    'Paiement ' || CASE
      WHEN (v_total_paye + p_montant) >= v_montant_total THEN 'final'
      ELSE 'partiel'
    END || ' pour revenu #' || substring(p_vente_id::TEXT, 1, 8)
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
-- PARTIE 2 (optionnelle) : normaliser le TEXTE de l'historique
-- ------------------------------------------------------------
-- Met à jour les descriptions/notes des mouvements DÉJÀ
-- enregistrés pour qu'ils s'affichent avec le nouveau
-- vocabulaire. Aucun montant, aucune date, aucune référence
-- et aucun identifiant ne sont modifiés.
--
-- Si vous préférez conserver l'historique tel quel,
-- supprimez cette partie avant d'exécuter le script.
-- ============================================================

-- Trésorerie : « Paiement final/partiel pour vente #xxx »
UPDATE Mouvements_Caisse
SET description = REPLACE(description, ' pour vente #', ' pour revenu #')
WHERE description LIKE '% pour vente #%';

-- Trésorerie : « Encaissement vente du ... » (anciennes ventes)
UPDATE Mouvements_Caisse
SET description = REPLACE(description, 'Encaissement vente du ', 'Encaissement revenu du ')
WHERE description LIKE 'Encaissement vente du %';

-- Trésorerie : « Paiement achat du ... » (anciens achats)
UPDATE Mouvements_Caisse
SET description = REPLACE(description, 'Paiement achat du ', 'Paiement dépense du ')
WHERE description LIKE 'Paiement achat du %';

-- Stock : notes « Sortie liée à la vente du ... »
UPDATE Mouvements_Stock
SET notes = REPLACE(notes, 'Sortie liée à la vente du ', 'Sortie liée au revenu du ')
WHERE notes LIKE 'Sortie liée à la vente du %';

-- Stock : notes « Entrée liée à l'achat du ... »
UPDATE Mouvements_Stock
SET notes = REPLACE(notes, 'Entrée liée à l''achat du ', 'Entrée liée à la dépense du ')
WHERE notes LIKE 'Entrée liée à l''achat du %';


-- ============================================================
-- VÉRIFICATION : doit renvoyer 0 ligne
-- ============================================================

SELECT 'mouvements_caisse' AS table_cible, description AS texte, COUNT(*) AS nb
FROM Mouvements_Caisse
WHERE description ILIKE '%achat%' OR description ILIKE '%vente%'
GROUP BY description
UNION ALL
SELECT 'mouvements_stock', notes, COUNT(*)
FROM Mouvements_Stock
WHERE notes ILIKE '%achat%' OR notes ILIKE '%vente%'
GROUP BY notes;

-- ============================================================
-- Fin de la migration
-- ============================================================
