from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.core.config import settings
from app.api.routes import auth, cases, meshes, landmarks, pipeline, files, dev_flame
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

app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(meshes.router)
app.include_router(landmarks.router)
app.include_router(pipeline.router)
app.include_router(websockets.router)

if settings.STORAGE_BACKEND == "local":
    app.include_router(files.router)
    app.include_router(dev_flame.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}


# ── SPA ───────────────────────────────────────────────────────────────────────
# En el despliegue de contenedor único el build estático del frontend viaja en
# la misma imagen y lo sirve el propio api: un solo origen, sin CORS y con la
# cookie de sesión en modo `lax`. Si el directorio no existe (imagen de backend
# a secas, o frontend servido por un CDN), esto no se monta y nada cambia.
_dist = Path(settings.FRONTEND_DIST_PATH)

if settings.SERVE_FRONTEND and (_dist / "index.html").is_file():
    # Primer segmento de cada ruta ya registrada (/auth, /cases, /ws, /docs…).
    # El fallback del SPA no debe tragarse una ruta de API mal escrita: eso
    # devolvería index.html con 200 y ocultaría el error.
    _api_prefixes = {
        route.path.split("/")[1]
        for route in app.routes
        if getattr(route, "path", "").startswith("/")
    } - {""}

    @app.get("/{spa_path:path}", include_in_schema=False)
    async def serve_spa(spa_path: str):
        if spa_path.split("/")[0] in _api_prefixes:
            raise HTTPException(status_code=404, detail="Not Found")

        asset = (_dist / spa_path).resolve()
        if spa_path and asset.is_file() and asset.is_relative_to(_dist.resolve()):
            return FileResponse(asset)

        # Fallback de SPA: react-router resuelve la ruta en el navegador.
        return FileResponse(_dist / "index.html")
