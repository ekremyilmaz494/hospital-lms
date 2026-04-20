'use client';

export function Banner({
  tone, icon, children,
}: {
  tone: 'err' | 'amber';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const palette = tone === 'err'
    ? { bg: '#fdf5f2', border: '#e9c9c0', rail: '#b3261e', iconBg: '#b3261e', iconColor: '#fafaf7', title: '#7a1d14', text: '#7a1d14' }
    : { bg: '#fef6e7', border: '#e9c977', rail: '#b4820b', iconBg: '#b4820b', iconColor: '#fafaf7', title: '#6a4e11', text: '#8a5a11' };

  return (
    <div className="b-root">
      <div className="b-icon">{icon}</div>
      <div className="b-body">{children}</div>
      <style jsx>{`
        .b-root {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 20px;
          background: ${palette.bg};
          border: 1px solid ${palette.border};
          border-radius: 14px;
          position: relative;
          overflow: hidden;
        }
        .b-root::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: ${palette.rail};
        }
        .b-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: ${palette.iconBg};
          color: ${palette.iconColor};
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .b-body { flex: 1; min-width: 0; }
        .b-body :global(h3) {
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          color: ${palette.title};
          margin: 0 0 2px;
          font-variation-settings: 'opsz' 28;
        }
        .b-body :global(h3 em) { font-style: italic; }
        .b-body :global(p) {
          font-size: 12px;
          color: ${palette.text};
          opacity: 0.8;
          line-height: 1.55;
          margin: 0;
        }
        .b-body :global(strong) { font-weight: 600; }
      `}</style>
    </div>
  );
}
