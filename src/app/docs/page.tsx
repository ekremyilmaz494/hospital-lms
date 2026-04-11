import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Dokumantasyonu — Devakent Hastanesi',
  description: 'Devakent Hastanesi REST API interaktif dokumantasyonu (OpenAPI / Swagger UI)',
}

/**
 * Swagger UI sayfasi — CDN uzerinden yuklenir, ek npm paketi gerektirmez.
 * OpenAPI spec'i /api/docs endpoint'inden JSON olarak cekilir.
 *
 * Guvenlik notu: dangerouslySetInnerHTML sadece statik/hardcoded icerikle
 * kullanilmaktadir — kullanici girdisi yoktur, XSS riski bulunmamaktadir.
 */
export default function ApiDocsPage() {
  // Tum icerik statik string literal — kullanici girdisi iceremez
  const staticCss = `
    body {
      margin: 0;
      background: #f8fafc;
    }
    .swagger-ui .topbar {
      display: none;
    }
    .docs-header {
      background: linear-gradient(135deg, #0d9668 0%, #047857 100%);
      color: #fff;
      padding: 24px 32px;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    }
    .docs-header h1 {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .docs-header p {
      margin: 0;
      font-size: 14px;
      opacity: 0.85;
    }
    .docs-header .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 12px;
      vertical-align: middle;
    }
    #swagger-ui {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 16px 64px;
    }
    .swagger-ui .opblock-tag {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    .swagger-ui .opblock.opblock-post .opblock-summary-method {
      background: #0d9668;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary-method {
      background: #2563eb;
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {
      background: #dc2626;
    }
    .swagger-ui .opblock.opblock-patch .opblock-summary-method {
      background: #d97706;
    }
    .swagger-ui .opblock.opblock-put .opblock-summary-method {
      background: #7c3aed;
    }
    .swagger-ui .btn.authorize {
      color: #0d9668;
      border-color: #0d9668;
    }
    .swagger-ui .btn.authorize svg {
      fill: #0d9668;
    }
    .docs-loading {
      text-align: center;
      padding: 64px 16px;
      font-family: system-ui, sans-serif;
      color: #64748b;
    }
    .docs-loading .spinner {
      display: inline-block;
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #0d9668;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `

  const staticInitScript = `
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof SwaggerUIBundle === 'undefined') {
        document.getElementById('swagger-ui').innerHTML =
          '<p style="color:red;text-align:center;padding:32px">Swagger UI yuklenemedi. Lutfen sayfayi yenileyin.</p>';
        return;
      }
      SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
        layout: 'BaseLayout',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: false,
        persistAuthorization: true,
        displayRequestDuration: true,
      });
    });
  `

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>API Dokumantasyonu — Devakent Hastanesi</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui.css"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" crossOrigin="anonymous" />
        {/* Static CSS — no user input, XSS-safe */}
        <style dangerouslySetInnerHTML={{ __html: staticCss }} />
      </head>
      <body>
        <div className="docs-header">
          <h1>
            Devakent Hastanesi API
            <span className="badge">v1.0.0</span>
          </h1>
          <p>Hastane Personel Egitim ve Sinav Yonetim Sistemi — REST API Dokumantasyonu</p>
        </div>

        <div id="swagger-ui">
          <div className="docs-loading">
            <div className="spinner" />
            <p>API dokumantasyonu yukleniyor...</p>
          </div>
        </div>

        {/* Static init script — no user input, XSS-safe */}
        <script dangerouslySetInnerHTML={{ __html: staticInitScript }} />
      </body>
    </html>
  )
}
