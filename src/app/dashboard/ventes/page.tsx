"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
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
  Loader2,
  Plus,
  TrendingUp,
  TrendingDown,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import FactureButton from "@/components/FactureButton";

interface VenteRow {
  id: string;
  date: string;
  client_id: string;
  quantite: number;
  prix_unitaire: number;
  mode_encaissement: string;
  statut_paiement: string;
  notes: string | null;
  tiers: { nom: string; contact: string | null } | null;
}

interface VenteDisplay {
  id: string;
  date: string;
  client_nom: string;
  client_contact: string | null;
  quantite: number;
  prix_unitaire: number;
  montant_total: number;
  mode_encaissement: string;
  statut_paiement: string;
  notes: string | null;
}

export default function VentesPage() {
  const [ventes, setVentes] = useState<VenteDisplay[]>([]);
  const [stockActuel, setStockActuel] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [ventesRes, stockRes] = await Promise.allSettled([
        supabase
          .from("ventes")
          .select("*, tiers:client_id(nom, contact)")
          .order("date", { ascending: false }),
        supabase.from("stock_actuel").select("stock_tonnes").single(),
      ]);

      if (ventesRes.status === "fulfilled" && ventesRes.value.data) {
        const rows = ventesRes.value.data as unknown as VenteRow[];
        const display: VenteDisplay[] = rows.map((v) => ({
          id: v.id,
          date: v.date,
          client_nom: v.tiers?.nom ?? "Client supprimé",
          client_contact: v.tiers?.contact ?? null,
          quantite: Number(v.quantite),
          prix_unitaire: Number(v.prix_unitaire),
          montant_total: Number(v.quantite) * Number(v.prix_unitaire),
          mode_encaissement: v.mode_encaissement,
          statut_paiement: v.statut_paiement,
          notes: v.notes,
        }));
        setVentes(display);
      }

      if (
        stockRes.status === "fulfilled" &&
        stockRes.value.data &&
        "stock_tonnes" in stockRes.value.data
      ) {
        setStockActuel(Number(stockRes.value.data.stock_tonnes));
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

  const totalVentes = ventes.reduce(
    (sum, v) => sum + v.montant_total,
    0
  );
  const totalQuantite = ventes.reduce(
    (sum, v) => sum + v.quantite,
    0
  );

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Ventes
          </h1>
          <p className="text-muted-foreground text-sm">
            Gérer les ventes et télécharger les factures
          </p>
        </div>
        <Link href="/dashboard/ventes/nouveau">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle vente
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : ventes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              Aucune vente enregistrée
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Commencez par enregistrer votre première vente
            </p>
            <Link href="/dashboard/ventes/nouveau">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle vente
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cartes de statistiques */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Stock actuel
                </CardTitle>
                <Warehouse className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {stockActuel.toFixed(3)} t
                </div>
                <CardDescription>Disponible pour la vente</CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total vendu
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalQuantite.toFixed(3)} t
                </div>
                <CardDescription>
                  {ventes.length} vente{ventes.length > 1 ? "s" : ""}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Chiffre d&apos;affaires
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {totalVentes.toLocaleString("fr-FR")} FCFA
                </div>
                <CardDescription>Total encaissé</CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Tableau des ventes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Historique des ventes
              </CardTitle>
              <CardDescription>
                Liste de toutes les ventes enregistrées
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Qté (T)</TableHead>
                      <TableHead className="text-right">Prix unit.</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-center">Paiement</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                      <TableHead className="text-right">Facture</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventes.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {new Date(v.date).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>{v.client_nom}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {v.quantite.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {v.prix_unitaire.toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {v.montant_total.toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              v.mode_encaissement === "Espèces"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {v.mode_encaissement}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <StatutBadge statut={v.statut_paiement} />
                        </TableCell>
                        <TableCell className="text-right">
                          <FactureButton vente={v} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

  switch (statut) {
    case "Payé":
      return (
        <span
          className={`${base} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`}
        >
          Payé
        </span>
      );
    case "En attente":
      return (
        <span
          className={`${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`}
        >
          En attente
        </span>
      );
    case "Partiel":
      return (
        <span
          className={`${base} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`}
        >
          Partiel
        </span>
      );
    default:
      return (
        <span
          className={`${base} bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300`}
        >
          {statut}
        </span>
      );
  }
}