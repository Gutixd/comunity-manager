'use client';

import { WORKSHOP } from '@/lib/content';
import { isConfigured } from '@/lib/supabase';

export function Brand({ small }: { small?: boolean }) {
  return (
    <div className={`brand${small ? ' brand--small' : ''}`}>
      <span className="brand__live"><i />En vivo</span>
      <span className="brand__name">{WORKSHOP.tag} · {WORKSHOP.title}</span>
    </div>
  );
}

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div className="offline" role="status">
      <i /> Sin conexión. Reintentando…
    </div>
  );
}

export function Timer({ left, total }: { left: number | null; total: number }) {
  if (left === null) return null;
  const pct = (left / total) * 100;
  return (
    <div className={`timer${left === 0 ? ' is-done' : ''}`} style={{ ['--pct' as string]: `${pct}%` }}>
      <span>{left === 0 ? '¡Ya!' : left}</span>
    </div>
  );
}

export function SetupNotice() {
  if (isConfigured) return null;
  return (
    <main className="phone">
      <div className="card">
        <h2>Falta configurar Supabase</h2>
        <p>Copia <code>.env.example</code> a <code>.env.local</code>, completa las claves y reinicia el servidor.</p>
      </div>
    </main>
  );
}
