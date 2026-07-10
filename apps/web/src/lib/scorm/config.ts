/** SCORM ingest/serving için paylaşılan sabitler ve env-yapılandırılabilir sınırlar. */

/** Feature-gate kapalıyken kullanıcıya dönen mesaj (iç detay yok). */
export const SCORM_FEATURE_DISABLED_MSG = 'SCORM desteği bu abonelik planında etkin değil.'

/** Varsayılan paket boyutu tavanı (MB). Bulut için makul; on-prem env ile artırılabilir. */
const DEFAULT_MAX_PACKAGE_MB = 150

/** İzin verilen en büyük SCORM paketi (MB) — env `SCORM_MAX_PACKAGE_MB` ile geçersiz kılınır. */
export function scormMaxPackageMb(): number {
  const raw = Number(process.env.SCORM_MAX_PACKAGE_MB)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_PACKAGE_MB
}

/** İzin verilen en büyük SCORM paketi (byte). */
export function scormMaxPackageBytes(): number {
  return scormMaxPackageMb() * 1024 * 1024
}
