"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Wallet,
  Smartphone,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Banknote,
  HandCoins,
  Percent,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface MouvementCaisse {
  id: string;
  date: string;
  type_compte: "Caisse" | "MoMo";
  type_mouvement: "Entrée" | "Sortie";
  montant: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

interface VenteAvecClient {
  id: string;
  date: string;
  quantite: number;
  prix_unitaire: number;
  montant_total: number;
  mode_encaissement: string;
  statut_paiement: string;
  notes: string | null;
  tiers: { nom: string; contact: string | null } | null;
  total_payes?: number;
}

interface CreanceDisplay {
  id: string;
  date: string;
  client_nom: string;
  quantite: number;
  montant_total: number;
  montant_paye: number;
  reste: number;
  statut: string;
  mode_encaissement: string;
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

type Onglet = "Caisse" | "MoMo" | "Creances";

export default function TresoreriePage() {
  const [mouvements, setMouvements] = useState<MouvementCaisse[]>([]);
  const [creances, setCreances] = useState<CreanceDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [ongletActif, setOngletActif] = useState<Onglet>("Caisse");

  /* État du dialogue de paiement */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCreance, setSelectedCreance] = useState<CreanceDisplay | null>(null);
  const [montantPaiement, setMontantPaiement] = useState("");
  const [modePaiement, setModePaiement] = useState("Espèces");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      // Charger les mouvements de caisse
      const [caisseRes, ventesRes] = await Promise.allSettled([
        supabase
          .from("mouvements_caisse")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("ventes")
          .select("*, tiers:client_id(nom, contact)")
          .in("statut_paiement", ["En attente", "Partiel"])
          .order("date", { ascending: false }),
      ]);

      if (caisseRes.status === "fulfilled" && caisseRes.value.data) {
        setMouvements(caisseRes.value.data as MouvementCaisse[]);
      }

      if (ventesRes.status === "fulfilled" && ventesRes.value.data) {
        const rows = ventesRes.value.data as unknown as VenteAvecClient[];
        const ventesAvecPaiements = rows.map((v) => {
          const total = Number(v.quantite) * Number(v.prix_unitaire);
          // Calculer le montant déjà payé à partir des mouvements de caisse
          const paye = caisseRes.status === "fulfilled" && caisseRes.value.data
            ? (caisseRes.value.data as MouvementCaisse[])
                .filter((m) => m.reference_id === v.id && m.type_mouvement === "Entrée")
                .reduce((sum, m) => sum + Number(m.montant), 0)
            : 0;

          return {
            id: v.id,
            date: v.date,
            client_nom: v.tiers?.nom ?? "Client supprimé",
            quantite: Number(v.quantite),
            montant_total: total,
            montant_paye: paye,
            reste: total - paye,
            statut: v.statut_paiement,
            mode_encaissement: v.mode_encaissement,
          };
        });
        setCreances(ventesAvecPaiements);
      }
    } catch (err) {
      console.error("Erreur lors du chargement :", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Calcul des soldes */
  const soldeCaisse = mouvements
    .filter((m) => m.type_compte === "Caisse")
    .reduce((acc, m) => {
      return acc + (m.type_mouvement === "Entrée" ? Number(m.montant) : -Number(m.montant));
    }, 0);

  const soldeMoMo = mouvements
    .filter((m) => m.type_compte === "MoMo")
    .reduce((acc, m) => {
      return acc + (m.type_mouvement === "Entrée" ? Number(m.montant) : -Number(m.montant));
    }, 0);

  const totalEncaisse = mouvements
    .filter((m) => m.type_mouvement === "Entrée")
    .reduce((acc, m) => acc + Number(m.montant), 0);

  const totalDepense = mouvements
    .filter((m) => m.type_mouvement === "Sortie")
    .reduce((acc, m) => acc + Number(m.montant), 0);

  /* Mouvements filtrés par onglet Caisse/MoMo */
  const mouvementsFiltres = mouvements.filter(
    (m) => m.type_compte === ongletActif
  );

  const soldeActif = ongletActif === "Caisse" ? soldeCaisse : soldeMoMo;

  const entrees = mouvementsFiltres
    .filter((m) => m.type_mouvement === "Entrée")
    .reduce((acc, m) => acc + Number(m.montant), 0);

  const sorties = mouvementsFiltres
    .filter((m) => m.type_mouvement === "Sortie")
    .reduce((acc, m) => acc + Number(m.montant), 0);

  /* Enregistrement de paiement */
  const handleEnregistrerPaiement = async () => {
    if (!selectedCreance) return;

    const montant = parseFloat(montantPaiement);
    if (isNaN(montant) || montant <= 0) {
      toast.error("Veuillez entrer un montant valide");
      return;
    }

    if (montant > selectedCreance.reste) {
      toast.error(
        `Le montant dépasse le restant dû (${selectedCreance.reste.toLocaleString("fr-FR")} FCFA)`
      );
      return;
    }

    setSubmitting(true);

    try {
      // Étape 1 : Essayer d'utiliser le RPC (disponible après migration SQL)
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "enregistrer_paiement_vente",
        {
          p_vente_id: selectedCreance.id,
          p_montant: montant,
          p_mode_paiement: modePaiement,
        }
      );

      if (!rpcError && rpcResult) {
        // Succès via RPC
        const result = rpcResult as {
          success: boolean;
          nouveau_statut: string;
          reste: number;
        };
        toast.success(
          `Paiement enregistré. Statut : ${result.nouveau_statut}. Restant : ${Number(result.reste).toLocaleString("fr-FR")} FCFA`
        );
        setDialogOpen(false);
        resetForm();
        await loadData();
        return;
      }

      // Étape 2 : Fallback — approche directe (si RPC pas encore créé)
      // 2a. Insérer le mouvement de caisse
      const { error: caisseError } = await supabase.from("mouvements_caisse").insert({
        date: new Date().toISOString().split("T")[0],
        type_compte: modePaiement === "MoMo" ? "MoMo" : "Caisse",
        type_mouvement: "Entrée",
        montant,
        reference_id: selectedCreance.id,
        reference_type: "Paiement",
        description: `Paiement vente #${selectedCreance.id.slice(0, 6)}`,
      });

      if (caisseError) {
        toast.error(`Erreur caisse : ${caisseError.message}`);
        return;
      }

      // 2b. Mettre à jour le statut de la vente (peut échouer pour les Agents)
      const nouveauStatut = montant >= selectedCreance.reste ? "Payé" : "Partiel";
      const { error: venteError } = await supabase
        .from("ventes")
        .update({ statut_paiement: nouveauStatut })
        .eq("id", selectedCreance.id);

      if (venteError) {
        // L'update échoue pour les Agents (RLS). Le paiement est enregistré,
        // mais le statut doit être mis à jour par un Admin.
        toast.success(
          `Paiement de ${montant.toLocaleString("fr-FR")} FCFA enregistré (caisse)`
        );
        toast.warning(
          "Le statut de la vente n'a pas pu être mis à jour — " +
          "un Admin doit le confirmer ou exécuter la migration SQL (étape 6)."
        );
        setDialogOpen(false);
        resetForm();
        await loadData();
        return;
      }

      toast.success(
        `Paiement de ${montant.toLocaleString("fr-FR")} FCFA enregistré avec succès`
      );
      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error("Erreur paiement :", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  function resetForm() {
    setSelectedCreance(null);
    setMontantPaiement("");
    setModePaiement("Espèces");
  }

  const totalCreances = creances.reduce((sum, c) => sum + c.reste, 0);

  /* Rendu */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" />
        Tableau de bord
      </Link>
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Trésorerie
        </h1>
        <p className="text-muted-foreground text-sm">
          Suivi des caisses, des encaissements et des créances
        </p>
      </div>

      {/* Cartes récapitulatives */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Caisse Physique</CardTitle>
            <Banknote className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {soldeCaisse.toLocaleString("fr-FR")} FCFA
            </div>
            <CardDescription>Solde espèces</CardDescription>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mobile Money</CardTitle>
            <Smartphone className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {soldeMoMo.toLocaleString("fr-FR")} FCFA
            </div>
            <CardDescription>Solde MoMo</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total encaissé</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalEncaisse.toLocaleString("fr-FR")} FCFA
            </div>
            <CardDescription>Toutes caisses</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total dépensé</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalDepense.toLocaleString("fr-FR")} FCFA
            </div>
            <CardDescription>Toutes caisses</CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center border-b border-border">
            <button
              onClick={() => setOngletActif("Caisse")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                ongletActif === "Caisse"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Banknote className="h-4 w-4" />
              Caisse Physique
            </button>
            <button
              onClick={() => setOngletActif("MoMo")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                ongletActif === "MoMo"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Mobile Money
            </button>
            <button
              onClick={() => setOngletActif("Creances")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                ongletActif === "Creances"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <HandCoins className="h-4 w-4" />
              Créances
              {creances.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {creances.length}
                </span>
              )}
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Onglet Caisse ou MoMo */}
          {ongletActif !== "Creances" && (
            <>
              {/* Résumé de l'onglet actif */}
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <Card className="bg-muted/30">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Solde actuel</p>
                    <p
                      className={`text-2xl font-bold ${
                        soldeActif >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {soldeActif.toLocaleString("fr-FR")} FCFA
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-950/20">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Entrées</p>
                    <p className="text-xl font-bold text-green-600">
                      +{entrees.toLocaleString("fr-FR")} FCFA
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 dark:bg-red-950/20">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Sorties</p>
                    <p className="text-xl font-bold text-red-600">
                      -{sorties.toLocaleString("fr-FR")} FCFA
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Historique */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  Historique des transactions
                </h3>

                {mouvementsFiltres.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Wallet className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Aucune transaction sur ce compte
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Référence</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mouvementsFiltres.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(m.date).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  m.type_mouvement === "Entrée"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {m.type_mouvement === "Entrée" ? (
                                  <>
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Entrée
                                  </>
                                ) : (
                                  <>
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Sortie
                                  </>
                                )}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {m.type_mouvement === "Entrée" ? (
                                <span className="text-green-600">
                                  +{Number(m.montant).toLocaleString("fr-FR")}
                                </span>
                              ) : (
                                <span className="text-red-600">
                                  -{Number(m.montant).toLocaleString("fr-FR")}
                                </span>
                              )}{" "}
                              FCFA
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {m.reference_type ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    {m.reference_type}
                                  </span>
                                  {m.reference_id && (
                                    <span className="text-xs font-mono text-muted-foreground">
                                      #{m.reference_id.slice(0, 6)}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {m.description ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Onglet Créances */}
          {ongletActif === "Creances" && (
            <>
              {/* Résumé créances */}
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <Card className="bg-muted/30">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Créances en cours</p>
                    <p className="text-2xl font-bold text-foreground">
                      {creances.length} vente{creances.length > 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50 dark:bg-amber-950/20">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Total restant dû</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {totalCreances.toLocaleString("fr-FR")} FCFA
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-950/20">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground mb-1">Total facturé</p>
                    <p className="text-xl font-bold text-green-600">
                      {creances
                        .reduce((sum, c) => sum + c.montant_total, 0)
                        .toLocaleString("fr-FR")}{" "}
                      FCFA
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tableau des créances */}
              {creances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <HandCoins className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Aucune créance en cours — toutes les ventes sont soldées
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Montant total</TableHead>
                        <TableHead className="text-right">Déjà payé</TableHead>
                        <TableHead className="text-right font-bold">Restant dû</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creances.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(c.date).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell>{c.client_nom}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.montant_total.toLocaleString("fr-FR")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-green-600">
                            {c.montant_paye.toLocaleString("fr-FR")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-bold text-amber-600">
                            {c.reste.toLocaleString("fr-FR")} FCFA
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                c.statut === "En attente"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}
                            >
                              {c.statut}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog
                              open={dialogOpen}
                              onOpenChange={(open) => {
                                if (!open) resetForm();
                                setDialogOpen(open);
                              }}
                            >
                              <DialogTrigger>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCreance(c);
                                    setMontantPaiement(String(c.reste));
                                  }}
                                >
                                  <Percent className="h-3 w-3 mr-1" />
                                  Payer
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle>Enregistrer un paiement</DialogTitle>
                                  <DialogDescription>
                                    Client : <strong>{c.client_nom}</strong>
                                    <br />
                                    Restant dû :{" "}
                                    <strong className="text-amber-600">
                                      {c.reste.toLocaleString("fr-FR")} FCFA
                                    </strong>
                                  </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4 py-4">
                                  <div className="grid gap-2">
                                    <Label htmlFor="montant-paiement">
                                      Montant du paiement (FCFA)
                                    </Label>
                                    <Input
                                      id="montant-paiement"
                                      type="number"
                                      step="1"
                                      min="1"
                                      max={c.reste}
                                      value={montantPaiement}
                                      onChange={(e) => setMontantPaiement(e.target.value)}
                                      placeholder="Saisir le montant..."
                                    />
                                  </div>

                                  <div className="grid gap-2">
                                    <Label htmlFor="mode-paiement-creance">
                                      Mode d&apos;encaissement
                                    </Label>
                                    <Select
                                      value={modePaiement}
                                      onValueChange={(val: string | null) => val && setModePaiement(val)}
                                    >
                                      <SelectTrigger id="mode-paiement-creance">
                                        <SelectValue placeholder="Mode" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Espèces">Espèces (Caisse)</SelectItem>
                                        <SelectItem value="MoMo">Mobile Money</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Barre de progression */}
                                  <div className="pt-2">
                                    <p className="text-xs text-muted-foreground mb-2">
                                      Progression du paiement
                                    </p>
                                    <div className="w-full bg-muted rounded-full h-2.5">
                                      <div
                                        className={`h-2.5 rounded-full transition-all ${
                                          c.montant_paye + (parseFloat(montantPaiement) || 0) >= c.reste
                                            ? "bg-green-500"
                                            : "bg-amber-500"
                                        }`}
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            ((c.montant_paye + (parseFloat(montantPaiement) || 0)) /
                                              c.montant_total) *
                                              100
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {c.montant_paye.toLocaleString("fr-FR")} /{" "}
                                      {c.montant_total.toLocaleString("fr-FR")} FCFA
                                    </p>
                                  </div>
                                </div>

                                <DialogFooter>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setDialogOpen(false);
                                      resetForm();
                                    }}
                                  >
                                    Annuler
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={handleEnregistrerPaiement}
                                    disabled={submitting}
                                  >
                                    {submitting ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enregistrement...
                                      </>
                                    ) : (
                                      <>
                                        <HandCoins className="mr-2 h-4 w-4" />
                                        Confirmer le paiement
                                      </>
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}