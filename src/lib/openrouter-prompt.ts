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

KRİTİK KURALLAR:
1. Soruları SADECE verilen kaynak materyale dayanarak üret. Kaynakta açıkça yer ALMAYAN hiçbir bilgiyi soruya katma.
2. "Genel sağlık bilgisi" veya "tıbbi sezgi" kullanarak soru ÜRETME — kaynakta yoksa, sorma.
3. Her soruyu kaynaktaki spesifik bir cümle, paragraf veya prosedüre bağla.
4. Yanıltıcı şıklar oluştururken bile o şıkların doğrulanabilirliği kaynağa dayanmalı (kaynakta açıkça yanlış olduğu anlaşılan ifadeler tercih edilir).
5. Çıktı dili TÜRKÇE olmalı. Tıbbi terimler Türkçe karşılıklarıyla (gerekirse parantez içinde Latince/İngilizce).
6. Her soru: 4 şıklı çoktan seçmeli, sadece 1 doğru cevap.
7. Sorular birbirinin tekrarı OLMAMALI — farklı kavram, farklı sayfa/bölüm hedefle.
8. Ton: profesyonel, hastane çalışanına yönelik. "Aşağıdakilerden hangisi", "Hangi durumda" gibi standart sınav formatı.

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
      "correctIndex": 0
    }
  ]
}

correctIndex 0-3 arasında integer, options'ta tam 4 eleman olmalı.`;

/**
 * User prompt builder.
 *
 * @param count - kaç soru üretilsin
 * @param excluded - tekrar etmemesi gereken mevcut sorular (replenish için)
 */
export function buildUserPrompt(count: number, excluded: ExcludedQuestion[] = []): string {
  const lines: string[] = [];
  lines.push(`Lütfen ekteki kaynak materyale dayanarak ${count} adet sınav sorusu üret.`);

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
