"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  TrendingUp,
  Warehouse,
  AlertCircle,
  CirclePlus,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Client {
  id: string;
  nom: string;
  contact: string | null;
}

interface ProduitSelect { id: string; nom: string; }

const venteSchema = z.object({
  date: z.string().min(1, "Date requise"),
  client_id: z.string().min(1, "Sélectionnez un client"),
  produit_id: z.string().optional(),
  quantite: z.coerce
    .number({ invalid_type_error: "Quantité requise" })
    .positive("La quantité doit être supérieure à 0"),
  prix_unitaire: z.coerce
    .number({ invalid_type_error: "Prix requis" })
    .min(0, "Le prix ne peut pas être négatif"),
  mode_encaissement: z.string().min(1, "Sélectionnez un mode d'encaissement"),
  notes: z.string().optional(),
});

type VenteFormData = z.infer<typeof venteSchema>;

export default function NouvelleVentePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [produitsVente, setProduitsVente] = useState<ProduitSelect[]>([]);
  const [stockDisponible, setStockDisponible] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);

  /* Quick-create client */
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientNom, setQuickClientNom] = useState("");
  const [quickClientContact, setQuickClientContact] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickVProdOpen, setQuickVProdOpen] = useState(false);
  const [quickVProdNom, setQuickVProdNom] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VenteFormData>({
    resolver: zodResolver(venteSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
    },
  });

  const quantite = watch("quantite") || 0;
  const prixUnitaire = watch("prix_unitaire") || 0;
  const montantTotal = quantite * prixUnitaire;

  async function loadInitialData() {
    try {
      const [clientsRes, stockRes, produitsRes] = await Promise.all([
        supabase.from("tiers").select("id, nom, contact").eq("type", "Client").order("nom"),
        supabase.from("stock_actuel").select("stock_tonnes").single(),
        supabase.from("produits").select("id, nom").eq("actif", true).order("nom"),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (stockRes.data && "stock_tonnes" in stockRes.data) {
        setStockDisponible(Number(stockRes.data.stock_tonnes));
      }
      if (produitsRes.data) setProduitsVente(produitsRes.data);
    } catch (err) {
      console.error("Erreur chargement données initiales :", err);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  // Validation stock en temps réel
  useEffect(() => {
    if (quantite > 0 && stockDisponible > 0) {
      if (quantite > stockDisponible) {
        setStockError(
          `Stock insuffisant. Disponible : ${stockDisponible.toFixed(3)} t`
        );
      } else {
        setStockError(null);
      }
    } else {
      setStockError(null);
    }
  }, [quantite, stockDisponible]);

  const onSubmit = async (data: VenteFormData) => {
    // Double vérification avant soumission
    if (data.quantite > stockDisponible) {
      toast.error(
        `Stock insuffisant. Disponible : ${stockDisponible.toFixed(3)} t`
      );
      return;
    }

    setLoading(true);

    try {
      const { data: result, error } = await supabase.rpc(
        "enregistrer_vente_complet",
        {
          p_date: data.date,
          p_client_id: data.client_id,
          p_quantite: data.quantite,
          p_prix_unitaire: data.prix_unitaire,
          p_mode_encaissement: data.mode_encaissement,
          p_notes: data.notes || null,
        p_produit_id: data.produit_id || null,
        }
      );

      if (error) {
        // Gestion des erreurs PostgreSQL (ex: RAISE EXCEPTION)
        const message = error.message.includes("Stock insuffisant")
          ? error.message
          : `Erreur : ${error.message}`;
        toast.error(message);
        return;
      }

      toast.success("Vente enregistrée avec succès !");
      router.push("/dashboard/ventes");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/ventes"
          className="inline-flex items-center justify-center rounded-lg hover:bg-muted h-8 w-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Nouvelle Vente
          </h1>
          <p className="text-muted-foreground text-sm">
            Enregistrer une vente et mettre à jour le stock
          </p>
        </div>
      </div>

      {/* Stock disponible — alerte */}
      <Card className="mb-6 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
            <Warehouse className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Stock disponible</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {stockDisponible.toFixed(3)} tonnes
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Détails de la vente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Détails de la vente
            </CardTitle>
            <CardDescription>
              Informations sur la transaction de vente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date")}
                  className={errors.date ? "border-destructive" : ""}
                />
                {errors.date && (
                  <p className="text-sm text-destructive">
                    {errors.date.message}
                  </p>
                )}
              </div>

              {/* Client */}
              <div className="space-y-2">
                <Label htmlFor="client_id">
                  Client <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(val: string | null) =>
                      val && setValue("client_id", val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger
                      id="client_id"
                      className={errors.client_id ? "border-destructive" : ""}
                    >
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom}
                          {c.contact ? ` — ${c.contact}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog
                    open={quickClientOpen}
                    onOpenChange={(o) => {
                      if (!o) { setQuickClientOpen(false); setQuickClientNom(""); setQuickClientContact(""); }
                      setQuickClientOpen(o);
                    }}
                  >
                    <DialogTrigger>
                      <Button variant="outline" size="icon" className="shrink-0" title="Ajouter un client">
                        <CirclePlus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>Nouveau client</DialogTitle>
                        <DialogDescription>
                          Ajouter rapidement un client
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="quick-client-nom">
                            Nom <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="quick-client-nom"
                            type="text"
                            value={quickClientNom}
                            onChange={(e) => setQuickClientNom(e.target.value)}
                            placeholder="Nom du client"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="quick-client-contact">Contact</Label>
                          <Input
                            id="quick-client-contact"
                            type="text"
                            value={quickClientContact}
                            onChange={(e) => setQuickClientContact(e.target.value)}
                            placeholder="Téléphone ou email"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setQuickClientOpen(false); setQuickClientNom(""); setQuickClientContact(""); }}>
                          Annuler
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!quickClientNom.trim()) { toast.error("Le nom est requis"); return; }
                            setQuickLoading(true);
                            const { data, error } = await supabase.from("tiers").insert({
                              nom: quickClientNom.trim(),
                              type: "Client",
                              contact: quickClientContact.trim() || null,
                            }).select("id, nom, contact").single();
                            setQuickLoading(false);
                            if (error) { toast.error(error.message); return; }
                            if (data) {
                              setClients((prev) => [...prev, data as Client].sort((a, b) => a.nom.localeCompare(b.nom)));
                              setValue("client_id", data.id, { shouldValidate: true });
                              toast.success(`Client « ${quickClientNom.trim()} » ajouté`);
                            }
                            setQuickClientOpen(false);
                            setQuickClientNom("");
                            setQuickClientContact("");
                          }}
                          disabled={quickLoading}
                        >
                          {quickLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ajout...</> : "Ajouter"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {errors.client_id && (
                  <p className="text-sm text-destructive">
                    {errors.client_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vente-produit">Produit</Label>
                <div className="flex gap-2">
                  <Select onValueChange={(val: string | null) => val && setValue("produit_id", val, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
                    <SelectContent>
                      {produitsVente.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Dialog open={quickVProdOpen} onOpenChange={(o) => { if (!o) { setQuickVProdOpen(false); setQuickVProdNom(""); } setQuickVProdOpen(o); }}>
                    <DialogTrigger><Button variant="outline" size="icon" className="shrink-0" title="Ajouter un produit"><CirclePlus className="h-4 w-4" /></Button></DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader><DialogTitle>Nouveau produit</DialogTitle><DialogDescription>Ajouter rapidement un produit</DialogDescription></DialogHeader>
                      <div className="grid gap-3 py-4">
                        <div className="grid gap-2"><Label>Nom <span className="text-destructive">*</span></Label><Input value={quickVProdNom} onChange={(e) => setQuickVProdNom(e.target.value)} placeholder="Ex: Maïs, Riz..." /></div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setQuickVProdOpen(false); setQuickVProdNom(""); }}>Annuler</Button>
                        <Button onClick={async () => {
                          if (!quickVProdNom.trim()) { toast.error("Le nom est requis"); return; }
                          setQuickLoading(true);
                          const { data, error } = await supabase.from("produits").insert({ nom: quickVProdNom.trim(), unite: "Tonnes" }).select("id, nom").single();
                          setQuickLoading(false);
                          if (error) { toast.error(error.message); return; }
                          if (data) {
                            setProduitsVente((prev) => [...prev, data as ProduitSelect].sort((a, b) => a.nom.localeCompare(b.nom)));
                            setValue("produit_id", data.id, { shouldValidate: true });
                            toast.success(`Produit « ${quickVProdNom.trim()} » ajouté`);
                          }
                          setQuickVProdOpen(false); setQuickVProdNom("");
                        }} disabled={quickLoading}>
                          {quickLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ajout...</> : "Ajouter"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Quantité */}
              <div className="space-y-2">
                <Label htmlFor="quantite">
                  Quantité (tonnes){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantite"
                  type="number"
                  step="0.001"
                  placeholder="Ex: 5.000"
                  {...register("quantite")}
                  className={
                    errors.quantite || stockError
                      ? "border-destructive"
                      : ""
                  }
                />
                {errors.quantite && (
                  <p className="text-sm text-destructive">
                    {errors.quantite.message}
                  </p>
                )}
                {stockError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {stockError}
                  </p>
                )}
              </div>

              {/* Prix unitaire */}
              <div className="space-y-2">
                <Label htmlFor="prix_unitaire">
                  Prix unitaire (FCFA){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prix_unitaire"
                  type="number"
                  step="1"
                  placeholder="Ex: 25000"
                  {...register("prix_unitaire")}
                  className={errors.prix_unitaire ? "border-destructive" : ""}
                />
                {errors.prix_unitaire && (
                  <p className="text-sm text-destructive">
                    {errors.prix_unitaire.message}
                  </p>
                )}
              </div>

              {/* Mode d'encaissement */}
              <div className="space-y-2">
                <Label htmlFor="mode_encaissement">
                  Mode d&apos;encaissement{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(val: string | null) =>
                    val &&
                    setValue("mode_encaissement", val, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    id="mode_encaissement"
                    className={
                      errors.mode_encaissement ? "border-destructive" : ""
                    }
                  >
                    <SelectValue placeholder="Sélectionner un mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Espèces">Espèces (Caisse)</SelectItem>
                    <SelectItem value="MoMo">
                      Mobile Money (MoMo)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.mode_encaissement && (
                  <p className="text-sm text-destructive">
                    {errors.mode_encaissement.message}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  placeholder="Informations complémentaires..."
                  {...register("notes")}
                  className="resize-none"
                  rows={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Résumé */}
        {montantTotal > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Résumé de la vente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Quantité</span>
                  <p className="text-lg font-semibold">
                    {Number(quantite).toFixed(3)} t
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Prix unitaire</span>
                  <p className="text-lg font-semibold">
                    {Number(prixUnitaire).toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant total</span>
                  <p className="text-lg font-bold text-primary">
                    {montantTotal.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Boutons */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/ventes"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground h-10 px-4 text-sm font-medium transition-colors"
          >
            Annuler
          </Link>
          <Button
            type="submit"
            disabled={loading || !!stockError}
            className="min-w-[200px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer la vente"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}