from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = "mongodb+srv://arsalajmal0805_db_user:arsal123@aiproject.lbxbjrv.mongodb.net/"
    DATABASE_NAME: str = "ai_attendance_system"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-this-in-production-09876543210"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
