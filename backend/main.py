from fastapi import Depends, FastAPI
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Profile
from schemas import ProfileResponse


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

@app.get("/profiles", response_model=list[ProfileResponse])
def get_profiles(db: Session = Depends(get_db)):
    statement = select(Profile)

    profiles = db.scalars(statement).all()

    return profiles