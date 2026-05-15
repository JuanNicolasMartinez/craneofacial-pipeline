"""
Storage abstraction supporting local filesystem (dev) and Cloudflare R2 (prod).

Switch via STORAGE_BACKEND env var. The Protocol defines the contract; both
backends expose identical async APIs so callers never branch on backend type.
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Protocol

import aiofiles
import aiofiles.os
import boto3
from botocore.config import Config

from app.core.config import settings


class StorageBackend(Protocol):
    async def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str: ...
    async def download(self, key: str) -> bytes: ...
    async def get_url(self, key: str, expires_in: int = 3600) -> str: ...
    async def delete(self, key: str) -> None: ...
    async def exists(self, key: str) -> bool: ...


class LocalFilesystemBackend:
    def __init__(self, base_path: str, public_base_url: str) -> None:
        self._base = Path(base_path).resolve()
        self._base.mkdir(parents=True, exist_ok=True)
        self._public_base_url = public_base_url.rstrip("/")

    def _resolve(self, key: str) -> Path:
        target = (self._base / key).resolve()
        if not target.is_relative_to(self._base):
            raise ValueError(f"Path traversal blocked for key: {key!r}")
        return target

    async def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(target, "wb") as f:
            await f.write(data)
        return key

    async def download(self, key: str) -> bytes:
        target = self._resolve(key)
        async with aiofiles.open(target, "rb") as f:
            return await f.read()

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        # In local mode, FastAPI serves /files/{key} directly. No expiry needed.
        return f"{self._public_base_url}/files/{key}"

    async def delete(self, key: str) -> None:
        target = self._resolve(key)
        if target.exists():
            await aiofiles.os.remove(target)

    async def exists(self, key: str) -> bool:
        return self._resolve(key).exists()


class R2Backend:
    def __init__(self, account_id: str, access_key: str, secret_key: str, bucket: str, endpoint_url: str) -> None:
        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    async def upload(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    async def download(self, key: str) -> bytes:
        response = await asyncio.to_thread(self._client.get_object, Bucket=self._bucket, Key=key)
        return await asyncio.to_thread(response["Body"].read)

    async def get_url(self, key: str, expires_in: int = 3600) -> str:
        return await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._client.delete_object, Bucket=self._bucket, Key=key)

    async def exists(self, key: str) -> bool:
        try:
            await asyncio.to_thread(self._client.head_object, Bucket=self._bucket, Key=key)
            return True
        except Exception:
            return False


_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        if settings.STORAGE_BACKEND == "local":
            _storage = LocalFilesystemBackend(
                base_path=settings.STORAGE_LOCAL_PATH,
                public_base_url=settings.PUBLIC_BASE_URL,
            )
        elif settings.STORAGE_BACKEND == "r2":
            _storage = R2Backend(
                account_id=settings.R2_ACCOUNT_ID,
                access_key=settings.R2_ACCESS_KEY_ID,
                secret_key=settings.R2_SECRET_ACCESS_KEY,
                bucket=settings.R2_BUCKET_NAME,
                endpoint_url=settings.r2_endpoint,
            )
        else:
            raise ValueError(f"Unknown STORAGE_BACKEND: {settings.STORAGE_BACKEND}")
    return _storage
