import Link from "next/link";
import type { Metadata } from "next";
import { getConversations } from "@/lib/conversations";
import { getProducts, type Product } from "@/lib/products";
import { getStoreKnowledge, type StoreKnowledge } from "@/lib/knowledge";
import { BrandMark } from "../logo";
import { Workspace } from "./workspace";
import * as m from "@/paraglide/messages";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: m.demo_meta_title(),
    description: m.demo_meta_description(),
    robots: { index: false, follow: true }
  };
}

function DemoHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        <Link href="/">
          <BrandMark size="sm" />
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-gray-500 hover:text-emerald-700"
        >
          {m.demo_home()}
        </Link>
      </div>
    </header>
  );
}

export default async function Home() {
  let conversations;
  let knowledge;
  try {
    conversations = await getConversations();
    knowledge = await getStoreKnowledge();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("503")) {
      return (
        <>
          <DemoHeader />
          <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
            <h1 className="text-2xl font-semibold">{m.demo_engine_title()}</h1>
            <p className="text-sm text-red-600">
              {m.demo_env_error()}
            </p>
          </main>
        </>
      );
    }
    throw error;
  }

  let conversation = conversations[0];
  let products: Product[] = [];

  if (!conversation) {
    return (
      <>
        <DemoHeader />
        <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
          <h1 className="text-2xl font-semibold">{m.demo_engine_title()}</h1>
          <p className="text-sm text-red-600">
            {m.demo_no_convo()} <code>make seed</code> {m.demo_seed_suffix()}
          </p>
        </main>
      </>
    );
  }

  for (const c of conversations) {
    const p = await getProducts();
    if (p.length > 0) {
      conversation = c;
      products = p;
      break;
    }
  }

  if (products.length === 0) {
    // Fallback if none have products
    products = await getProducts();
  }

  return (
    <>
      <DemoHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 p-8">
        <h1 className="text-2xl font-semibold">
          {m.demo_chat_title()}
        </h1>
        <p className="text-sm text-gray-500">
          {m.demo_chat_subtitle()}
        </p>
        <Workspace
          conversationId={conversation.id}
          merchantId={conversation.merchant_id}
          products={products}
          knowledge={knowledge}
        />
      </main>
    </>
  );
}
