export default function PagesLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="جاري تحميل الصفحات"
      className="mx-auto max-w-6xl rounded-3xl bg-canvas p-4 sm:p-6 lg:p-8 space-y-6"
    >
      <div className="h-8 w-40 rounded-lg bg-line/60 animate-pulse motion-reduce:animate-none" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-56 rounded-2xl border border-line bg-surface p-5 animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

