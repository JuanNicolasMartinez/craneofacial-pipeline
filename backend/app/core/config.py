from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str

    R2_ACCOUNT_ID: str = "dev_mock"
    R2_ACCESS_KEY_ID: str = "dev_mock"
    R2_SECRET_ACCESS_KEY: str = "dev_mock"
    R2_BUCKET_NAME: str = "craneofacial-dev"
    R2_ENDPOINT_URL: str = "https://{account}.r2.cloudflarestorage.com"

    FLAME_MODEL_PATH: str = "/app/assets/flame/generic_model.pkl"

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    @property
    def r2_endpoint(self) -> str:
        return self.R2_ENDPOINT_URL.format(account=self.R2_ACCOUNT_ID)


settings = Settings()
