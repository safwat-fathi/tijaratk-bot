export interface ProductVariant {
  label?: string;
  sku?: string;
  price?: number;
  stock?: number;
  [key: string]: unknown;
}

export interface Product {
  id: string;
  merchant_id: string;
  name: string;
  aliases: string[];
  variants: ProductVariant[] | Record<string, unknown>;
  price: number | null;
  image_url?: string | null;
  offer_price?: number | null;
  offer_ends_at?: string | null;
  offer_active?: boolean;
}


