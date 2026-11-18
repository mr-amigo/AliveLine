from pydantic import BaseModel


class ImportOut(BaseModel):
    created: int
    updated: int
    skipped: int
    created_ids: list[int]  # lets the client run AI estimates on the new items
