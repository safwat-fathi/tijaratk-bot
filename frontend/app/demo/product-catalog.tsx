"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product, ProductVariant } from "@/lib/products";
import * as m from "@/paraglide/messages";
import {
  createProductAction,
  deleteProductAction,
  deleteProductImageAction,
  updateProductAction,
  uploadProductImageAction,
} from "./actions";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// yyyy-mm-dd in the browser's local time, for <input type="date">
const toDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "long" });

type VariantRow = { label: string; price: string; stock: string };

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

function formatVariants(variants: ProductVariant[] | Record<string, unknown> | null) {
  if (!variants) return [];

  if (Array.isArray(variants)) {
    return variants.map((v) => {
      const key = v.label || v.sku || "Variant";
      let values = "";
      if (v.price) values += `${v.price} ${m.demo_catalog_egp()}`;
      if (v.stock) values += values ? ` (${v.stock})` : String(v.stock);
      if (!values) values = "متوفر";
      return { key, values };
    });
  }

  return Object.entries(variants).map(([key, value]) => {
    const values = Array.isArray(value) ? value.join(", ") : String(value);
    return { key, values };
  });
}

function getImageForProduct(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("denim")) return "/images/denim_jacket.jpg";
  if (lower.includes("linen")) return "/images/linen_dress.jpg";
  if (lower.includes("shirt")) return "/images/black_tshirt.jpg";
  return "/images/denim_jacket.jpg";
}

export function ProductCatalog({
  products,
  highlightedProductIds = [],
  merchantId,
  onRefresh,
  readOnly = false,
}: {
  products: Product[];
  highlightedProductIds?: string[];
  merchantId?: string;
  onRefresh?: () => void;
  readOnly?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [price, setPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerEndsAt, setOfferEndsAt] = useState(""); // yyyy-mm-dd, offer runs through the end of that day
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // blob URL or the saved image_url
  const [removeImage, setRemoveImage] = useState(false);

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    setError(null);
    setImageFile(file);
    setRemoveImage(false);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setName("");
    setAliases("");
    setPrice("");
    setOfferPrice("");
    setOfferEndsAt("");
    setVariants([]);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setAliases((p.aliases || []).join(", "));
    setPrice(p.price !== null ? String(p.price) : "");
    setOfferPrice(p.offer_price != null ? String(p.offer_price) : "");
    setOfferEndsAt(p.offer_ends_at ? toDateInput(p.offer_ends_at) : "");
    setVariants([]);
    setImageFile(null);
    setImagePreview(p.image_url ?? null);
    setRemoveImage(false);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAliases = aliases
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedPrice = price ? parseFloat(price) : null;
    const parsedOffer = offerPrice ? parseFloat(offerPrice) : null;
    if (parsedOffer !== null) {
      if (parsedPrice === null) return setError("حدد سعر المنتج أولاً قبل إضافة عرض");
      if (!(parsedOffer > 0 && parsedOffer < parsedPrice)) return setError("سعر العرض يجب أن يكون أقل من سعر المنتج");
    }
    setLoading(true);
    // Offer runs through the end of the chosen day (local time); both are cleared together when no offer price.
    const offerFields = {
      offer_price: parsedOffer,
      offer_ends_at: parsedOffer !== null && offerEndsAt ? new Date(`${offerEndsAt}T23:59:59`).toISOString() : null,
    };

    try {
      let productId: string;
      if (editingProduct) {
        productId = editingProduct.id;
        await updateProductAction(
          editingProduct.id,
          {
            name,
            aliases: parsedAliases,
            price: parsedPrice,
            ...offerFields,
          },
          merchantId
        );
      } else {
        const parsedVariants = variants
          .filter((v) => v.label.trim())
          .map((v) => ({
            label: v.label.trim(),
            price: v.price ? parseFloat(v.price) : undefined, // blank = follows the product price (and its offer)
            stock: v.stock ? parseInt(v.stock, 10) : 10,
          }));

        const created = await createProductAction(
          {
            name,
            aliases: parsedAliases,
            price: parsedPrice,
            ...offerFields,
            variants: parsedVariants,
          },
          merchantId
        );
        productId = created.id;
      }

      if (imageFile) {
        const fd = new FormData();
        fd.set("image", imageFile);
        await uploadProductImageAction(productId, fd);
      } else if (removeImage && editingProduct?.image_url) {
        await deleteProductImageAction(productId);
      }

      setModalOpen(false);
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    setLoading(true);
    try {
      await deleteProductAction(productId, merchantId);
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight">{m.demo_catalog_title()}</h2>
        {!readOnly && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة منتج
          </button>
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => {
          const isHighlighted = highlightedProductIds.includes(product.id);
          const variants = formatVariants(product.variants);

          return (
            <div
              key={product.id}
              className={`relative flex flex-col overflow-hidden rounded-xl border transition-all duration-300 ${
                isHighlighted
                  ? "border-emerald-500 bg-emerald-50/50 shadow-md ring-1 ring-emerald-500"
                  : "border-gray-200 bg-white shadow-sm hover:shadow-md"
              }`}
            >
              {isHighlighted && (
                <div className="absolute end-2 top-2 z-10 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                  {m.demo_catalog_matched()}
                </div>
              )}

              {/* Action Buttons: Edit / Delete */}
              {!readOnly && (
                <div className="absolute start-2 top-2 z-10 flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-gray-200">
                  <button
                    onClick={() => openEditModal(product)}
                    title="Edit product"
                    className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-emerald-700 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    title="Delete product"
                    className="rounded p-1 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote API URL, avoids next/image remotePatterns config
                  <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Image
                    src={getImageForProduct(product.name)}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    priority
                    className="object-cover"
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  {product.price !== null &&
                    (product.offer_active && product.offer_price != null ? (
                      <span className="flex flex-col items-end leading-tight">
                        <span className="font-semibold text-emerald-700">
                          {product.offer_price} {m.demo_catalog_egp()}
                        </span>
                        <span className="text-xs text-gray-400 line-through">{product.price}</span>
                      </span>
                    ) : (
                      <span className="font-semibold text-gray-900">
                        {product.price} {m.demo_catalog_egp()}
                      </span>
                    ))}
                </div>
                {product.offer_active && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    عرض{product.offer_ends_at ? ` حتى ${formatDate(product.offer_ends_at)}` : ""}
                  </p>
                )}
                {product.aliases && product.aliases.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {m.demo_catalog_aka()} {product.aliases.join(", ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <span
                      key={v.key}
                      className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
                    >
                      {v.key}: {v.values}
                    </span>
                  ))}
                  {variants.length === 0 && (
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {m.demo_catalog_no_options()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            {m.demo_catalog_empty()}
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="font-semibold text-lg text-gray-900">
                {editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-50"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: جاكيت جينز"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  الأسماء المستعارة / كلمات بالعامية (مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  placeholder="مثال: جاكيت جينز, چاكيت, جينز"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">السعر (جنيه)</label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="مثال: 750"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-xs font-semibold text-gray-700">عرض خاص (اختياري)</p>
                <p className="mb-2 mt-0.5 text-[11px] text-gray-500">
                  يظهر السعر القديم مشطوبًا، والبوت يذكر سعر العرض ويحسب به الطلب طوال مدة العرض.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-600">سعر العرض (جنيه)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      placeholder="مثال: 600"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-600">ينتهي في</label>
                    <input
                      type="date"
                      value={offerEndsAt}
                      min={toDateInput(new Date().toISOString())}
                      disabled={!offerPrice}
                      onChange={(e) => setOfferEndsAt(e.target.value)}
                      className={`${inputClass} disabled:opacity-50`}
                    />
                  </div>
                </div>
                {offerPrice && price && Number(offerPrice) > 0 && Number(offerPrice) < Number(price) && (
                  <p className="mt-2 text-[11px] font-medium text-emerald-700">
                    خصم {Math.round((1 - Number(offerPrice) / Number(price)) * 100)}٪
                    {offerEndsAt ? "" : " — بدون تاريخ انتهاء (يستمر حتى تحذفه)"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">صورة المنتج (اختياري)</label>
                <div className="flex items-center gap-3">
                  {imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element -- blob/remote preview
                    <img src={imagePreview} alt="" className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    {/* Native file input text follows the browser locale, so hide it and use our own Arabic label */}
                    <label
                      htmlFor="product-image"
                      className="inline-flex cursor-pointer items-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 focus-within:ring-2 focus-within:ring-emerald-500"
                    >
                      {imagePreview ? "تغيير الصورة" : "اختيار صورة"}
                      <input
                        id="product-image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          pickImage(e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                        className="sr-only"
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-gray-500">JPG أو PNG أو WebP، حتى 5 ميجابايت</p>
                  </div>
                  {imagePreview && (
                    <button type="button" onClick={clearImage} className="text-xs font-medium text-red-600 hover:underline">
                      إزالة
                    </button>
                  )}
                </div>
              </div>

              {!editingProduct && (
                <div className="mt-1">
                  <p className="text-xs font-semibold text-gray-700">الأنواع (اختياري)</p>
                  <p className="mb-2 mt-0.5 text-[11px] text-gray-500">
                    مثل المقاس أو اللون. لو تركت السعر فارغًا يُستخدم سعر المنتج (ويشمل العرض)، ولو تركت الكمية فارغة تُحسب 10. النوع الذي له سعر خاص لا يتأثر بالعرض.
                  </p>
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                    {variants.map((v, i) => {
                      const update = (patch: Partial<VariantRow>) =>
                        setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
                      return (
                        <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                              <label className="mb-1 block text-[11px] font-medium text-gray-600">اسم النوع</label>
                              <input
                                type="text"
                                value={v.label}
                                onChange={(e) => update({ label: e.target.value })}
                                placeholder="مثال: أزرق / كبير"
                                className={inputClass}
                              />
                            </div>
                            <button
                              type="button"
                              aria-label="حذف النوع"
                              title="حذف النوع"
                              onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))}
                              className="mb-0.5 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-gray-600">السعر (جنيه)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={v.price}
                                onChange={(e) => update({ price: e.target.value })}
                                placeholder={price || "سعر المنتج"}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-gray-600">الكمية</label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={v.stock}
                                onChange={(e) => update({ stock: e.target.value })}
                                placeholder="10"
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVariants((rows) => [...rows, { label: "", price: "", stock: "" }])}
                    className="mt-2 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-600 hover:border-emerald-500 hover:text-emerald-700"
                  >
                    + إضافة نوع
                  </button>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? "جاري الحفظ..." : editingProduct ? "حفظ التغييرات" : "إنشاء منتج"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
