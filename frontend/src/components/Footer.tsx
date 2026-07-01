export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-sm text-content-muted sm:flex-row">
        <p>
          © {new Date().getFullYear()} Emnex AI Trader — explainable AI market analysis.
        </p>
        <p className="text-content-subtle">
          Market data: Binance &amp; Yahoo Finance · Phase 1
        </p>
      </div>
    </footer>
  );
}
