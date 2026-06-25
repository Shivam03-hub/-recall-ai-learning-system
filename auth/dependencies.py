"""
FastAPI dependency that protects routes — extracts and verifies the JWT
from the request, then fetches the actual User from the database.
"""

from fastapi import Depends, HTTPException, status

from sqlalchemy.orm import Session
from jose import JWTError

from db.database import get_db
from db.models import User
from auth.security import decode_access_token
from fastapi.security import HTTPBearer

oauth2_scheme = HTTPBearer()


def get_current_user(credentials = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        user_id = decode_access_token(token)
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_error

    return user