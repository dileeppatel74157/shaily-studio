from pathlib import Path
from typing import List, Union, ClassVar

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    PROJECT_NAME: str = "Shaily Studio API"
    API_STR: str = "/api"

    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(
        cls, 
        v: Union[str, List[str]]
    ) -> Union[List[str], str]:

        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]

        if isinstance(v, (list, str)):
            return v

        raise ValueError(v)


    # Database Settings
    DATABASE_URL: str = (
        "postgresql+psycopg://shaily_admin:shaily_secure_password_123@localhost:5432/shaily_studio_dev"
    )


    # Redis Settings
    REDIS_URL: str = "redis://localhost:6379/0"


    # NVIDIA NIM Settings
    NVIDIA_API_KEY: str
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"


    # Project Root (.env location)
    ROOT_DIR: ClassVar[Path] = Path(__file__).resolve().parents[4]


    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()