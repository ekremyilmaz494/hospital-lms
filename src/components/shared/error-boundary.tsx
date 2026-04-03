"use client";

import React from "react";
import Link from "next/link";

/** ErrorBoundary bileseninin props tipleri */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Hata durumunda gosterilecek ozel fallback bileseni */
  fallback?: React.ReactNode;
}

/** ErrorBoundary bileseninin state tipleri */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Render hatalarini yakalayan React sinif bileseni.
 * Alt bilesenlerde olusan hatalari yakalar ve kullanici dostu bir hata sayfasi gosterir.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Client-side component: console.error browser DevTools'ta gorunur.
    // Server-side logger burada kullanilamaz ("use client" directive).
    // Merkezi hata izleme gerekirse /api/log-error endpoint'i olusturulabilir.
    console.error("[ErrorBoundary] Yakalanan hata:", error);
    console.error("[ErrorBoundary] Bilesen yigini:", errorInfo.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-4"
        role="alert"
        aria-live="assertive"
      >
        <div
          className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl p-8 text-center"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Hata ikonu */}
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background: "var(--color-error-bg)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--color-error)" }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          {/* Baslik */}
          <div className="flex flex-col gap-2">
            <h2
              className="text-xl font-semibold"
              style={{
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-display), 'Plus Jakarta Sans', system-ui, sans-serif",
              }}
            >
              Bir hata oluştu
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Beklenmeyen bir sorun meydana geldi. Lütfen tekrar deneyin veya ana
              sayfaya dönün.
            </p>
          </div>

          {/* Hata detayi (gelistirici modu) */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details
              className="w-full rounded-lg p-3 text-left text-xs"
              style={{
                background: "var(--color-error-bg)",
                border: "1px solid var(--color-error)",
                color: "var(--color-error)",
              }}
            >
              <summary
                className="cursor-pointer font-medium"
                style={{ color: "var(--color-error)" }}
              >
                Hata detayları
              </summary>
              <pre
                className="mt-2 overflow-auto whitespace-pre-wrap break-words"
                style={{
                  fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                }}
              >
                {this.state.error.message}
                {this.state.error.stack && (
                  <>
                    {"\n\n"}
                    {this.state.error.stack}
                  </>
                )}
              </pre>
            </details>
          )}

          {/* Aksiyon butonlari */}
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
              style={{
                background: "var(--color-primary)",
                color: "#ffffff",
                transition: "background var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--color-primary-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--color-primary)";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Yeniden dene
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
              style={{
                background: "var(--color-surface-hover)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border)",
                transition:
                  "background var(--transition-fast), border-color var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  "var(--color-border-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  "var(--color-border)";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Ana sayfaya dön
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Herhangi bir bileseni ErrorBoundary ile saran Higher-Order Component.
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent);
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: React.ReactNode
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}
