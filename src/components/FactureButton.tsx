"use client";

import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";

applyPlugin(jsPDF);

function formatFCFA(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Types
interface VenteData {
  produit_nom: string;
  id: string;
  date: string;
  client_nom: string;
  client_contact: string | null;
  quantite: number;
  prix_unitaire: number;
  montant_total: number;
  mode_encaissement: string;
  statut_paiement: string;
}

interface FactureButtonProps {
  vente: VenteData;
  variant?: "ghost" | "outline" | "default";
  size?: "default" | "sm" | "icon";
  label?: string;
}

export default function FactureButton({
  vente,
  variant = "ghost",
  size = "icon",
  label,
}: FactureButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      // Couleurs Klagnon
      const PRIMARY = "#15803D"; // green-700
      const LIGHT_GREEN = "#F0FDF4"; // green-50
      const DARK_TEXT = "#14532D"; // green-900
      const MUTED = "#64748B";
      const BORDER = "#BBF7D0";

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      /* ── En-tête : Logo + Infos société ── */
      doc.setFillColor(PRIMARY);
      doc.rect(0, 0, pageWidth, 40, "F");

      doc.setTextColor("#FFFFFF");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("KLAGNON", margin, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Gestion Financière Agricole", margin, 26);

      doc.text("N° CC : ....................", pageWidth - margin, 18, {
        align: "right",
      });
      doc.text(
        "Tel : ....................",
        pageWidth - margin,
        26,
        { align: "right" }
      );

      /* ── Titre Facture ── */
      doc.setDrawColor(BORDER);
      doc.setFillColor(LIGHT_GREEN);
      doc.roundedRect(margin, 50, contentWidth, 18, 3, 3, "FD");

      doc.setTextColor(PRIMARY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("FACTURE", pageWidth / 2, 62, { align: "center" });

      /* ── Infos Facture ── */
      const infoY = 78;
      doc.setTextColor(DARK_TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("N° Facture :", margin, infoY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED);
      doc.text(vente.id.substring(0, 8).toUpperCase(), margin + 35, infoY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(DARK_TEXT);
      doc.text("Date :", margin + 80, infoY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED);
      doc.text(
        new Date(vente.date).toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        margin + 100,
        infoY
      );

      /* ── Client ── */
      const clientY = infoY + 12;
      doc.setDrawColor(BORDER);
      doc.setFillColor(LIGHT_GREEN);
      doc.roundedRect(margin, clientY, contentWidth, 22, 2, 2, "FD");

      doc.setTextColor(PRIMARY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("CLIENT", margin + 4, clientY + 7);

      doc.setTextColor(DARK_TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(vente.client_nom, margin + 4, clientY + 17);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED);
      doc.setFontSize(9);
      if (vente.client_contact) {
        doc.text(
          `Contact : ${vente.client_contact}`,
          margin + 4 + 80,
          clientY + 17
        );
      }

      /* ── Tableau des Produits ── */
      const tableY = clientY + 32;

      (doc as any).autoTable({
        startY: tableY,
        margin: { horizontal: margin },
        tableWidth: contentWidth,
        headStyles: {
          fillColor: PRIMARY,
          textColor: "#FFFFFF",
          fontStyle: "bold",
          fontSize: 9,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 9,
          textColor: DARK_TEXT,
        },
        alternateRowStyles: {
          fillColor: LIGHT_GREEN,
        },
        columns: [
          { header: "Désignation", dataKey: "designation" },
          { header: "Quantité (T)", dataKey: "quantite" },
          { header: "Prix unit. (FCFA)", dataKey: "prixUnitaire" },
          { header: "Total (FCFA)", dataKey: "total" },
        ],
        body: [
          {
            designation: vente.produit_nom,
            quantite: Number(vente.quantite).toFixed(3),
            prixUnitaire: formatFCFA(Number(vente.prix_unitaire)),
            total: formatFCFA(Number(vente.montant_total)),
          },
        ],
        foot: [
          [
            {
              content: "TOTAL",
              colSpan: 3,
              styles: {
                halign: "right",
                fontStyle: "bold",
                fontSize: 10,
                textColor: PRIMARY,
              },
            },
            {
              content: formatFCFA(Number(vente.montant_total)),
              styles: {
                halign: "right",
                fontStyle: "bold",
                fontSize: 10,
                textColor: PRIMARY,
              },
            },
          ],
        ],
        theme: "grid",
        styles: {
          lineColor: BORDER,
          lineWidth: 0.5,
        },
      });

      /* ── Mode de paiement & Statut ── */
      const lastY = (doc as any).lastAutoTable.finalY + 10;

      doc.setDrawColor(BORDER);
      doc.setFillColor(LIGHT_GREEN);
      doc.roundedRect(margin, lastY, contentWidth, 18, 2, 2, "FD");

      doc.setTextColor(DARK_TEXT);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Mode d'encaissement :", margin + 4, lastY + 7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PRIMARY);
      doc.text(vente.mode_encaissement, margin + 45, lastY + 7);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(DARK_TEXT);
      doc.text("Statut :", margin + 90, lastY + 7);
      doc.setFont("helvetica", "bold");

      const statutColor =
        vente.statut_paiement === "Payé"
          ? "#16A34A"
          : vente.statut_paiement === "Partiel"
            ? "#2563EB"
            : "#CA8A04";

      doc.setTextColor(statutColor);
      doc.text(vente.statut_paiement, margin + 115, lastY + 7);

      /* ── Mention légale ── */
      const footerY = lastY + 28;
      doc.setDrawColor(BORDER);
      doc.line(margin, footerY, pageWidth - margin, footerY);

      doc.setTextColor(MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(
        "KLAGNON — Gestion Financière Agricole",
        pageWidth / 2,
        footerY + 6,
        { align: "center" }
      );
      doc.text(
        "Merci de votre confiance.",
        pageWidth / 2,
        footerY + 11,
        { align: "center" }
      );

      /* ── Sauvegarde ── */
      const filename = `facture_klagnon_${vente.id.substring(0, 8)}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("Erreur génération facture :", err);
    } finally {
      setGenerating(false);
    }
  };

  if (size === "icon") {
    return (
      <Button
        variant={variant}
        size="icon"
        className="h-8 w-8"
        onClick={handleDownload}
        disabled={generating}
        title="Télécharger la facture"
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={generating}
    >
      {generating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-2 h-4 w-4" />
      )}
      {label || "Télécharger la facture"}
    </Button>
  );
}