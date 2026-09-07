from pydantic import BaseModel, Field


class ProductVariantRead(BaseModel):
    id: str
    product_id: str
    label: str
    sku: str | None
    price: float | None
    stock: int | None
    status: str
    attributes: dict


class ProductVariantCreate(BaseModel):
    label: str
    sku: str | None = None
    price: float | None = None
    stock: int | None = None
    attributes: dict = Field(default_factory=dict)


class ProductVariantUpdate(BaseModel):
    label: str | None = None
    sku: str | None = None
    price: float | None = None
    stock: int | None = None
    attributes: dict | None = None


class ProductRead(BaseModel):
    id: str
    merchant_id: str
    name: str
    aliases: list[str]
    variants: list[ProductVariantRead]
    price: float | None = None
    category: str | None = None
    description: str | None = None
    image_url: str | None = None


class ProductCreate(BaseModel):
    name: str
    aliases: list[str] = Field(default_factory=list)
    price: float | None = None
    category: str | None = None
    description: str | None = None
    image_url: str | None = None
    variants: list[ProductVariantCreate] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    name: str | None = None
    aliases: list[str] | None = None
    price: float | None = None
    category: str | None = None
    description: str | None = None
    image_url: str | None = None
