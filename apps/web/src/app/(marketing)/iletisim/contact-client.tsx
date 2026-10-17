'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Send } from 'lucide-react';
import { readAttribution } from '@/lib/attribution';

type FieldName = 'name' | 'email' | 'subject' | 'message';
type FormState = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

/** Alanlar formdaki sırayla: ilk hatalı alana odak bu sıraya göre verilir. */
const FIELD_ORDER: readonly FieldName[] = ['name', 'email', 'subject', 'message'];

const FIELD_ID: Record<FieldName, string> = {
  name: 'iletisim-ad',
  email: 'iletisim-eposta',
  subject: 'iletisim-konu',
  message: 'iletisim-mesaj',
};

const FIELD_MESSAGES: Record<FieldName, { missing: string; invalid?: string }> = {
  name: { missing: 'Adınızı ve soyadınızı yazın.' },
  email: {
    missing: 'E-posta adresinizi yazın.',
    invalid: 'Geçerli bir e-posta adresi yazın, örneğin ad@kurum.com.',
  },
  subject: { missing: 'Mesajınızın konusunu yazın.' },
  message: { missing: 'Mesajınızı yazın.' },
};

const SUMMARY_INVALID = 'Mesajınız gönderilmedi. İşaretli alanları kontrol edin.';
const ERROR_GENERIC = 'Bir hata oluştu. Lütfen tekrar deneyin.';
const ERROR_NETWORK = 'Bağlantı hatası. Lütfen tekrar deneyin.';
const ERROR_RATE_LIMIT = 'Çok fazla istek gönderdiniz. Lütfen bir saat sonra tekrar deneyin.';
const HTTP_TOO_MANY_REQUESTS = 429;

type Control = HTMLInputElement | HTMLTextAreaElement;

/** Tarayıcının yerleşik kurallarını (required, type="email") okuyup Türkçe mesaja çevirir. */
function fieldError(el: Control, name: FieldName): string | undefined {
  if (el.validity.valueMissing) return FIELD_MESSAGES[name].missing;
  if (el.validity.typeMismatch) return FIELD_MESSAGES[name].invalid ?? FIELD_MESSAGES[name].missing;
  return undefined;
}

function controlOf(form: HTMLFormElement, name: FieldName): Control | null {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
}

/**
 * İletişim formu (istemci yaprağı). Gönderim `/api/public/demo-request`'e
 * `[ILETISIM FORMU]` önekiyle düşer; uç nokta mesajı kaynağına göre ayırır.
 */
export function ContactClient() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submitted) successRef.current?.focus();
  }, [submitted]);

  function handleChange(e: React.ChangeEvent<Control>) {
    const name = e.target.name as FieldName;
    const target = e.target;
    setForm((prev) => ({ ...prev, [name]: target.value }));
    setError(null);
    // Hata gösterilen alan düzeltildikçe mesaj güncellenir; yeni hata erken gösterilmez.
    if (fieldErrors[name]) {
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
      // Backend korunur: iletişim formu demo-request endpoint'ine düşer.
      const res = await fetch('/api/public/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.name,
          lastName: '-',
          email: form.email,
          phone: '-',
          organizationName: form.subject,
          staffCount: '-',
          message: `[ILETISIM FORMU] ${form.message}`,
          attribution: readAttribution(),
        }),
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

  function describedBy(name: FieldName): string | undefined {
    return fieldErrors[name] ? `${FIELD_ID[name]}-hata` : undefined;
  }

  return (
    <div className="s-card s-formpage-card">
      {/* Başarı mesajı canlı bölgede: ekran okuyucu duyurur, odak başlığa taşınır. */}
      <div aria-live="polite">
        {submitted && (
          <div className="s-formpage-success">
            <h2 ref={successRef} tabIndex={-1} className="s-h2">
              Mesajınız iletildi
            </h2>
            <p>Teşekkür ederiz. En kısa sürede size geri dönüş yapacağız.</p>
            <Link href="/" className="s-btn s-btn-ghost">
              Ana sayfaya dön
            </Link>
          </div>
        )}
      </div>

      {!submitted && (
        <>
          <h2 className="s-h2">Mesaj gönderin</h2>
          <p className="s-formpage-intro">
            <span className="s-required" aria-hidden="true">*</span> ile işaretli alanların doldurulması
            zorunludur.
          </p>

          <form className="s-form" onSubmit={handleSubmit} noValidate aria-describedby={error ? 'iletisim-ozet' : undefined}>
            {error && (
              <div id="iletisim-ozet" role="alert" className="s-form-alert s-form-alert-error">
                {error}
              </div>
            )}

            <div className="s-form-row">
              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.name}>
                  Ad Soyad <span className="s-required" aria-hidden="true">*</span>
                </label>
                <input
                  id={FIELD_ID.name}
                  className="s-input"
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Adınız Soyadınız"
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={describedBy('name')}
                />
                {fieldErrors.name && (
                  <p id={`${FIELD_ID.name}-hata`} className="s-field-error">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div className="s-field">
                <label className="s-label" htmlFor={FIELD_ID.email}>
                  E-posta <span className="s-required" aria-hidden="true">*</span>
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
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={describedBy('email')}
                />
                {fieldErrors.email && (
                  <p id={`${FIELD_ID.email}-hata`} className="s-field-error">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="s-field">
              <label className="s-label" htmlFor={FIELD_ID.subject}>
                Konu <span className="s-required" aria-hidden="true">*</span>
              </label>
              <input
                id={FIELD_ID.subject}
                className="s-input"
                type="text"
                name="subject"
                required
                value={form.subject}
                onChange={handleChange}
                placeholder="Mesajınızın konusu"
                aria-invalid={fieldErrors.subject ? true : undefined}
                aria-describedby={describedBy('subject')}
              />
              {fieldErrors.subject && (
                <p id={`${FIELD_ID.subject}-hata`} className="s-field-error">
                  {fieldErrors.subject}
                </p>
              )}
            </div>

            <div className="s-field">
              <label className="s-label" htmlFor={FIELD_ID.message}>
                Mesaj <span className="s-required" aria-hidden="true">*</span>
              </label>
              <textarea
                id={FIELD_ID.message}
                className="s-textarea"
                name="message"
                rows={5}
                required
                value={form.message}
                onChange={handleChange}
                placeholder="Mesajınızı yazın"
                aria-invalid={fieldErrors.message ? true : undefined}
                aria-describedby={describedBy('message')}
              />
              {fieldErrors.message && (
                <p id={`${FIELD_ID.message}-hata`} className="s-field-error">
                  {fieldErrors.message}
                </p>
              )}
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
                  Mesajı gönder
                </>
              )}
            </button>

            <p className="s-formpage-note">
              Formdaki bilgileri mesajınıza yanıt vermek amacıyla işleriz. Kişisel verilerinizle
              ilgili haklarınız{' '}
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
