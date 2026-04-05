# AI İçerik Stüdyosu — Python Servis Yapılandırması

import os
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    internal_api_key: str = "dev-key"
    notebooklm_auth_json: str = ""
    notebooklm_cookie_path: str = "./auth/cookies.json"
    port: int = 8100
    temp_dir: str = "./temp"
    max_generation_timeout: int = 300  # saniye
    cors_origins: str = "http://localhost:3000"  # virgülle ayrılmış origin'ler
    environment: str = os.getenv("NODE_ENV", "development")

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

TEMP_DIR = Path(settings.temp_dir)
TEMP_DIR.mkdir(exist_ok=True)
