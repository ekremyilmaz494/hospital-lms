/**
 * Dağıtım modu tespiti — SaaS bulut (cloud) vs müşteri sunucusu (onprem).
 *
 * On-prem Docker imajı build edilirken `NEXT_PUBLIC_DEPLOYMENT_MODE=onprem`
 * verilir. `NEXT_PUBLIC_*` değişkenleri Next.js tarafından build sırasında
 * bundle'a GÖMÜLÜR (inline) — çalışma zamanında env değiştirerek modu
 * kapatmak mümkün değildir. Lisans zorlaması bu kalıcılığa dayanır; bu yüzden
 * kanonik bayrak NEXT_PUBLIC_ öneklisidir. Runtime `DEPLOYMENT_MODE` yalnız
 * lokal geliştirme/test kolaylığı içindir (`DEPLOYMENT_MODE=onprem pnpm dev`).
 *
 * Bayrak yokken davranış bulut (mevcut) davranışıyla birebir aynıdır.
 */
export function isOnPrem(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'onprem' ||
    process.env.DEPLOYMENT_MODE === 'onprem'
  )
}
