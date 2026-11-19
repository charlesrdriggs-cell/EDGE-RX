"use client";

export default function PrintPageButton({ label = "Print", className = "btn sm accent" }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
