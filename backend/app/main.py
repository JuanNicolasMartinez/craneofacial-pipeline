from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import cases, meshes, landmarks, pipeline
from app.api import websockets

app = FastAPI(
    title="Craneofacial Pipeline API",
    description="API para reconstrucción facial forense a partir de cráneo 3D",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router)
app.include_router(meshes.router)
app.include_router(landmarks.router)
app.include_router(pipeline.router)
app.include_router(websockets.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
