from pydantic import BaseModel
from typing import Literal, Optional, List


class GenerateRequest(BaseModel):
    job_id: str
    format: Literal[
        "AUDIO_OVERVIEW",
        "VIDEO_OVERVIEW",
        "STUDY_GUIDE",
        "QUIZ",
        "AUDIO_QUIZ",
        "FLASHCARDS",
        "INFOGRAPHIC",
        "SLIDE_DECK",
    ]
    audio_format: Literal["DEEP_DIVE", "BRIEF", "CRITIQUE", "DEBATE"] = "DEEP_DIVE"
    audio_length: Optional[str] = None
    video_style: Literal["EXPLAINER", "BRIEF", "CINEMATIC", "SLIDE"] = "EXPLAINER"
    video_format: Optional[str] = None
    document_text: str
    document_title: str
    custom_instructions: Optional[str] = None
    language: str = "tr"
    orientation: Optional[str] = None
    detail_level: Optional[str] = None
    infographic_style: Optional[str] = None


class GenerateResponse(BaseModel):
    job_id: str
    status: Literal["queued", "processing", "completed", "failed"]


class StatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int  # 0-100
    result_type: Optional[str] = None  # audio | video | text | json
    result_path: Optional[str] = None
    error: Optional[str] = None


class AnalyzeRequest(BaseModel):
    document_text: str
    document_title: str


class AnalyzeResponse(BaseModel):
    summary: str
    suggested_formats: List[str]
    key_topics: List[str]
    estimated_duration_minutes: int
