export default function Loading() {
  return (
    <div className="flex min-h-screen">
      {/* Sol panel skeleton — koyu arka plan */}
      <div
        className="hidden lg:flex lg:w-[55%]"
        style={{ background: 'linear-gradient(160deg, #064e3b 0%, #0a3d2e 35%, #051c14 100%)' }}
      />
      {/* Sağ panel skeleton — açık arka plan */}
      <div className="flex-1" style={{ background: 'var(--color-bg, #f1f5f9)' }} />
    </div>
  );
}
