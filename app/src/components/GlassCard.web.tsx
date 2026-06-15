// Glassmorphic surface (web): translucent white + backdrop blur (Apple style).
import type { ReactNode } from 'react';
import { theme } from '../theme';

export function GlassCard({ children, style }: { children: ReactNode; style?: Record<string, unknown> }) {
  return (
    <div
      style={{
        background: theme.card,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: `1px solid ${theme.glassBorder}`,
        borderRadius: 16,
        boxShadow: `0 8px 30px ${theme.shadow}`,
        padding: 16,
        ...(style as object),
      }}
    >
      {children}
    </div>
  );
}
