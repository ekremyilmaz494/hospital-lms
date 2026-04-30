// Türkçe departman adlarından semantic renge çeviri.
// Prototip referans: klinova-admin/styles.css:825-839.
const DEPT_SEMANTIC: Record<string, string> = {
  acil: '#dc2626',
  cerrahi: '#7c3aed',
  pediatri: '#f59e0b',
  kardio: '#e11d48',
  noroloji: '#0284c7',
  onkoloji: '#0d9668',
  radyo: '#64748b',
  labor: '#0891b2',
};

export const DEPARTMENT_COLORS = [
  '#0d9668', '#dc2626', '#7c3aed', '#e11d48', '#0284c7', '#f59e0b',
  '#0891b2', '#64748b', '#d97706', '#ec4899', '#14b8a6', '#f97316',
];

/** Türkçe departman adını semantic key'e çevirir. Bulursa renk döner, yoksa null. */
export function semanticDeptColor(name: string): string | null {
  const n = name
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıi̇]/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  if (n.includes('acil')) return DEPT_SEMANTIC.acil;
  if (n.includes('cerrah')) return DEPT_SEMANTIC.cerrahi;
  if (n.includes('cocuk') || n.includes('pediatri')) return DEPT_SEMANTIC.pediatri;
  if (n.includes('kardi') || n.includes('kalp')) return DEPT_SEMANTIC.kardio;
  if (n.includes('norol') || n.includes('beyin') || n.includes('sinir')) return DEPT_SEMANTIC.noroloji;
  if (n.includes('onkol') || n.includes('kanser')) return DEPT_SEMANTIC.onkoloji;
  if (n.includes('radyol') || n.includes('goruntul')) return DEPT_SEMANTIC.radyo;
  if (n.includes('labor') || n.includes('laborat') || n.includes('tahlil')) return DEPT_SEMANTIC.labor;
  return null;
}
