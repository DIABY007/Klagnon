"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Loader2, Plus, ShoppingCart, PackageOpen } from "lucide-react";
import Link from "next/link";

interface AchatCRU {
  id: string;
  date: string;
  fournisseur: string;
  quantite_tonnes: number;
  prix_unitaire: number;
  montant_achat: number;
  total_frais: number;
  cout_total: number;
  cru_unitaire: number;
  mode_paiement: string;
  statut_paiement: string;
}

export default function AchatsPage() {
  const [achats, setAchats] = useState<AchatCRU[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  async function loadAchats() {
    const { data } = await supabase
      .from("vue_achats_cru")
      .select("*")
      .order("date", { ascending: false });

    if (data) setAchats(data as AchatCRU[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAchats();
  }, []);

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Achats
          </h1>
          <p className="text-muted-foreground text-sm">
            Historique des achats et coût de revient unitaire
          </p>
        </div>
        <Link href="/dashboard/achats/nouveau">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvel achat
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : achats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <PackageOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              Aucun achat enregistré
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Commencez par enregistrer votre premier achat
            </p>
            <Link href="/dashboard/achats/nouveau">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel achat
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Historique des achats
            </CardTitle>
            <CardDescription>
              {achats.length} achat{achats.length > 1 ? "s" : ""} enregistré
              {achats.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="text-right">Qté (T)</TableHead>
                    <TableHead className="text-right">Prix unit.</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Frais</TableHead>
                    <TableHead className="text-right font-bold text-primary">
                      CRU (FCFA/T)
                    </TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Paiement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {achats.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(a.date).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>{a.fournisseur}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(a.quantite_tonnes).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(a.prix_unitaire).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(a.montant_achat).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(a.total_frais).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary tabular-nums">
                        {Number(a.cru_unitaire).toLocaleString("fr-FR", {
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(a.cout_total).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            a.statut_paiement === "Payé"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : a.statut_paiement === "En attente"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}
                        >
                          {a.statut_paiement}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}