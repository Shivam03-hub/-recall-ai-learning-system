"""
FastAPI application entrypoint.

Run with: uvicorn main:app --reload
"""
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi import FastAPI
from api.quizzes import router as quizzes_router
from api.auth import router as auth_router
from api.meetings import router as meetings_router
from api.topics import router as topics_router
import os
load_dotenv()



app = FastAPI(title="AI Meeting Assistant")


allowed_origins = ["http://localhost:3000"]
production_url = os.getenv("FRONTEND_URL")
if production_url:
    allowed_origins.append(production_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(meetings_router)
app.include_router(topics_router)
app.include_router(quizzes_router)
@app.get("/")
def root():
    return {"status": "AI Meeting Assistant API is running"}
