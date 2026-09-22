import type { CSSProperties } from "react";

/** Shared styling tokens for the full-screen auth cards (login / register). */

export const authPageStyle: CSSProperties = {
  minHeight: "var(--app-height)",
  width: "100%",
  background: "var(--bg-page)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--space-8) var(--space-6)",
};

export const authCardStyle: CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-8)",
  width: "100%",
  maxWidth: 400,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
  border: "1px solid var(--border-medium)",
};

export const authInputStyle: CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3) var(--space-4)",
  color: "var(--text-primary)",
  fontSize: 16, /* <16px provoca zoom automático en iOS al enfocar */
  outline: "none",
  width: "100%",
  minWidth: 0,
};

export const authLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

export const authLabelTextStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
};

export const authErrorStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--accent-red)",
  background: "rgba(239, 89, 78, 0.10)",
  border: "1px solid rgba(239, 89, 78, 0.30)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3)",
};
