"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Warehouse,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface StockActuel {
  stock_actuel: number | null;
}

interface MouvementStock {
  id: number;
  date: string;
  type: string;
  quantite: number;
  cause: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface DashboardStats {
  stock_actuel: number;
  entrees: number;
  sorties: number;
  pertes: number;
}

type PerteCause = "Humidité" | "Séchage" | "Rongeurs" | "Autre";

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function GestionStocksPage() {
  const router = useRouter();
  const supabase = createClient();

  const [movements, setMovements] = useState<MouvementStock[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    stock_actuel: 0,
    entrees: 0,
    sorties: 0,
    pertes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* form state ---------------------------------------------------- */
  const [perteDate, setPerteDate] = useState("");
  const [perteQuantite, setPerteQuantite] = useState("");
  const [perteCause, setPerteCause] = useState<PerteCause>("Humidité");
  const [perteNotes, setPerteNotes] = useState("");

  /* helpers ------------------------------------------------------- */
  function resetForm() {
    setPerteDate("");
    setPerteQuantite("");
    setPerteCause("Humidité");
    setPerteNotes("");
  }

  async function loadData() {
    setLoading(true);

    try {
      const [stockRes, movementsRes] = await Promise.all([
        supabase.from("stock_actuel").select("*").single<StockActuel>(),
        supabase
          .from("Mouvements_Stock")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (stockRes.error) {
        console.error("Erreur lors du chargement du stock actuel :", stockRes.error);
      }

      if (movementsRes.error) {
        console.error("Erreur lors du chargement des mouvements :", movementsRes.error);
      }

      const mouvements: MouvementStock[] = movementsRes.data ?? [];

      const entrees = mouvements
        .filter((m) => m.type === "Entrée")
        .reduce((sum, m) => sum + Number(m.quantite), 0);

      const sorties = mouvements
        .filter((m) => m.type === "Sortie")
        .reduce((sum, m) => sum + Number(m.quantite), 0);

      const pertes = mouvements
        .filter((m) => m.type === "Perte")
        .reduce((sum, m) => sum + Number(m.quantite), 0);

      setStats({
        stock_actuel: stockRes.data?.stock_actuel ?? 0,
        entrees,
        sorties,
        pertes,
      });
      setMovements(mouvements);
    } catch (err) {
      console.error("Erreur inattendue lors du chargement des données :", err);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeclarePerte(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const quantite = parseFloat(perteQuantite);

      if (!perteDate) {
        toast.error("Veuillez sélectionner une date");
        setSubmitting(false);
        return;
      }

      if (isNaN(quantite) || quantite <= 0) {
        toast.error("Veuillez entrer une quantité valide");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("Mouvements_Stock").insert({
        date: perteDate,
        type: "Perte",
        quantite,
        cause: perteCause,
        notes: perteNotes || null,
      });

      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }

      toast.success("Perte déclarée avec succès");
      setDialogOpen(false);
      resetForm();
      await loadData();
      router.refresh();
    } catch (err) {
      console.error("Erreur lors de la déclaration de perte :", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* render -------------------------------------------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Gestion des Stocks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi du stock physique et déclaration des pertes
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Déclarer une perte
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleDeclarePerte}>
              <DialogHeader>
                <DialogTitle>Déclarer une perte</DialogTitle>
                <DialogDescription>
                  Saisissez les informations concernant la perte de stock.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Date */}
                <div className="grid gap-2">
                  <Label htmlFor="perte-date">Date</Label>
                  <Input
                    id="perte-date"
                    type="date"
                    value={perteDate}
                    onChange={(e) => setPerteDate(e.target.value)}
                    required
                  />
                </div>

                {/* Quantité */}
                <div className="grid gap-2">
                  <Label htmlFor="perte-quantite">
                    Quantité <span className="text-xs text-muted-foreground">(tonnes)</span>
                  </Label>
                  <Input
                    id="perte-quantite"
                    type="number"
                    step="0.001"
                    min="0"
                    value={perteQuantite}
                    onChange={(e) => setPerteQuantite(e.target.value)}
                    placeholder="0.000"
                    required
                  />
                </div>

                {/* Cause */}
                <div className="grid gap-2">
                  <Label htmlFor="perte-cause">Cause</Label>
                  <Select
                    value={perteCause}
                    onValueChange={(v) => setPerteCause(v as PerteCause)}
                  >
                    <SelectTrigger id="perte-cause">
                      <SelectValue placeholder="Sélectionner une cause" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Humidité">Humidité</SelectItem>
                      <SelectItem value="Séchage">Séchage</SelectItem>
                      <SelectItem value="Rongeurs">Rongeurs</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="grid gap-2">
                  <Label htmlFor="perte-notes">Notes (optionnel)</Label>
                  <Input
                    id="perte-notes"
                    type="text"
                    value={perteNotes}
                    onChange={(e) => setPerteNotes(e.target.value)}
                    placeholder="Informations complémentaires…"
                  />
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
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirmer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      /* ---- Stat Cards ---- */
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Stock actuel
            </CardTitle>
            <Warehouse className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {stats.stock_actuel.toFixed(3)} t
            </div>
            <CardDescription>Tonnes en stock</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entrées</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.entrees.toFixed(3)} t
            </div>
            <CardDescription>Total des entrées</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sorties</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.sorties.toFixed(3)} t
            </div>
            <CardDescription>Total des sorties</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pertes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.pertes.toFixed(3)} t
            </div>
            <CardDescription>Total des pertes</CardDescription>
          </CardContent>
        </Card>
      </div>

      /* ---- Movements Table ---- */
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" />
            Historique des mouvements
          </CardTitle>
          <CardDescription>
            Liste de tous les mouvements de stock enregistrés
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun mouvement de stock enregistré
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantité (t)</TableHead>
                    <TableHead>Cause / Référence</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((mvt) => (
                    <TableRow key={mvt.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(mvt.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={mvt.type} />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {Number(mvt.quantite).toFixed(3)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {mvt.cause ?? mvt.reference ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {mvt.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge helper                                                      */
/* ------------------------------------------------------------------ */

function TypeBadge({ type }: { type: string }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

  switch (type) {
    case "Entrée":
      return (
        <span className={`${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`}>
          Entrée
        </span>
      );
    case "Sortie":
      return (
        <span className={`${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`}>
          Sortie
        </span>
      );
    case "Perte":
      return (
        <span className={`${base} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`}>
          Perte
        </span>
      );
    default:
      return (
        <span className={`${base} bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300`}>
          {type}
        </span>
      );
  }
}