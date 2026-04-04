"""NotebookLM-py sarmalayıcı — içerik üretimini yönetir.
generate_* → wait_for_completion → download_* akışıyla çalışır."""

import asyncio
import base64
import json
import os
from pathlib import Path
from typing import Callable, Awaitable

from app.config import settings, TEMP_DIR
from app.models.schemas import GenerateRequest
from app.auth_store.cookie_manager import load_cookie

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


LIST_METHOD_MAP = {
    "AUDIO_OVERVIEW": "list_audio",
    "AUDIO_QUIZ": "list_audio",
    "VIDEO_OVERVIEW": "list_video",
    "INFOGRAPHIC": "list_infographics",
    "SLIDE_DECK": "list_slide_decks",
    "QUIZ": "list_quizzes",
    "FLASHCARDS": "list_flashcards",
    "STUDY_GUIDE": "list_reports",
}


async def _wait_for_artifact_via_list(
    client, nb_id: str, fmt: str, timeout: int = 600
) -> "GenerationStatus":
    """generate sonrası artifact_id parse edilemediğinde list_* ile artifact'ı bulur."""
    from notebooklm import GenerationStatus as GS

    list_method_name = LIST_METHOD_MAP.get(fmt)
    if not list_method_name:
        return GS(task_id="", status="failed", error=f"list metodu bulunamadı: {fmt}")

    list_fn = getattr(client.artifacts, list_method_name, None)
    if not list_fn:
        return GS(task_id="", status="failed", error=f"list metodu mevcut değil: {list_method_name}")

    start = asyncio.get_running_loop().time()
    while True:
        artifacts = await list_fn(nb_id)
        if artifacts:
            # En son oluşturulan (completed) artifact'ı al
            completed = [a for a in artifacts if a.status == "completed"]
            if completed:
                return GS(task_id=completed[-1].id, status="completed")
            # Henüz processing olan var mı?
            processing = [a for a in artifacts if a.status in ("pending", "in_progress", "processing")]
            if processing:
                elapsed = asyncio.get_running_loop().time() - start
                if elapsed > timeout:
                    return GS(task_id="", status="failed", error=f"{fmt} üretimi zaman aşımına uğradı.")
                await asyncio.sleep(10)
                continue
        elapsed = asyncio.get_running_loop().time() - start
        if elapsed > timeout:
            return GS(task_id="", status="failed", error=f"{fmt} üretimi zaman aşımına uğradı.")
        # Artifact henüz görünmüyor — biraz bekle
        await asyncio.sleep(5)


def _load_cookie_for_generation(request: GenerateRequest) -> dict | None:
    """org_id varsa o org'un cookie'sini, yoksa mevcut ilk cookie'yi yükler."""
    org_id = getattr(request, "org_id", None)
    if org_id:
        return load_cookie(org_id)
    # org_id yoksa auth_store'daki ilk .enc dosyasını dene
    store_dir = Path(__file__).resolve().parent.parent.parent / "auth_store"
    for enc_file in store_dir.glob("*.enc"):
        org = enc_file.stem
        data = load_cookie(org)
        if data:
            return data
    return None


async def generate_content(
    job_id: str,
    request: GenerateRequest,
    update_status: UpdateFn,
) -> None:
    """NotebookLM üzerinden içerik üretir ve sonucu geçici dosyaya yazar."""
    from notebooklm import NotebookLMClient, AuthTokens

    # Auth bilgisini çöz — önce env var, yoksa cookie store'dan oku
    auth_raw = settings.notebooklm_auth_json
    if auth_raw:
        auth_data = json.loads(base64.b64decode(auth_raw))
        tokens = AuthTokens(**auth_data)
    else:
        # Cookie store'dan org bazlı cookie oku (browser login ile kaydedilmiş)
        cookie_data = _load_cookie_for_generation(request)
        if not cookie_data:
            raise RuntimeError(
                "NotebookLM bağlantısı bulunamadı. "
                "Ayarlar sayfasından Google hesabınızı bağlayın."
            )
        if "auth_state" in cookie_data:
            tokens = AuthTokens(**cookie_data["auth_state"])
        else:
            tokens = AuthTokens(**cookie_data)

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
            # notebooklm-py bazı formatlarda (infographic, video) artifact_id parse edemez
            # ve "no artifact_id returned" hatası döner. Bu durumda list_* ile artifact'ı ara.
            if gen_status.is_failed and "no artifact_id" in (gen_status.error or ""):
                gen_status = await _wait_for_artifact_via_list(
                    client, nb_id, request.format, timeout=600
                )

            if gen_status.is_failed:
                raise RuntimeError(gen_status.error or f"{request.format} üretimi başarısız oldu.")

            if not gen_status.is_complete:
                fmt_timeout = {
                    "VIDEO_OVERVIEW": 900,
                    "AUDIO_OVERVIEW": 600,
                    "AUDIO_QUIZ": 600,
                    "INFOGRAPHIC": 600,
                    "SLIDE_DECK": 900,
                }.get(request.format, 300)
                try:
                    final_status = await client.artifacts.wait_for_completion(
                        nb_id,
                        gen_status.task_id,
                        timeout=fmt_timeout,
                    )
                    if final_status.is_failed:
                        raise RuntimeError(final_status.error or f"{request.format} üretimi tamamlanamadı.")
                except TimeoutError:
                    # notebooklm-py _is_media_ready bazen URL'i bulamaz ve
                    # status'u PROCESSING'e düşürür → sonsuz polling.
                    # Timeout olursa doğrudan download dene.
                    pass

            await update_status(job_id, "processing", 80)

            # 5. Dosyayı indir — retry ile (media hazır olmayabilir)
            if out_path.exists():
                out_path.unlink()
            dl_fn = getattr(client.artifacts, download_method)
            dl_kwargs: dict = {"notebook_id": nb_id, "output_path": str(out_path)}
            if request.format in ("QUIZ", "FLASHCARDS"):
                dl_kwargs["output_format"] = "json"

            max_dl_retries = 5
            for attempt in range(max_dl_retries):
                try:
                    await dl_fn(**dl_kwargs)
                    break
                except Exception as dl_err:
                    if attempt == max_dl_retries - 1:
                        raise RuntimeError(f"İçerik indirilirken hata: {dl_err}")
                    # Media henüz hazır değilse bekle ve tekrar dene
                    await asyncio.sleep(10)
            await update_status(job_id, "completed", 100, result_path=str(out_path))

        finally:
            # Notebook temizle
            try:
                await client.notebooks.delete(nb_id)
            except Exception:
                pass


def _safe_enum(enum_class: type, value: str | None, default=None):
    """String'i enum nesnesine çevirir, başarısızsa default döner."""
    if value is None:
        return default
    try:
        return enum_class[value]
    except (KeyError, TypeError):
        return default


def _build_generate_kwargs(nb_id: str, request: GenerateRequest) -> dict:
    """Format türüne göre generate fonksiyonuna gönderilecek parametreleri oluşturur."""
    from notebooklm import AudioFormat, AudioLength, VideoStyle, VideoFormat

    kwargs: dict = {"notebook_id": nb_id}

    fmt = request.format

    if fmt in ("AUDIO_OVERVIEW", "AUDIO_QUIZ"):
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        af = _safe_enum(AudioFormat, request.audio_format, AudioFormat.DEEP_DIVE)
        if af:
            kwargs["audio_format"] = af
        al = _safe_enum(AudioLength, request.audio_length)
        if al:
            kwargs["audio_length"] = al
        kwargs["language"] = request.language

    elif fmt == "VIDEO_OVERVIEW":
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        vs = _safe_enum(VideoStyle, request.video_style)
        if vs:
            kwargs["video_style"] = vs
        vf = _safe_enum(VideoFormat, request.video_format, VideoFormat.EXPLAINER)
        if vf:
            kwargs["video_format"] = vf
        kwargs["language"] = request.language

    elif fmt == "STUDY_GUIDE":
        if request.custom_instructions:
            kwargs["extra_instructions"] = request.custom_instructions
        kwargs["language"] = request.language

    elif fmt in ("QUIZ", "FLASHCARDS"):
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions

    elif fmt == "INFOGRAPHIC":
        from notebooklm import InfographicOrientation, InfographicDetail, InfographicStyle
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        io = _safe_enum(InfographicOrientation, request.orientation)
        if io:
            kwargs["orientation"] = io
        id_ = _safe_enum(InfographicDetail, request.detail_level)
        if id_:
            kwargs["detail_level"] = id_
        ist = _safe_enum(InfographicStyle, request.infographic_style)
        if ist:
            kwargs["style"] = ist
        kwargs["language"] = request.language

    elif fmt == "SLIDE_DECK":
        if request.custom_instructions:
            kwargs["instructions"] = request.custom_instructions
        kwargs["language"] = request.language

    return kwargs
