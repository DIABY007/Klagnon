"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sprout } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const messages: Record<string, string> = {
        "Invalid login credentials": "Email ou mot de passe incorrect.",
        "Email not confirmed": "Veuillez confirmer votre adresse email.",
        "Invalid email": "Format d'email invalide.",
      };
      toast.error(messages[error.message] || error.message);
      setLoading(false);
      return;
    }

    toast.success("Connexion réussie !");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-green-950 dark:via-green-900 dark:to-green-950 p-4">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <Sprout className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground font-heading">Klagnon</h1>
          <p className="text-muted-foreground mt-1">Gestion Financière</p>
        </div>

        {/* Formulaire */}
        <Card className="border-green-200 dark:border-green-800 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-center">Connexion</CardTitle>
            <CardDescription className="text-center">
              Connectez-vous pour accéder à votre tableau de bord
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Klagnon — Gestion Financière Agricole
        </p>
      </div>
    </div>
  );
}