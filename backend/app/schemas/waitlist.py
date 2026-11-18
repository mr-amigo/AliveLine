from pydantic import BaseModel, EmailStr


class WaitlistIn(BaseModel):
    email: EmailStr
