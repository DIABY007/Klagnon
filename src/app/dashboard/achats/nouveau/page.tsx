"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type UseFieldArrayAppend } from "react-hook-form";
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
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Loader2, Plus, Trash2, ArrowLeft, Sprout, CirclePlus } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// Types
interface Fournisseur {
  id: string;
  nom: string;
}

interface FraisForm {
  type_frais: string;
  montant: number;
  description?: string;
}

const fraisSchema = z.object({
  type_frais: z.string().min(1, "Sélectionnez un type de frais"),
  montant: z.coerce
    .number({ invalid_type_error: "Montant requis" })
    .min(0, "Le montant ne peut pas être négatif"),
  description: z.string().optional(),
});

const achatSchema = z.object({
  date: z.string().min(1, "Date requise"),
  fournisseur_id: z.string().min(1, "Sélectionnez un fournisseur"),
  quantite_tonnes: z.coerce
    .number({ invalid_type_error: "Quantité requise" })
    .positive("La quantité doit être supérieure à 0"),
  prix_unitaire: z.coerce
    .number({ invalid_type_error: "Prix requis" })
    .min(0, "Le prix ne peut pas être négatif"),
  mode_paiement: z.string().min(1, "Sélectionnez un mode de paiement"),
  notes: z.string().optional(),
  frais: z.array(fraisSchema),
});

type AchatFormData = z.infer<typeof achatSchema>;

const TYPES_FRAIS = [
  { value: "Transport", label: "Transport" },
  { value: "Chargement", label: "Chargement" },
  { value: "Déchargement", label: "Déchargement" },
  { value: "Autre", label: "Autre" },
] as const;

export default function NouvelAchatPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  /* Quick-create fournisseur */
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickNom, setQuickNom] = useState("");
  const [quickContact, setQuickContact] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AchatFormData>({
    resolver: zodResolver(achatSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      frais: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    keyName: "fieldId",
    name: "frais",
  });

  const watchedFrais = watch("frais");

  const quantite = watch("quantite_tonnes") || 0;
  const prixUnitaire = watch("prix_unitaire") || 0;
  const totalFrais = (watchedFrais || []).reduce(
    (sum: number, f: FraisForm) => sum + (Number(f.montant) || 0),
    0
  );
  const totalAchat = quantite * prixUnitaire;
  const totalEstime = totalAchat + totalFrais;
  const cruEstime = quantite > 0 ? totalEstime / quantite : 0;

  async function loadFournisseurs() {
    const { data } = await supabase
      .from("tiers")
      .select("id, nom")
      .eq("type", "Fournisseur")
      .order("nom");

    if (data) setFournisseurs(data);
    setInitialLoading(false);
  }

  useEffect(() => {
    loadFournisseurs();
  }, []);

  const onSubmit = async (data: AchatFormData) => {
    setLoading(true);

    try {
      const { error } = await supabase.rpc("enregistrer_achat_complet", {
        p_date: data.date,
        p_fournisseur_id: data.fournisseur_id,
        p_quantite_tonnes: data.quantite_tonnes,
        p_prix_unitaire: data.prix_unitaire,
        p_mode_paiement: data.mode_paiement,
        p_notes: data.notes || null,
        p_frais: (data.frais || []).map((f) => ({
          type_frais: f.type_frais,
          montant: Number(f.montant),
          description: f.description || null,
        })),
      });

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }

      toast.success("Achat enregistré avec succès !");
      router.push("/dashboard/achats");
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
    <div className="max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/achats"
          className="inline-flex items-center justify-center rounded-lg hover:bg-muted h-8 w-8 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Nouvel Achat
          </h1>
          <p className="text-muted-foreground text-sm">
            Enregistrer un nouvel achat avec ses frais annexes
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1 : Détails de l'achat */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sprout className="h-5 w-5 text-primary" />
              Détails de l&apos;achat
            </CardTitle>
            <CardDescription>
              Informations générales sur l&apos;achat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fournisseur_id">
                  Fournisseur <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(val: string | null) => val && setValue("fournisseur_id", val, { shouldValidate: true })}
                  >
                    <SelectTrigger
                      className={errors.fournisseur_id ? "border-destructive" : ""}
                    >
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      {fournisseurs.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog
                    open={quickOpen}
                    onOpenChange={(o) => {
                      if (!o) { setQuickOpen(false); setQuickNom(""); setQuickContact(""); }
                      setQuickOpen(o);
                    }}
                  >
                    <DialogTrigger>
                      <Button variant="outline" size="icon" className="shrink-0" title="Ajouter un fournisseur">
                        <CirclePlus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>Nouveau fournisseur</DialogTitle>
                        <DialogDescription>
                          Ajouter rapidement un fournisseur
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="quick-nom">
                            Nom <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="quick-nom"
                            type="text"
                            value={quickNom}
                            onChange={(e) => setQuickNom(e.target.value)}
                            placeholder="Nom du fournisseur"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="quick-contact">Contact</Label>
                          <Input
                            id="quick-contact"
                            type="text"
                            value={quickContact}
                            onChange={(e) => setQuickContact(e.target.value)}
                            placeholder="Téléphone ou email"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => { setQuickOpen(false); setQuickNom(""); setQuickContact(""); }}>
                          Annuler
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!quickNom.trim()) { toast.error("Le nom est requis"); return; }
                            setQuickLoading(true);
                            const { data, error } = await supabase.from("tiers").insert({
                              nom: quickNom.trim(),
                              type: "Fournisseur",
                              contact: quickContact.trim() || null,
                            }).select("id, nom").single();
                            setQuickLoading(false);
                            if (error) { toast.error(error.message); return; }
                            if (data) {
                              setFournisseurs((prev) => [...prev, data as Fournisseur].sort((a, b) => a.nom.localeCompare(b.nom)));
                              setValue("fournisseur_id", data.id, { shouldValidate: true });
                              toast.success(`Fournisseur « ${quickNom.trim()} » ajouté`);
                            }
                            setQuickOpen(false);
                            setQuickNom("");
                            setQuickContact("");
                          }}
                          disabled={quickLoading}
                        >
                          {quickLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ajout...</> : "Ajouter"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                {errors.fournisseur_id && (
                  <p className="text-sm text-destructive">{errors.fournisseur_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantite_tonnes">
                  Quantité (tonnes) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantite_tonnes"
                  type="number"
                  step="0.001"
                  placeholder="Ex: 15.500"
                  {...register("quantite_tonnes")}
                  className={errors.quantite_tonnes ? "border-destructive" : ""}
                />
                {errors.quantite_tonnes && (
                  <p className="text-sm text-destructive">{errors.quantite_tonnes.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prix_unitaire">
                  Prix unitaire (FCFA) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prix_unitaire"
                  type="number"
                  step="1"
                  placeholder="Ex: 22000"
                  {...register("prix_unitaire")}
                  className={errors.prix_unitaire ? "border-destructive" : ""}
                />
                {errors.prix_unitaire && (
                  <p className="text-sm text-destructive">{errors.prix_unitaire.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode_paiement">
                  Mode de paiement <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(val: string | null) => val && setValue("mode_paiement", val, { shouldValidate: true })}
                >
                  <SelectTrigger
                    className={errors.mode_paiement ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Sélectionner un mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Espèces">Espèces</SelectItem>
                    <SelectItem value="MoMo">Mobile Money (MoMo)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.mode_paiement && (
                  <p className="text-sm text-destructive">{errors.mode_paiement.message}</p>
                )}
              </div>

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

        {/* Section 2 : Frais annexes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Frais annexes</CardTitle>
              <CardDescription>
                Ajoutez les frais de transport, chargement, etc.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ type_frais: "", montant: 0, description: "" })}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un frais
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun frais ajouté. Cliquez sur &ldquo;Ajouter un frais&rdquo; pour commencer.
              </p>
            )}
            {fields.map((field, index) => (
              <div
                key={field.fieldId}
                className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30"
              >
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-xs">Type de frais</Label>
                  <Select
                    onValueChange={(val: string | null) => val &&
                      setValue(`frais.${index}.type_frais` as const, val, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES_FRAIS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-[120px]">
                  <Label className="text-xs">Montant (FCFA)</Label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="0"
                    {...register(`frais.${index}.montant` as const, { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1 flex-[2] min-w-[140px]">
                  <Label className="text-xs">Description</Label>
                  <Input
                    type="text"
                    placeholder="Optionnelle"
                    {...register(`frais.${index}.description` as const)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive mb-0.5"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Résumé et estimation */}
        {(quantite > 0 || totalFrais > 0) && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Résumé estimé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Montant achat</span>
                  <p className="text-lg font-semibold">
                    {totalAchat.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total frais</span>
                  <p className="text-lg font-semibold">
                    {totalFrais.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dépense totale</span>
                  <p className="text-lg font-bold text-primary">
                    {totalEstime.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">CRU estimé</span>
                  <p className="text-lg font-bold text-primary">
                    {cruEstime.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA/t
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Boutons */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/achats"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground h-8 px-2.5 text-sm font-medium transition-colors"
          >
            Annuler
          </Link>
          <Button type="submit" disabled={loading} className="min-w-[200px]">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer l'achat"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}