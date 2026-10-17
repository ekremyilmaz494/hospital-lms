/**
 * Modal (drawer) içinde Tab odak tuzağı için saf yardımcı.
 *
 * `index`: şu an odaklı öğenin odaklanabilir öğeler listesindeki sırası; odak
 * listenin dışındaysa -1. `count`: listedeki odaklanabilir öğe sayısı.
 *
 * Dönüş: odağın zorla taşınacağı öğenin sırası; tarayıcının doğal Tab
 * davranışına bırakılacaksa `null`.
 *  - son öğe + Tab → 0 (başa sar)
 *  - ilk öğe + Shift+Tab → son öğe
 *  - odak dışarıdaysa (-1) → Tab ilk öğeye, Shift+Tab son öğeye alır
 *  - ortadaki öğe veya boş liste → null
 */
export function getTrapTarget(index: number, count: number, shift: boolean): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  if (index < 0) return shift ? last : 0;
  if (shift && index === 0) return last;
  if (!shift && index === last) return 0;
  return null;
}
