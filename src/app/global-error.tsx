"use client";

// Root error boundary — replaces the whole document, so globals.css / Tailwind
// are NOT available here. Everything is inline-styled with brand tokens.
import { BrandIcon } from "@/components/BrandIcon";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 16,
          textAlign: "center",
          background: "#0f0f15",
          color: "#e8e9ec",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <BrandIcon expression="error" tone="white" title="MsgBuddy" style={{ width: 64, height: 64 }} />
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, opacity: 0.6, margin: 0, maxWidth: 360 }}>
          An unexpected error occurred. Try reloading — if it keeps happening, please let us know.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 8,
            padding: "9px 18px",
            borderRadius: 8,
            border: "1px solid #6440F5",
            background: "#6440F5",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
