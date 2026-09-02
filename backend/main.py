from fastapi import FastAPI
from sqlalchemy import text

from database import engine


app = FastAPI()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/db-health")
def database_health_check():
    with engine.connect() as connection:
        result = connection.execute(
            text("select count(*) from public.profiles")
        )

        profile_count = result.scalar_one()

    return {
        "database": "connected",
        "profile_count": profile_count
    }