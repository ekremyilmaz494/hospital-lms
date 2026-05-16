"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface TermsModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback fired after terms are successfully accepted */
  onAccepted: () => void;
}

/**
 * Modal that requires the user to accept Terms of Service and Privacy Policy.
 * Calls PUT /api/auth/accept-terms on acceptance.
 */
export function TermsModal({ open, onAccepted }: TermsModalProps) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/accept-terms", {
        method: "PUT",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Bir hata olustu. Lutfen tekrar deneyin.");
      }

      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kullanim Sartlari ve Gizlilik Politikasi</DialogTitle>
          <DialogDescription>
            Platformumuzu kullanmaya devam edebilmek icin asagidaki sartlari kabul
            etmeniz gerekmektedir.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div
            className="rounded-xl p-4 text-sm leading-relaxed space-y-2"
            style={{
              backgroundColor: "var(--color-surface-alt, #f8fafc)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <p>
              Platformumuzu kullanarak kisisel verilerinizin{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="underline font-medium"
                style={{ color: "var(--brand-600)" }}
              >
                Gizlilik Politikamiz
              </Link>{" "}
              kapsaminda islenmesini ve{" "}
              <Link
                href="/terms"
                target="_blank"
                className="underline font-medium"
                style={{ color: "var(--brand-600)" }}
              >
                Kullanim Sartlarimiza
              </Link>{" "}
              tabi olmayi kabul etmis olursunuz.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox
              checked={checked}
              onCheckedChange={(val) => setChecked(val === true)}
              className="mt-0.5"
            />
            <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
              Kullanim Sartlari ve Gizlilik Politikasini okudum, kabul ediyorum.
            </span>
          </label>

          {error && (
            <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={!checked || loading}
            onClick={handleAccept}
            className="w-full sm:w-auto"
            style={{
              backgroundColor: checked ? "var(--brand-600)" : undefined,
              color: checked ? "#fff" : undefined,
            }}
          >
            {loading ? "Kaydediliyor..." : "Kabul Et"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
