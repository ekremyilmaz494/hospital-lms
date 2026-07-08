# @klinovax/license-cli — Lisans İhraç CLI'ı

On-prem müşteri lisanslarını **offline** imzalayan araç seti. İhraç private
anahtarı HİÇBİR sunucuda durmaz — yalnız bu CLI ile, yerel makinede kullanılır.

## Anahtar töreni (bir kez, Faz 5)

```bash
# 1. İhraç anahtarı — SOĞUK SAKLAMA (lisansları imzalar)
pnpm --filter @klinovax/license-cli keygen -- --out ~/.config/klinovax/license-issuer.jwk

# 2. Makbuz anahtarı — private'ın base64'ü SaaS (Vercel) env'ine gider
pnpm --filter @klinovax/license-cli keygen -- --out ~/.config/klinovax/license-receipt.jwk
```

- Her iki komutun stdout'undaki **PUBLIC JWK**'ler
  `apps/web/src/lib/license/keys.ts` içindeki sabitlere yapıştırılır ve deploy edilir.
- `license-receipt.jwk` çıktısındaki base64 değer Vercel'de
  `LICENSE_RECEIPT_PRIVATE_KEY` olarak set edilir.
- `license-issuer.jwk` → USB'ye kopyala + fiziksel kasada sakla; makineden silme
  kararı sana ait (kaybı = tüm lisans imzalama yeteneğinin kaybı).
- ⚠️ Private JWK dosyalarını ASLA commit'leme / sohbete-e-postaya yapıştırma.

## Lisans kesme

```bash
pnpm --filter @klinovax/license-cli issue -- \
  --key ~/.config/klinovax/license-issuer.jwk \
  --customer "Özel Devakent Hastanesi" --slug devakent \
  --valid-until 2027-07-01 --max-staff 500 --max-orgs 1 \
  --out Klinovax-devakent-license.klv
```

Süresiz (kalıcı 390k modeli) için `--valid-until` yerine `--perpetual`.

Sonra **iki adım zorunlu**:
1. JWT'yi super-admin → **Lisanslar → Lisans Kaydet**'e yapıştır
   (kayıtsız lisans aktivasyon/heartbeat'te TANINMAZ; kayıt = iptal/izleme noktası).
2. `license.klv` dosyasını müşteriye teslim et (kurulumda /license ekranına yüklenir).

## Yenileme

Aynı müşteriye YENİ `issue` çalıştır (yeni jti) → super-admin'e kaydet → müşteriye
gönder. Alternatif dosyasız yol: aynı jti'li lisansın süresini uzatmak yerine yeni
JWT'yi kaydettiğinde, kurulum bir sonraki heartbeat'te `renewedLicense` ile
otomatik güncellenir (yalnız AYNI jti'ye yeni JWT kaydedilirse).

## İnceleme

```bash
pnpm --filter @klinovax/license-cli inspect -- --file license.klv \
  [--pub issuer-public.jwk]   # imza doğrulaması için
```

## Kapalı ağ (air-gap) müşterisi

İnternetsiz kurulum heartbeat atamaz; offline grace (varsayılan 14 gün) dolmadan
periyodik **offline makbuz** üret ve müşteriye ilet (USB/e-posta → /license ekranı):

```bash
pnpm --filter @klinovax/license-cli offline-receipt -- \
  --key ~/.config/klinovax/license-receipt.jwk \
  --license-id <uuid> --instance-id <uuid> --days 35 --out receipt.klr
```

`license-id`/`instance-id` super-admin lisans detay sayfasında ve müşterinin
/license ekranında görünür.
