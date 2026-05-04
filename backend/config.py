from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    elevenlabs_api_key: str
    tavily_api_key: str
    mongodb_uri: str
    database_name: str = "mock_interview_app"
    clerk_publishable_key: str
    clerk_secret_key: str
    judge0_api_key: str = ""
    judge0_api_url: str = "https://judge0-ce.p.rapidapi.com"
    featherless_api_key: str = ""
    groq_api_key: str = ""

    # AWS / S3 Configuration
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = ""

    redis_url: str = "redis://localhost:6379"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()