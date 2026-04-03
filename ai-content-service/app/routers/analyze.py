from fastapi import APIRouter, Depends

from app.models.schemas import AnalyzeRequest, AnalyzeResponse
from app.security import verify_internal_key

router = APIRouter(dependencies=[Depends(verify_internal_key)])

# Format önerileri için kural tablosu — kelime sayısına göre
_FORMAT_RULES = [
    ("AUDIO_OVERVIEW", "Podcast dinleyerek öğrenmek için"),
    ("VIDEO_OVERVIEW", "Görsel anlatımlı eğitim videosu için"),
    ("STUDY_GUIDE", "Kapsamlı çalışma rehberi için"),
    ("QUIZ", "Bilgi ölçme sınavı için"),
    ("FLASHCARDS", "Hızlı tekrar kartları için"),
    ("INFOGRAPHIC", "Özet infografik için"),
]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """
    Belge metnini analiz eder; özet, format önerileri ve anahtar konular döndürür.
    NotebookLM çağrısı yapmadan hızlı yerel analiz — üretim öncesi ön izleme.
    """
    words = request.document_text.split()
    word_count = len(words)
    estimated_minutes = max(1, word_count // 200)  # ortalama okuma hızı

    # İlk 500 kelimeyi özet olarak kullan
    summary_words = words[:80]
    summary = " ".join(summary_words)
    if word_count > 80:
        summary += "..."

    # Anahtar konuları basit kelime frekansıyla çıkar
    stop_words = {
        "ve", "veya", "ile", "bu", "bir", "de", "da", "ki",
        "the", "a", "an", "and", "or", "is", "in", "of", "to",
    }
    freq: dict[str, int] = {}
    for w in words:
        w_clean = w.lower().strip(".,;:!?()")
        if len(w_clean) > 4 and w_clean not in stop_words:
            freq[w_clean] = freq.get(w_clean, 0) + 1

    top_topics = sorted(freq, key=lambda k: freq[k], reverse=True)[:6]

    # Tüm formatları öner (kullanıcı seçer)
    suggested = [f for f, _ in _FORMAT_RULES]

    return AnalyzeResponse(
        summary=summary,
        suggested_formats=suggested,
        key_topics=top_topics,
        estimated_duration_minutes=estimated_minutes,
    )
