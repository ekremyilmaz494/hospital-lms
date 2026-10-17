"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { readAttribution } from "@/lib/attribution";

const STAFF_OPTIONS = [
  "1-50",
  "51-100",
  "101-250",
  "251-500",
  "501-1000",
  "1000+",
];

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  staffCount: string;
  message: string;
};

type RequiredField = Exclude<keyof FormState, "message">;
type FieldErrors = Partial<Record<RequiredField, string>>;

/** Formdaki sıra: ilk hatalı alana odak bu sıraya göre verilir. */
const FIELD_ORDER: readonly RequiredField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "organizationName",
  "staffCount",
];

const FIELD_ID: Record<keyof FormState, string> = {
  firstName: "demo-ad",
  lastName: "demo-soyad",
  email: "demo-eposta",
  phone: "demo-telefon",
  organizationName: "demo-kurum",
  staffCount: "demo-personel",
  message: "demo-mesaj",
};

const FIELD_MESSAGES: Record<RequiredField, { missing: string; invalid?: string }> = {
  firstName: { missing: "Adınızı yazın." },
  lastName: { missing: "Soyadınızı yazın." },
  email: {
    missing: "E-posta adresinizi yazın.",
    invalid: "Geçerli bir e-posta adresi yazın, örneğin ad@kurum.com.",
  },
  phone: { missing: "Telefon numaranızı yazın." },
  organizationName: { missing: "Kurumunuzun adını yazın." },
  staffCount: { missing: "Personel sayısını seçin." },
};

const SUMMARY_INVALID = "Talebiniz gönderilmedi. İşaretli alanları kontrol edin.";
const ERROR_GENERIC = "Bir hata oluştu. Lütfen tekrar deneyin.";
const ERROR_NETWORK = "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.";
const ERROR_RATE_LIMIT = "Çok fazla istek gönderdiniz. Lütfen bir saat sonra tekrar deneyin.";
const HTTP_TOO_MANY_REQUESTS = 429;

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isRequiredField(name: string): name is RequiredField {
  return (FIELD_ORDER as readonly string[]).includes(name);
}

/** Tarayıcının yerleşik kurallarını (required, type="email") okuyup Türkçe mesaja çevirir. */
function fieldError(el: Control, name: RequiredField): string | undefined {
  if (el.validity.valueMissing) return FIELD_MESSAGES[name].missing;
  if (el.validity.typeMismatch) return FIELD_MESSAGES[name].invalid ?? FIELD_MESSAGES[name].missing;
  return undefined;
}

function controlOf(form: HTMLFormElement, name: RequiredField): Control | null {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
    ? el
    : null;
}

/** Demo talep formu (istemci yaprağı). Gövde olduğu gibi `/api/public/demo-request`'e gider. */
export function DemoClient() {
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationName: "",
    staffCount: "",
    message: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submitted) successRef.current?.focus();
  }, [submitted]);

  function handleChange(e: React.ChangeEvent<Control>) {
    const { name } = e.target;
    const target = e.target;
    setForm((prev) => ({ ...prev, [name]: target.value }));
    setError(null);
    // Hata gösterilen alan düzeltildikçe mesaj güncellenir; yeni hata erken gösterilmez.
    if (isRequiredField(name) && fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: fieldError(target, name) }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;

    const nextErrors: FieldErrors = {};
    let firstInvalid: Control | null = null;
    for (const name of FIELD_ORDER) {
      const el = controlOf(formEl, name);
      if (!el) continue;
      const message = fieldError(el, name);
      if (message) {
        nextErrors[name] = message;
        firstInvalid ??= el;
      }
    }
    setFieldErrors(nextErrors);
    if (firstInvalid) {
      setError(SUMMARY_INVALID);
      firstInvalid.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/public/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attribution: readAttribution() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          res.status === HTTP_TOO_MANY_REQUESTS ? ERROR_RATE_LIMIT : data.error || ERROR_GENERIC,
        );
        return;
      }

      setSubmitted(true);
    } catch {
      setError(ERROR_NETWORK);
    } finally {
      setLoading(false);
    }
  }

  function a11y(name: RequiredField) {
    const invalid = Boolean(fieldErrors[name]);
    return {
      "aria-invalid": invalid ? true : undefined,
      "aria-describedby": invalid ? `${FIELD_ID[name]}-hata` : undefined,
    } as const;
  }

  function errorFor(name: RequiredField) {
    const message = fieldErrors[name];
    return message ? (
      <p id={`${FIELD_ID[name]}-hata`} className="s-field-error">
        {message}
      </p>
    ) : null;
  }

  const requiredMark = (
    <span className="s-required" aria-hidden="true">
      *
    </span>
  );

  return (
    <div className="s-card s-formpage-card">
      {/* Başarı mesajı canlı bölgede: ekran okuyucu duyurur, odak başlığa taşınır. */}
      <div aria-live="polite">
        {submitted && (
          <div className="s-formpage-success">
            <h2 ref={successRef} tabIndex={-1} className="s-h2">
              Talebiniz alındı
            </h2>
            <p>Demo talebiniz iletildi. Ekibimiz en kısa sürede sizinle iletişime geçecek.</p>
            <Link href="/" className="s-btn s-btn-ghost">
              Ana sayfaya dön
            </Link>
          </div>
        )}
      </div>

      {!submitted && (
        <>
          <h2 className="s-h2">Demo talep formu</h2>
          <p className="s-formpage-intro">
            {requiredMark} ile işaretli alanların doldurulması zorunludur.
          </p>

          <form
            className="s-form"
            onSubmit={handleSubmit}
            noValidate
            aria-describedby={error ? "demo-ozet" : undefined}
          >
            {error && (
              <div id="demo-ozet" role="alert" className="s-form-alert s-form-alert-error">
                {error}
              </div>
            )}

            <div className="s-form-row">
              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.firstName}>
                  Ad {requiredMark}
                </label>
                <input
                  id={FIELD_ID.firstName}
                  className="s-input"
                  type="text"
                  name="firstName"
                  autoComplete="given-name"
                  required
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="Adınız"
                  {...a11y("firstName")}
                />
                {errorFor("firstName")}
              </div>
              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.lastName}>
                  Soyad {requiredMark}
                </label>
                <input
                  id={FIELD_ID.lastName}
                  className="s-input"
                  type="text"
                  name="lastName"
                  autoComplete="family-name"
                  required
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="Soyadınız"
                  {...a11y("lastName")}
                />
                {errorFor("lastName")}
              </div>
            </div>

            <div className="s-form-row">
              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.email}>
                  E-posta {requiredMark}
                </label>
                <input
                  id={FIELD_ID.email}
                  className="s-input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ornek@kurum.com"
                  {...a11y("email")}
                />
                {errorFor("email")}
              </div>
              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.phone}>
                  Telefon {requiredMark}
                </label>
                <input
                  id={FIELD_ID.phone}
                  className="s-input"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+90 5XX XXX XX XX"
                  {...a11y("phone")}
                />
                {errorFor("phone")}
              </div>
            </div>

            <div className="s-form-row">
              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.organizationName}>
                  Kurum adı {requiredMark}
                </label>
                <input
                  id={FIELD_ID.organizationName}
                  className="s-input"
                  type="text"
                  name="organizationName"
                  autoComplete="organization"
                  required
                  value={form.organizationName}
                  onChange={handleChange}
                  placeholder="Hastane veya kurum adı"
                  {...a11y("organizationName")}
                />
                {errorFor("organizationName")}
              </div>
              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.staffCount}>
                  Personel sayısı {requiredMark}
                </label>
                <select
                  id={FIELD_ID.staffCount}
                  className="s-select"
                  name="staffCount"
                  required
                  value={form.staffCount}
                  onChange={handleChange}
                  {...a11y("staffCount")}
                >
                  <option value="">Seçin</option>
                  {STAFF_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {errorFor("staffCount")}
              </div>
            </div>

            <div className="s-field">
              <label className="s-label" htmlFor={FIELD_ID.message}>
                Mesaj <span className="s-label-opt">(isteğe bağlı)</span>
              </label>
              <textarea
                id={FIELD_ID.message}
                className="s-textarea"
                name="message"
                rows={4}
                value={form.message}
                onChange={handleChange}
                placeholder="Özel gereksinimlerinizi veya sorularınızı yazabilirsiniz"
              />
            </div>

            <button
              type="submit"
              className="s-btn s-btn-primary s-formpage-submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  Gönderiliyor
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Demo talep edin
                </>
              )}
            </button>

            <p className="s-formpage-note">
              Formdaki bilgileri demo talebinizle ilgili sizinle iletişim kurmak amacıyla işleriz.
              Kişisel verilerinizle ilgili haklarınız{" "}
              <Link href="/kvkk" className="s-formpage-link">
                KVKK Aydınlatma Metni
              </Link>
              &apos;nde açıklanır.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
