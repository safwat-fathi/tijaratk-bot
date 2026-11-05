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

export async function getProducts(): Promise<Product[]> {
  const baseUrl = process.env.BASE_API_URL;
  if (!baseUrl) {
    throw new Error("BASE_API_URL not configured");
  }
  const response = await fetch(
    `${baseUrl}/demo/products/`,
    { 
      cache: "no-store" 
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }
  return (await response.json()) as Product[];
}
