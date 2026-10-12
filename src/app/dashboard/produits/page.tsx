"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Loader2,
  Plus,
  Package,
  Sprout,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Produit {
  id: string;
  nom: string;
  description: string | null;
  unite: string;
  prix_achat_recommande: number | null;
  prix_vente_recommande: number | null;
  actif: boolean;
  created_at: string;
}

export default function ProduitsPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Produit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Produit | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formNom, setFormNom] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formUnite, setFormUnite] = useState("Tonnes");
  const [formPrixAchat, setFormPrixAchat] = useState("");
  const [formPrixVente, setFormPrixVente] = useState("");

  function resetForm() {
    setFormNom(""); setFormDesc(""); setFormUnite("Tonnes");
    setFormPrixAchat(""); setFormPrixVente("");
  }

  const loadData = useCallback(async () => {
    try {
      const { data } = await supabase.from("Produits").select("*").order("nom");
      if (data) setProduits(data as Produit[]);
    } catch (err) {
      console.error("Erreur chargement produits :", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!formNom.trim()) { toast.error("Le nom est requis"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("Produits").insert({
        nom: formNom.trim(),
        description: formDesc.trim() || null,
        unite: formUnite,
        prix_achat_recommande: formPrixAchat ? parseFloat(formPrixAchat) : null,
        prix_vente_recommande: formPrixVente ? parseFloat(formPrixVente) : null,
      });
      if (error) { toast.error(`Erreur : ${error.message}`); return; }
      toast.success(`Produit « ${formNom.trim()} » créé`);
      setCreateOpen(false); resetForm(); await loadData();
    } catch { toast.error("Erreur lors de la création"); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!editTarget || !formNom.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("Produits").update({
        nom: formNom.trim(), description: formDesc.trim() || null,
        unite: formUnite,
        prix_achat_recommande: formPrixAchat ? parseFloat(formPrixAchat) : null,
        prix_vente_recommande: formPrixVente ? parseFloat(formPrixVente) : null,
      }).eq("id", editTarget.id);
      if (error) { toast.error(`Erreur : ${error.message}`); return; }
      toast.success(`${formNom.trim()} mis à jour`);
      setEditOpen(false); setEditTarget(null); resetForm(); await loadData();
    } catch { toast.error("Erreur lors de la modification"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("Produits").delete().eq("id", deleteTarget.id);
      if (error) { toast.error(`Erreur : ${error.message}`); return; }
      toast.success(`${deleteTarget.nom} supprimé`);
      setDeleteOpen(false); setDeleteTarget(null); await loadData();
    } catch { toast.error("Erreur lors de la suppression"); }
    finally { setSubmitting(false); }
  };

  function openEdit(p: Produit) {
    setEditTarget(p); setFormNom(p.nom); setFormDesc(p.description ?? "");
    setFormUnite(p.unite); setFormPrixAchat(String(p.prix_achat_recommande ?? ""));
    setFormPrixVente(String(p.prix_vente_recommande ?? "")); setEditOpen(true);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Produits</h1>
          <p className="text-muted-foreground text-sm">Catalogue des produits agricoles</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { if (!o) resetForm(); setCreateOpen(o); }}>
          <DialogTrigger><Button><Plus className="h-4 w-4 mr-2" />Nouveau produit</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nouveau produit</DialogTitle>
              <DialogDescription>Ajouter un produit au catalogue</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="p-nom">Nom <span className="text-destructive">*</span></Label>
                <Input id="p-nom" value={formNom} onChange={(e) => setFormNom(e.target.value)} placeholder="Ex: Maïs, Riz, Café..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea id="p-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optionnelle" className="resize-none" rows={2} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="p-unite">Unité</Label>
                  <Input id="p-unite" value={formUnite} onChange={(e) => setFormUnite(e.target.value)} placeholder="Tonnes" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="p-prix-achat">Prix achat (FCFA)</Label>
                  <Input id="p-prix-achat" type="number" step="1" value={formPrixAchat} onChange={(e) => setFormPrixAchat(e.target.value)} placeholder="Recommandé" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="p-prix-vente">Prix vente (FCFA)</Label>
                  <Input id="p-prix-vente" type="number" step="1" value={formPrixVente} onChange={(e) => setFormPrixVente(e.target.value)} placeholder="Recommandé" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Annuler</Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création...</> : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Produits actifs</CardTitle><CheckCircle2 className="h-4 w-4 text-green-600" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{produits.filter(p => p.actif).length}</div><CardDescription>Produits disponibles</CardDescription></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Produits inactifs</CardTitle><XCircle className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{produits.filter(p => !p.actif).length}</div><CardDescription>Produits archivés</CardDescription></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle><Package className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{produits.length}</div><CardDescription>Produits au catalogue</CardDescription></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Catalogue</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {produits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Aucun produit dans le catalogue</p>
              <Button className="mt-4" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Ajouter un produit
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Unité</TableHead>
                    <TableHead className="text-right">Prix achat</TableHead>
                    <TableHead className="text-right">Prix vente</TableHead>
                    <TableHead className="text-center">Actif</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produits.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nom}</TableCell>
                      <TableCell>{p.unite}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.prix_achat_recommande ? `${p.prix_achat_recommande.toLocaleString("fr-FR")} FCFA` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.prix_vente_recommande ? `${p.prix_vente_recommande.toLocaleString("fr-FR")} FCFA` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.actif ? <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Dialog open={editOpen && editTarget?.id === p.id}
                            onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditTarget(null); resetForm(); } }}>
                            <DialogTrigger><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="Modifier"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader><DialogTitle>Modifier le produit</DialogTitle><DialogDescription>Modifier {p.nom}</DialogDescription></DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2"><Label htmlFor="e-nom">Nom <span className="text-destructive">*</span></Label>
                                  <Input id="e-nom" value={formNom} onChange={(e) => setFormNom(e.target.value)} /></div>
                                <div className="grid gap-2"><Label htmlFor="e-desc">Description</Label>
                                  <Textarea id="e-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="resize-none" rows={2} /></div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div className="grid gap-2"><Label htmlFor="e-unite">Unité</Label><Input id="e-unite" value={formUnite} onChange={(e) => setFormUnite(e.target.value)} /></div>
                                  <div className="grid gap-2"><Label htmlFor="e-pa">Prix achat</Label><Input id="e-pa" type="number" step="1" value={formPrixAchat} onChange={(e) => setFormPrixAchat(e.target.value)} /></div>
                                  <div className="grid gap-2"><Label htmlFor="e-pv">Prix vente</Label><Input id="e-pv" type="number" step="1" value={formPrixVente} onChange={(e) => setFormPrixVente(e.target.value)} /></div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => { setEditOpen(false); setEditTarget(null); resetForm(); }}>Annuler</Button>
                                <Button onClick={handleEdit} disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer"}</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Dialog open={deleteOpen && deleteTarget?.id === p.id}
                            onOpenChange={(o) => { if (!o) { setDeleteOpen(false); setDeleteTarget(null); } }}>
                            <DialogTrigger><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(p)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button></DialogTrigger>
                            <DialogContent className="sm:max-w-[400px]">
                              <DialogHeader><DialogTitle>Confirmer la suppression</DialogTitle>
                                <DialogDescription>Supprimer <strong>{deleteTarget?.nom}</strong> ? Cette action est irréversible.</DialogDescription></DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }}>Annuler</Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{submitting ? "Suppression..." : <><Trash2 className="mr-2 h-4 w-4" />Supprimer</>}</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
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