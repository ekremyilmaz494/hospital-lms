/**
 * OpenRouter prompt template'leri.
 *
 * Soru üretiminin "kaynağa sadık" davranması tamamen prompt'a bağlıdır.
 * Bu dosya tek bir kaynak: kontrolsüz hallucination = bug. Prompt değişikliği
 * yaparken `pnpm test src/lib/__tests__/openrouter-prompt.test.ts` çalıştır.
 */

export interface ExcludedQuestion {
  text: string;
}

/**
 * System prompt — modelin temel davranışını belirler.
 *
 * Anahtar kurallar:
 * 1. SADECE verilen kaynaktan üret — kafadan ekleme yok.
 * 2. Türkçe çıktı.
 * 3. Multiple-choice, 4 şık, tek doğru cevap.
 * 4. JSON çıktı (Zod ile parse ediyoruz).
 */
export const QUESTION_GENERATION_SYSTEM_PROMPT = `Sen bir hastane personel eğitim sistemi için sınav sorusu üreten uzman bir asistansın.

KRİTİK KURALLAR (HALLUCINATION YASAK):
1. Soruları SADECE verilen kaynak materyale dayanarak üret. Kaynakta EXPLICIT bir cümle/paragraf/madde olarak GEÇMEYEN hiçbir bilgiyi soruya katma.
2. "Genel sağlık bilgisi", "tıbbi sezgi", "sektör pratiği", "yaygın doğru" KULLANMA — kaynakta açıkça yazmıyorsa, BİLİMSEL OLARAK DOĞRU OLSA BİLE soru ÜRETME.
3. Şüpheli durumda AZ SORU üret — istenen sayıya ulaşmak için sahte/uydurulmuş soru ekleme. Eksik dönmek, yanlış üretmekten iyidir.
4. Yanıltıcı şıklar oluştururken bile o şıkların doğrulanabilirliği kaynağa dayanmalı (kaynakta açıkça yanlış olduğu anlaşılan ifadeler tercih edilir).
5. Her soru için kaynaktan birebir alıntı (sourceQuote) ZORUNLU — soru/cevap kanıtının kaynaktaki yerini gösterir. Birebir alıntı bulamıyorsan o soruyu üretme.
6. Çıktı dili TÜRKÇE olmalı. Tıbbi terimler Türkçe karşılıklarıyla (gerekirse parantez içinde Latince/İngilizce).
7. Her soru: 4 şıklı çoktan seçmeli, sadece 1 doğru cevap.
8. Sorular birbirinin tekrarı OLMAMALI — farklı kavram, farklı sayfa/bölüm hedefle.
9. Ton: profesyonel, hastane çalışanına yönelik. "Aşağıdakilerden hangisi", "Hangi durumda" gibi standart sınav formatı.

ÇIKTI FORMATI — KRİTİK:
- Cevabın TAMAMEN JSON olmalı. İlk karakter "{", son karakter "}" olacak.
- Markdown code fence (\`\`\`json) KULLANMA.
- "İşte sorularınız:", "Below is..." gibi PROSE intro/outro EKLEME.
- Sadece şu yapıyı döndür:

{
  "questions": [
    {
      "questionText": "Soru metni (sonunda ? işareti)",
      "options": ["Şık A metni", "Şık B metni", "Şık C metni", "Şık D metni"],
      "correctIndex": 0,
      "sourceQuote": "Kaynaktan birebir alıntı (max 200 karakter) — sorunun kanıtı",
      "sourcePage": 12
    }
  ]
}

- correctIndex 0-3 arasında integer, options'ta tam 4 eleman olmalı.
- sourceQuote ZORUNLU, boş string OLAMAZ. Bulunamıyorsa o soruyu üretme.
- sourcePage opsiyonel — kaynakta sayfa numarası varsa integer ekle, yoksa alanı tamamen atla.`;

/**
 * User prompt builder.
 *
 * @param count - kaç soru üretilsin
 * @param excluded - tekrar etmemesi gereken mevcut sorular (replenish için)
 * @param sourceNames - ekteki kaynak belge adları. Birden fazlaysa modele
 *   "soruları TÜM belgelere dengeli dağıt" talimatı eklenir (tek belgeye
 *   yığmayı / diğer belgeleri yok saymayı önler).
 */
export function buildUserPrompt(
  count: number,
  excluded: ExcludedQuestion[] = [],
  sourceNames: string[] = [],
): string {
  const lines: string[] = [];
  if (sourceNames.length > 1) {
    // Çoklu kaynak: model son/baskın content bloğuna yığmasın — kapsamı zorla.
    lines.push(
      `Ekte ${sourceNames.length} ayrı kaynak belge var: ${sourceNames
        .map((n, i) => `(${i + 1}) ${n}`)
        .join(', ')}.`,
    );
    lines.push(
      `Soruları bu belgelerin TÜMÜNE dengeli dağıt — HER belgeden soru üret, hiçbir belgeyi atlama, tek bir belgeye yığma. Toplam ${count} adet sınav sorusu üret.`,
    );
  } else {
    lines.push(`Lütfen ekteki kaynak materyale dayanarak ${count} adet sınav sorusu üret.`);
  }

  if (excluded.length > 0) {
    lines.push('');
    lines.push('Aşağıdaki sorular ZATEN üretilmiş — onları tekrar etme, farklı kavramları hedefle:');
    excluded.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.text}`);
    });
  }

  lines.push('');
  lines.push(`Sadece JSON formatında ${count} soru içeren bir array döndür. Başka metin/açıklama EKLEME.`);
  return lines.join('\n');
}
