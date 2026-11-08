import { fetchProductsAction } from "@/app/merchant/actions";
import { ProductsClient } from "./products-client";
import { getCurrentMerchant } from "@/lib/dal";
import type { Product } from "@/lib/products";

function isRedirect(error: unknown): boolean {
  return (
    typeof (error as { digest?: unknown })?.digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export default async function ProductsPage() {
  const { merchantId } = await getCurrentMerchant();

  let products: Product[] = [];
  try {
    products = await fetchProductsAction();
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load products on server:", err);
  }

  return <ProductsClient merchantId={merchantId} initialProducts={products} />;
}
