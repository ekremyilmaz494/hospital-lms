# AI İçerik Stüdyosu — Python Servis Yapılandırması

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    internal_api_key: str = "dev-key"
    notebooklm_auth_json: str = ""
    notebooklm_cookie_path: str = "./auth/cookies.json"
    port: int = 8100
    temp_dir: str = "./temp"
    max_generation_timeout: int = 300  # saniye

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

TEMP_DIR = Path(settings.temp_dir)
TEMP_DIR.mkdir(exist_ok=True)
