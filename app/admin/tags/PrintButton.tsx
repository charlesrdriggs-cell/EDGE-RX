"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn sm accent" onClick={() => window.print()}>
      Print
    </button>
  );
}
