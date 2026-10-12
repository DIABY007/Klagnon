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
import {
  Loader2,
  Plus,
  Users,
  Store,
  Sprout,
  Pencil,
  Trash2,
  PackageOpen,
} from "lucide-react";
import { toast } from "sonner";

interface Tier {
  id: string;
  nom: string;
  type: "Fournisseur" | "Client";
  contact: string | null;
  created_at: string;
}

type TabType = "Fournisseur" | "Client";

export default function PartenairesPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("Fournisseur");

  const supabase = createClient();

  /* ── Dialogs ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ── Formulaires ── */
  const [formNom, setFormNom] = useState("");
  const [formType, setFormType] = useState<TabType>("Fournisseur");
  const [formContact, setFormContact] = useState("");

  function resetForm() {
    setFormNom("");
    setFormContact("");
  }

  const loadData = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("tiers")
        .select("*")
        .order("nom");

      if (data) setTiers(data as Tier[]);
    } catch (err) {
      console.error("Erreur chargement tiers :", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fournisseurs = tiers.filter((t) => t.type === "Fournisseur");
  const clients = tiers.filter((t) => t.type === "Client");
  const listeActive = activeTab === "Fournisseur" ? fournisseurs : clients;

  /* ── Créer ── */
  const handleCreate = async () => {
    if (!formNom.trim()) {
      toast.error("Le nom est requis");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("tiers").insert({
        nom: formNom.trim(),
        type: formType,
        contact: formContact.trim() || null,
      });

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }

      toast.success(`${formType} « ${formNom.trim()} » créé`);
      setCreateOpen(false);
      resetForm();
      await loadData();
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Modifier ── */
  const handleEdit = async () => {
    if (!editTarget || !formNom.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("tiers")
        .update({
          nom: formNom.trim(),
          contact: formContact.trim() || null,
        })
        .eq("id", editTarget.id);

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }

      toast.success(`${formNom.trim()} mis à jour`);
      setEditOpen(false);
      setEditTarget(null);
      resetForm();
      await loadData();
    } catch {
      toast.error("Erreur lors de la modification");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Supprimer ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("tiers")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }

      toast.success(`${deleteTarget.nom} supprimé`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setSubmitting(false);
    }
  };

  function openEdit(t: Tier) {
    setEditTarget(t);
    setFormNom(t.nom);
    setFormContact(t.contact ?? "");
    setEditOpen(true);
  }

  function openDelete(t: Tier) {
    setDeleteTarget(t);
    setDeleteOpen(true);
  }

  /* ── Rendu ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Partenaires
          </h1>
          <p className="text-muted-foreground text-sm">
            Gestion des fournisseurs et des clients
          </p>
        </div>

        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setCreateOpen(open);
          }}
        >
          <DialogTrigger>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau partenaire
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nouveau partenaire</DialogTitle>
              <DialogDescription>
                Ajouter un fournisseur ou un client
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tiers-type">Type</Label>
                <Select
                  value={formType}
                  onValueChange={(val: string | null) =>
                    val && setFormType(val as TabType)
                  }
                >
                  <SelectTrigger id="tiers-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fournisseur">
                      <Sprout className="h-3 w-3 mr-1" />
                      Fournisseur
                    </SelectItem>
                    <SelectItem value="Client">
                      <Store className="h-3 w-3 mr-1" />
                      Client
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tiers-nom">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tiers-nom"
                  type="text"
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  placeholder="Nom du partenaire"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tiers-contact">Contact</Label>
                <Input
                  id="tiers-contact"
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="Téléphone ou email"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleCreate} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer le partenaire"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cartes stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Fournisseurs
            </CardTitle>
            <Sprout className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {fournisseurs.length}
            </div>
            <CardDescription>Fournisseurs enregistrés</CardDescription>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Store className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {clients.length}
            </div>
            <CardDescription>Clients enregistrés</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {tiers.length}
            </div>
            <CardDescription>Partenaires au total</CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center border-b border-border">
            <button
              onClick={() => setActiveTab("Fournisseur")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "Fournisseur"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sprout className="h-4 w-4" />
              Fournisseurs
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {fournisseurs.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("Client")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "Client"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store className="h-4 w-4" />
              Clients
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {clients.length}
              </span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {listeActive.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PackageOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun {activeTab === "Fournisseur" ? "fournisseur" : "client"}
                enregistré
              </p>
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormType(activeTab);
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un {activeTab === "Fournisseur" ? "fournisseur" : "client"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date d&apos;ajout</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listeActive.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.type === "Fournisseur" ? (
                            <Sprout className="h-4 w-4 text-amber-600 shrink-0" />
                          ) : (
                            <Store className="h-4 w-4 text-blue-600 shrink-0" />
                          )}
                          {t.nom}
                        </div>
                      </TableCell>
                      <TableCell>
                        {t.contact ?? (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {/* Éditer */}
                          <Dialog
                            open={editOpen && editTarget?.id === t.id}
                            onOpenChange={(open) => {
                              if (!open) {
                                setEditOpen(false);
                                setEditTarget(null);
                                resetForm();
                              }
                            }}
                          >
                            <DialogTrigger>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(t)}
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Modifier le partenaire</DialogTitle>
                                <DialogDescription>
                                  Modifier les informations de {t.nom}
                                </DialogDescription>
                              </DialogHeader>

                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label>Type</Label>
                                  <p className="text-sm font-medium text-foreground">
                                    {t.type}
                                  </p>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-nom">
                                    Nom <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    id="edit-nom"
                                    type="text"
                                    value={formNom}
                                    onChange={(e) => setFormNom(e.target.value)}
                                    placeholder="Nom"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-contact">Contact</Label>
                                  <Input
                                    id="edit-contact"
                                    type="text"
                                    value={formContact}
                                    onChange={(e) => setFormContact(e.target.value)}
                                    placeholder="Téléphone ou email"
                                  />
                                </div>
                              </div>

                              <DialogFooter>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setEditOpen(false);
                                    setEditTarget(null);
                                    resetForm();
                                  }}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  type="button"
                                  onClick={handleEdit}
                                  disabled={submitting}
                                >
                                  {submitting ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Enregistrement...
                                    </>
                                  ) : (
                                    "Enregistrer"
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          {/* Supprimer */}
                          <Dialog
                            open={deleteOpen && deleteTarget?.id === t.id}
                            onOpenChange={(open) => {
                              if (!open) {
                                setDeleteOpen(false);
                                setDeleteTarget(null);
                              }
                            }}
                          >
                            <DialogTrigger>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => openDelete(t)}
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[400px]">
                              <DialogHeader>
                                <DialogTitle>Confirmer la suppression</DialogTitle>
                                <DialogDescription>
                                  Êtes-vous sû de vouloir supprimer{" "}
                                  <strong>{deleteTarget?.nom}</strong> ?
                                  <br />
                                  <span className="text-destructive">
                                    Cette action est irréversible.
                                  </span>
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setDeleteOpen(false);
                                    setDeleteTarget(null);
                                  }}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={handleDelete}
                                  disabled={submitting}
                                >
                                  {submitting ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Suppression...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Supprimer
                                    </>
                                  )}
                                </Button>
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