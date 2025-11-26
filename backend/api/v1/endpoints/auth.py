from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from services import user as user_crud
from core.schemas import UserCreate, UserSchema, Token
from core.schemas import UserCreate, UserSchema, Token
from services.auth import create_access_token
from core.security import verify_password
from api import deps

router = APIRouter()

@router.post("/register", response_model=UserSchema, status_code=201)
async def register_user(user: UserCreate, db: deps.SessionDep):
    db_user = await user_crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return await user_crud.create_user(db=db, user=user)

@router.post("/login", response_model=Token)
async def login_for_access_token(db: deps.SessionDep, form_data: OAuth2PasswordRequestForm = Depends()):
    user = await user_crud.get_user_by_username(db, username=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "user": UserSchema.from_orm(user)}
