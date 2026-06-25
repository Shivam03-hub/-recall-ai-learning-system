"""
Run this ONCE to create all tables in your Neon database.
"""
from db.database import engine, Base
from dotenv import load_dotenv
load_dotenv()
from db import models  # noqa — this import matters, it registers the table classes

Base.metadata.create_all(bind=engine)
print("✅ Tables created in Neon.")