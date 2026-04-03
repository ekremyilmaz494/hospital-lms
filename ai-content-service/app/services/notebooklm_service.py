"""NotebookLM-py sarmalayıcı — içerik üretimini yönetir.
generate_* → wait_for_completion → download_* akışıyla çalışır."""

import base64
import json
import os
from pathlib import Path
from typing import Callable, Awaitable

from app.config import settings, TEMP_DIR
from app.models.schemas import GenerateRequest

# Format → (generate metodu, download metodu, dosya uzantısı)
FORMAT_CONFIG = {
    "AUDIO_OVERVIEW":  ("generate_audio",       "download_audio",       "mp3"),
    "VIDEO_OVERVIEW":  ("generate_video",       "download_video",       "mp4"),
    "STUDY_GUIDE":     ("generate_study_guide", "download_report",      "md"),
    "QUIZ":            ("generate_quiz",        "download_quiz",        "json"),
    "AUDIO_QUIZ":      ("generate_audio",       "download_audio",       "mp3"),
    "FLASHCARDS":      ("generate_flashcards",  "download_flashcards",  "json"),
    "INFOGRAPHIC":     ("generate_infographic", "download_infographic", "png"),
    "SLIDE_DECK":      ("generate_slide_deck",  "download_slide_deck",  "pptx"),
}

UpdateFn = Callable[..., Awaitable[None]]


async def generate_content(
    job_id: str,
    request: GenerateRequest,
    update_status: UpdateFn,
) -> None:
    """NotebookLM üzerinden içerik üretir ve sonucu geçici dosyaya yazar."""
    from notebooklm import NotebookLMClient, AuthTokens

    # Auth bilgisini çöz
    auth_raw = settings.notebooklm_auth_json
    if not auth_raw:
        raise RuntimeError("NOTEBOOKLM_AUTH_JSON ortam değişkeni ayarlanmamış.")

    auth_data = json.loads(base64.b64decode(auth_raw))
    tokens = AuthTokens(**auth_data)

    fmt_cfg = FORMAT_CONFIG.get(request.format)
    if not fmt_cfg:
        raise ValueError(f"Bilinmeyen format: {request.format}")

    generate_method, download_method, ext = fmt_cfg
    out_path = TEMP_DIR / f"{job_id}.{ext}"

    async with NotebookLMClient(tokens) as client:
        await update_status(job_id, "processing", 10)

        # 1. Geçici notebook oluştur
        notebook = await client.notebooks.create(title=f"LMS-{job_id[:8]}")
        nb_id = notebook.id

        try:
            # 2. Belge metnini kaynak olarak ekle
            source = await client.sources.add_text(
                nb_id,
                title=request.document_title,
                content=request.document_text,
                wait=True,
            )
            await update_status(job_id, "processing", 30)

            # 3. Format bazlı üretim başlat
            gen_fn = getattr(client.artifacts, generate_method)
            gen_kwargs = _build_generate_kwargs(nb_id, request)
            gen_status = await gen_fn(**gen_kwargs)
            await update_status(job_id, "processing", 50)

            # 4. Tamamlanana dek bekle + hata kontrolü
            if gen_status.is_failed:
                raise RuntimeError(gen_status.error or f"{request.format} üretimi başarısız oldu.")

            if not gen_status.is_complete:
                # Video çok uzun sürer — formata göre timeout
                fmt_timeout = {
                    "VIDEO_OVERVIEW": 900,
                    "AUDIO_OVERVIEW": 600,
                    "AUDIO_QUIZ": 600,
                    "INFOGRAPHIC": 600,
                    "SLIDE_DECK": 900,
                }.get(request.format, 300)
                final_status = await client.artifacts.wait_for_completion(
                    nb_id,
                    gen_status.task_id,
                    timeout=fmt_timeout,
                )
                # wait_for_completion sonrası tekrar kontrol
                if final_status.is_failed:
                    raise RuntimeError(final_status.error or f"{request.format} üretimi tamamlanamadı.")

            await update_status(job_id, "processing", 80)

            # 5. Dosyayı indir (varsa önce sil — çakışma önleme)
            if out_path.exists():
                out_path.unlink()
            dl_fn = getattr(client.artifacts, download_method)
            try:
                if request.format in ("QUIZ", "FLASHCARDS"):
                    await dl_fn(nb_id, str(out_path), output_format="json")
                else:
                    await dl_fn(nb_id, str(out_path))
            except Exception as dl_err:
                raise RuntimeError(f"İçerik indirilirken hata: {dl_err}")
            await update_status(job_id, "completed", 100, result_path=str(out_path))

        finally:
            # Notebook temizle
            try:
                await client.notebooks.delete(nb_id)
            except Exception:
                pass


def _build_generate_kwargs(nb_id: str, request: GenerateRequest) -> dict:
    """Format türüne göre generate fonksiyonuna gönderilecek parametreleri oluşturur."""
    kwargs: dict = {"notebook_id": nb_id}

    fmt = request.format

    if fmt in ("AUDIO_OVERVIEW", "AUDIO_QUIZ"):
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        if request.audio_format:
            kwargs["audio_format"] = request.audio_format
        if request.audio_length:
            kwargs["audio_length"] = request.audio_length
        kwargs["language"] = request.language

    elif fmt == "VIDEO_OVERVIEW":
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        if request.video_style:
            kwargs["video_style"] = request.video_style
        if request.video_format:
            kwargs["video_format"] = request.video_format
        kwargs["language"] = request.language

    elif fmt == "STUDY_GUIDE":
        if request.custom_instructions:
            kwargs["extra_instructions"] = request.custom_instructions
        kwargs["language"] = request.language

    elif fmt in ("QUIZ", "FLASHCARDS"):
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions

    elif fmt == "INFOGRAPHIC":
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        if request.orientation:
            kwargs["orientation"] = request.orientation
        if request.detail_level:
            kwargs["detail_level"] = request.detail_level
        if request.infographic_style:
            kwargs["style"] = request.infographic_style
        kwargs["language"] = request.language

    elif fmt == "SLIDE_DECK":
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        kwargs["language"] = request.language

    return kwargs
