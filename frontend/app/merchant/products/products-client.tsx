"use client";

import { useMerchantData } from "@/lib/use-merchant-data";
import { ProductCatalog } from "@/components/merchant/product-catalog";
import { fetchProductsAction } from "@/app/merchant/actions";
import type { Product } from "@/lib/products";

export function ProductsClient({
  merchantId,
  initialProducts,
}: {
  merchantId: string;
  initialProducts: Product[];
}) {
  const { data: products, refresh } = useMerchantData<Product[]>(fetchProductsAction, merchantId, initialProducts);

  return (
    <div className="font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">المنتجات</h1>
        <p className="text-slate-500 mt-1">إدارة كتالوج المنتجات.</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <ProductCatalog
          products={products}
          merchantId={merchantId}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
