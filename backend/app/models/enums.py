import enum

DEFAULT_INTENTS = ["greeting", "spam", "reaction", "purchase_intent", "question", "other"]


class Direction(enum.StrEnum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"


class ModelTier(enum.StrEnum):
    RULE = "RULE"
    DEEPSEEK = "DEEPSEEK"


class ConvState(enum.StrEnum):
    NEW = "NEW"
    GATHERING = "GATHERING"
    CONFIRMING = "CONFIRMING"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"


class OrderStatus(enum.StrEnum):
    AUTO_CONFIRMED = "AUTO_CONFIRMED"
    PENDING_REVIEW = "PENDING_REVIEW"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    PREPARING = "PREPARING"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    GATHERING_ITEMS = "GATHERING_ITEMS"
    FAILED_VALIDATION = "FAILED_VALIDATION"


class Channel(enum.StrEnum):
    FACEBOOK = "FACEBOOK"
    INSTAGRAM = "INSTAGRAM"
    WHATSAPP = "WHATSAPP"


class CartStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    CHECKED_OUT = "CHECKED_OUT"


class OrderSource(enum.StrEnum):
    AI_EXTRACTION = "AI_EXTRACTION"
    CART_CHECKOUT = "CART_CHECKOUT"
    MANUAL = "MANUAL"


class VariantStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    DISCONTINUED = "DISCONTINUED"


class MerchantStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


class DeliveryAreaStatus(enum.StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class HandoffReason(enum.StrEnum):
    USER_REQUEST = "USER_REQUEST"
    AI_ESCALATION = "AI_ESCALATION"
    MERCHANT_TAKEOVER = "MERCHANT_TAKEOVER"
