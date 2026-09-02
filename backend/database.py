import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# Load environment variables from .env
load_dotenv()


# Read the database connection string
DATABASE_URL = os.getenv("DATABASE_URL")


# Stop the program if DATABASE_URL is missing
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL is not set")


# Create SQLAlchemy's connection manager
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)


# Creates database sessions when we need them
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()