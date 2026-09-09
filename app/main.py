from __future__ import annotations

import hmac
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .game import (
    LEVELS,
    apply_exact_redaction,
    build_system_prompt,
    direct_input_filter,
    get_secret,
    public_levels,
    reset_secrets,
)
from .mistral_client import MistralClient, MistralError


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

client = MistralClient(
    api_key=os.getenv("MISTRAL_API_KEY", ""),
    model=os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
    base_url=os.getenv("MISTRAL_BASE_URL", "https://api.mistral.ai"),
)

app = FastAPI(
    title="Gandalf Mistral Local",
    description="Jeu local éducatif de prompt injection inspiré de Gandalf.",
    version="1.0.0",
)


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    level: int = Field(ge=1, le=8)
    message: str = Field(min_length=1, max_length=8000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=20)


class GuessRequest(BaseModel):
    level: int = Field(ge=1, le=8)
    guess: str = Field(min_length=1, max_length=200)


def _level_or_404(level_id: int):
    level = LEVELS.get(level_id)
    if level is None:
        raise HTTPException(status_code=404, detail="Niveau inconnu")
    return level


@app.get("/api/config")
async def config() -> dict:
    return {
        "configured": client.configured,
        "model": client.model,
        "levels": len(LEVELS),
    }


@app.get("/api/levels")
async def levels() -> list[dict]:
    return public_levels()


@app.post("/api/chat")
async def chat(req: ChatRequest) -> dict:
    level = _level_or_404(req.level)
    secret = get_secret(req.level)

    if not client.configured:
        raise HTTPException(
            status_code=503,
            detail="MISTRAL_API_KEY absente. Copie .env.example vers .env puis ajoute ta clé.",
        )

    if level.heuristic_input_guard and direct_input_filter(req.message):
        return {
            "reply": "🛡️ Le filtre d'entrée a bloqué cette formulation. Essaie une approche moins explicite.",
            "blocked": True,
            "guard": "input-heuristic",
        }

    if level.llm_input_guard:
        try:
            if await client.is_extraction_attempt(req.message):
                return {
                    "reply": "🛡️ La sentinelle a classé ce prompt comme tentative d'extraction.",
                    "blocked": True,
                    "guard": "input-llm",
                }
        except MistralError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    messages: list[dict[str, str]] = [
        {"role": "system", "content": build_system_prompt(level, secret)}
    ]
    for item in req.history[-12:]:
        messages.append({"role": item.role, "content": item.content})
    messages.append({"role": "user", "content": req.message})

    try:
        reply = await client.chat(messages)
    except MistralError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if level.semantic_output_guard:
        try:
            if await client.output_leaks_secret(secret, reply, strict=level.strict_semantic_guard):
                return {
                    "reply": "🛡️ Le juge de sortie a détecté une fuite potentielle et a supprimé la réponse.",
                    "blocked": True,
                    "guard": "output-semantic",
                }
        except MistralError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    if level.exact_output_guard:
        redacted = apply_exact_redaction(reply, secret)
        if redacted != reply:
            reply = redacted

    return {"reply": reply, "blocked": False, "guard": None}


@app.post("/api/guess")
async def guess(req: GuessRequest) -> dict:
    _level_or_404(req.level)
    expected = get_secret(req.level).strip().upper()
    supplied = req.guess.strip().upper()
    correct = hmac.compare_digest(expected, supplied)
    return {
        "correct": correct,
        "message": "✅ Mot de passe correct ! Niveau réussi." if correct else "❌ Ce n'est pas le bon mot de passe.",
    }


@app.post("/api/reset")
async def reset() -> dict:
    reset_secrets()
    return {"ok": True, "message": "Tous les mots de passe ont été régénérés."}


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "mistral_configured": client.configured, "model": client.model}


STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
