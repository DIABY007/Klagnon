import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Sprout, Package, ShoppingCart, TrendingUp, Wallet, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const handleLogout = async () => {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  };

  const role = user.user_metadata?.role || "Agent de saisie";

  const modules = [
    {
      title: "Achats",
      description: "Gérer les achats et les frais annexes",
      icon: ShoppingCart,
      href: "/dashboard/achats",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Stock",
      description: "Suivi des stocks et déclaration des pertes",
      icon: Package,
      href: "/dashboard/stock",
      color: "text-secondary-foreground",
      bgColor: "bg-secondary/20",
    },
    {
      title: "Ventes",
      description: "Gérer les ventes et les factures",
      icon: TrendingUp,
      href: "/dashboard/ventes",
      color: "text-accent-foreground",
      bgColor: "bg-accent/10",
    },
    {
      title: "Trésorerie",
      description: "Suivi des caisses et des créances",
      icon: Wallet,
      href: "/dashboard/tresorerie",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Partenaires",
      description: "Fournisseurs et clients",
      icon: Users,
      href: "/dashboard/partenaires",
      color: "text-accent-foreground",
      bgColor: "bg-accent/10",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Barre de navigation */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg font-heading text-foreground leading-tight">Klagnon</h1>
              <p className="text-xs text-muted-foreground -mt-1">Gestion Financière</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
            <form action={handleLogout}>
              <Button variant="outline" size="sm" type="submit">
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold font-heading text-foreground">
            Tableau de Bord
          </h2>
          <p className="text-muted-foreground mt-1">
            Bienvenue sur Klagnon. Sélectionnez un module pour commencer.
          </p>
        </div>

        {/* Grille des modules */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((mod) => (
            <Link key={mod.title} href={mod.href}>
              <Card className="hover:shadow-lg transition-all hover:border-primary/30 cursor-pointer border-green-200 dark:border-green-800 group h-full">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl ${mod.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <mod.icon className={`h-6 w-6 ${mod.color}`} />
                  </div>
                  <CardTitle className="text-lg">{mod.title}</CardTitle>
                  <CardDescription>{mod.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}