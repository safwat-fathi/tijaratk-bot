import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center relative font-sans text-white">
      <div className="max-w-[400px] w-full px-6 flex flex-col items-start gap-3">
        <TriangleAlert className="w-8 h-8 text-white mb-2" strokeWidth={1.5} />
        
        <h1 className="text-xl font-semibold">This page could not be found</h1>
        
        <p className="text-[#a1a1aa] text-sm mb-2">
          The link you followed may be broken, or the page may have been removed.
        </p>
        
        <Link
          href="/"
          className="px-4 py-1.5 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 transition-colors inline-block"
        >
          Go Home
        </Link>
      </div>
      
      <div className="absolute bottom-8 text-xs text-[#52525b]">
        404 NOT FOUND
      </div>
    </div>
  );
}
