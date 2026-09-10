"use client";

import { useState } from "react";

/** Hujjat sahifasidagi jonli sinov formasi - /api/solve ni chaqiradi. */
export function ApiTester() {
  const [savol, setSavol] = useState("2x + 5 = 13");
  const [natija, setNatija] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const yubor = async () => {
    if (busy || !savol.trim()) return;
    setBusy(true);
    setNatija(null);
    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savol }),
      });
      const data: unknown = await response.json();
      setNatija(`HTTP ${response.status}\n\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      setNatija(
        `So'rov yuborilmadi: ${error instanceof Error ? error.message : "xato"}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tester">
      <div className="tester-row">
        <input
          value={savol}
          onChange={(event) => setSavol(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") yubor();
          }}
          placeholder="Masalan: 2x + 5 = 13"
          maxLength={500}
          aria-label="Matematik savol"
        />
        <button type="button" onClick={yubor} disabled={busy || !savol.trim()}>
          {busy ? "Yechilyapti..." : "Yuborish"}
        </button>
      </div>

      <p className="tester-hint">
        Bu forma aynan quyidagi <code>POST /api/solve</code> so&apos;rovini
        yuboradi. Kalitsiz cheklov: soatiga 3 ta so&apos;rov.
      </p>

      {natija && (
        <pre>
          <code>{natija}</code>
        </pre>
      )}
    </div>
  );
}
