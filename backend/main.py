from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, close_database
from app.routes import admin, attendance_new

app = FastAPI(
    title="AI Attendance System API",
    description="Facial recognition-based attendance system",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(attendance_new.router)

@app.on_event("startup")
async def startup_event():
    init_db()
    print("✅ Server started successfully!")
    print(f"📝 API Documentation: http://localhost:8000/docs")

@app.on_event("shutdown")
async def shutdown_event():
    close_database()
    print("👋 Server shutdown complete")

@app.get("/")
async def root():
    return {
        "message": "Welcome to AI Attendance System API v2.0",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
