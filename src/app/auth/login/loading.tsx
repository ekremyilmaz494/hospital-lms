// Login route'u için minimal loading state.
// Önceki versiyonda full-page skeleton vardı; landing→login geçişinde flash
// ediyordu. Yeni davranış: 300ms delay'li fade-in spinner. Hızlı yüklemelerde
// (middleware fast-path sayesinde <100ms) hiç görünmez; yavaş bağlantıda
// küçük spinner sessizce belirir.
//
// Cream zemin (#fafaf9) login page sağ panelinin zeminiyle birebir aynı —
// loading'den login'e geçişte zemin renk değişmez, sadece form içeriği belirir.
export default function Loading() {
  return (
    <div
      className="login-loading flex h-screen items-center justify-center"
      style={{ background: '#fafaf9' }}
    >
      <style>{`
        @keyframes login-loading-fadein {
          0%, 60% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes login-loading-spin {
          to { transform: rotate(360deg); }
        }
        .login-loading-indicator {
          opacity: 0;
          animation: login-loading-fadein 0.5s ease-out 0.3s forwards;
        }
        .login-loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e7e5e4;
          border-top-color: #0d9668;
          border-radius: 50%;
          animation: login-loading-spin 0.8s linear infinite;
        }
      `}</style>
      <div className="login-loading-indicator">
        <div className="login-loading-spinner" />
      </div>
    </div>
  )
}
