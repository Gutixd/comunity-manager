'use client';

import type { Session } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { OfflineBanner, SetupNotice } from '@/components/Bits';
import {
  OTHER_ROLES, PHASES, PHASE_LABEL, QUESTIONS, SPECIALTY_OPTIONS, type Phase, type QuestionId,
} from '@/lib/content';
import { tally, useJoinUrl, useLiveData, useWorkshopState } from '@/lib/hooks';
import {
  errorCode, errorText, isConfigured, supabase, type TextResponse, type WorkshopState,
} from '@/lib/supabase';

type Access = 'loading' | 'signed-out' | 'not-admin' | 'admin';

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setAccess('signed-out');
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setAccess('signed-out');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // El permiso real lo decide la base de datos (tabla admins + RLS)
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    supabase.rpc('is_admin').then(({ data }) => setAccess(data === true ? 'admin' : 'not-admin'));
  }, [userId]);

  if (!isConfigured) return <SetupNotice />;
  if (access === 'loading') return <main className="admin"><div className="loader" /></main>;
  if (access === 'signed-out') return <Login />;
  if (access === 'not-admin') {
    return (
      <main className="admin admin--narrow">
        <div className="card">
          <h2>Sin permisos de presentador</h2>
          <p>
            <b>{session?.user.email}</b> inició sesión, pero no está en la tabla <code>admins</code>.
            Revisa el paso 3 del README.
          </p>
          <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </main>
    );
  }
  return <Panel email={session?.user.email ?? ''} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError('Correo o contraseña incorrectos.');
  };

  return (
    <main className="admin admin--narrow">
      <form className="card" onSubmit={submit}>
        <span className="kicker">Panel del presentador</span>
        <h2>Iniciar sesión</h2>
        <label htmlFor="email">Correo</label>
        <div className="field"><input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <label htmlFor="password">Contraseña</label>
        <div className="field"><input id="password" type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <label className="showpass"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostrar contraseña</label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}

/** Personas con la página abierta ahora mismo (Realtime Presence). */
function usePresenceCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const channel = supabase.channel('sala');
    channel
      .on('presence', { event: 'sync' }, () => setCount(Object.keys(channel.presenceState()).length))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return count;
}

function Panel({ email }: { email: string }) {
  const { state, online } = useWorkshopState();
  const { votes, texts, joined, reload } = useLiveData(state?.session_id);
  const connected = usePresenceCount();
  const joinUrl = useJoinUrl();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const run = async (fn: string, args?: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) setError(errorText(errorCode(error)));
    else reload();
  };
  const setPhase = (phase: Phase, open: boolean) => run('admin_set_state', { p_phase: phase, p_is_open: open });

  if (!state) return <main className="admin"><OfflineBanner online={online} /><div className="loader" /></main>;

  const q: QuestionId | null = state.phase === 'q1' || state.phase === 'q2' || state.phase === 'q3' ? state.phase : null;
  const next = PHASES[PHASES.indexOf(state.phase) + 1] as Phase | undefined;
  const primary = primaryAction(state, next);

  return (
    <main className="admin">
      <OfflineBanner online={online} />
      <header className="admin__top">
        <div>
          <span className="kicker">Panel del presentador</span>
          <h1>{PHASE_LABEL[state.phase]}</h1>
        </div>
        <div className="admin__stats">
          <span className="stat stat--hot"><b>{connected}</b> conectados ahora</span>
          <span className="stat"><b>{joined}</b> entraron</span>
          <a className="btn btn--ghost" href="/pantalla" target="_blank" rel="noreferrer">Abrir pantalla de proyección ↗</a>
          <button className="btn btn--ghost" onClick={() => supabase.auth.signOut()} title={email}>Salir</button>
        </div>
      </header>

      <nav className="steps" aria-label="Etapas">
        {PHASES.map((p) => (
          <button
            key={p} disabled={busy}
            className={`step${p === state.phase ? ' is-current' : ''}`}
            onClick={() => p !== state.phase && setPhase(p, false)}
          >
            {PHASE_LABEL[p]}
          </button>
        ))}
      </nav>

      <section className="card control">
        <div>
          <span className={`chip${state.is_open ? ' chip--live' : ''}`}>
            {q ? (state.is_open ? 'Recibiendo respuestas' : state.opened_at ? 'Respuestas cerradas' : 'Aún sin abrir') : state.phase === 'lobby' ? 'Esperando participantes' : 'PDF disponible para todos'}
          </span>
          <p className="control__q">{q ? QUESTIONS[q].title : state.phase === 'lobby' ? 'Comparte el QR y abre la primera pregunta cuando estés lista.' : state.spotlight === 'rec' ? 'Se está proyectando el formulario de próximas grabaciones.' : 'Los participantes ya ven el botón de descarga. Al final, muestra el formulario de grabaciones.'}</p>
        </div>
        <div className="control__actions">
          {q && !state.is_open && state.opened_at && (
            <button className="btn btn--ghost" disabled={busy} onClick={() => setPhase(q, true)}>Reabrir respuestas</button>
          )}
          {state.phase === 'final' && (
            <button className="btn btn--big" disabled={busy} onClick={() => run('admin_set_spotlight', { p_role: state.spotlight === 'rec' ? null : 'rec' })}>
              {state.spotlight === 'rec' ? 'Volver al PDF' : 'Mostrar grabaciones (formulario)'}
            </button>
          )}
          {primary && (
            <button className="btn btn--big" disabled={busy} onClick={() => setPhase(primary.phase, primary.open)}>{primary.label}</button>
          )}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {state.phase === 'lobby' && joinUrl && (
        <section className="card lobbycard">
          <QRCodeSVG value={joinUrl} size={140} marginSize={2} />
          <div>
            <h2>Enlace de entrada</h2>
            <p className="mono">{joinUrl}</p>
            <p className="fine">El mismo QR aparece en grande en la pantalla de proyección.</p>
          </div>
        </section>
      )}

      {state.phase === 'q1' && (
        <Moderation title="Respuestas de apertura" texts={texts.filter((t) => t.question === 'q1')} onModerate={(id, s) => run('admin_moderate', { p_id: id, p_status: s })} busy={busy} />
      )}

      {state.phase === 'q2' && (
        <div className="admin__grid">
          <Tally title="Conexiones elegidas" options={OTHER_ROLES} data={tally(votes, 'q2')} />
          <Moderation title="Explicaciones" texts={texts.filter((t) => t.question === 'q2')} onModerate={(id, s) => run('admin_moderate', { p_id: id, p_status: s })} busy={busy} />
        </div>
      )}

      {state.phase === 'q3' && (
        <Tally
          title="Especialización" options={SPECIALTY_OPTIONS} data={tally(votes, 'q3')}
          spotlight={state.spotlight} busy={busy}
          onSpotlight={(id) => run('admin_set_spotlight', { p_role: id })}
        />
      )}

      <section className="card reset">
        <div>
          <h2>Reiniciar sesión</h2>
          <p className="fine">Borra participantes, respuestas y votos, y vuelve a la sala de espera. Úsalo antes de cada evento.</p>
        </div>
        {confirmReset ? (
          <div className="control__actions">
            <button className="btn btn--ghost" onClick={() => setConfirmReset(false)}>Cancelar</button>
            <button className="btn btn--danger" disabled={busy} onClick={async () => { await run('admin_reset'); setConfirmReset(false); }}>Sí, borrar todo</button>
          </div>
        ) : (
          <button className="btn btn--ghost" onClick={() => setConfirmReset(true)}>Reiniciar…</button>
        )}
      </section>
    </main>
  );
}

function primaryAction(state: WorkshopState, next: Phase | undefined) {
  if (state.phase === 'lobby') return { label: 'Abrir pregunta 1', phase: 'q1' as Phase, open: true };
  if (state.phase === 'final' || !next) return null;
  if (state.is_open) return { label: 'Cerrar respuestas', phase: state.phase, open: false };
  if (!state.opened_at) return { label: 'Abrir respuestas', phase: state.phase, open: true };
  if (next === 'final') return { label: 'Ir al cierre y liberar el PDF', phase: next, open: false };
  return { label: `Abrir pregunta ${QUESTIONS[next as QuestionId].n}`, phase: next, open: true };
}

function Moderation({ title, texts, onModerate, busy }: {
  title: string;
  texts: TextResponse[];
  onModerate: (id: string, status: TextResponse['status']) => void;
  busy: boolean;
}) {
  const order = { pending: 0, approved: 1, rejected: 2 };
  const sorted = [...texts].sort((a, b) => order[a.status] - order[b.status]);
  const pending = texts.filter((t) => t.status === 'pending');
  return (
    <section className="card">
      <div className="card__head">
        <h2>{title} <small>{texts.length} recibidas · {texts.filter((t) => t.status === 'approved').length} en pantalla</small></h2>
        {pending.length > 1 && (
          <button className="btn btn--ghost" disabled={busy} onClick={() => pending.forEach((t) => onModerate(t.id, 'approved'))}>
            Aprobar las {pending.length} pendientes
          </button>
        )}
      </div>
      {texts.length === 0 && <p className="fine">Aquí aparecerán las respuestas a medida que lleguen. Nada se proyecta sin tu aprobación.</p>}
      <ul className="mod">
        {sorted.map((t) => (
          <li key={t.id} className={`mod__item mod__item--${t.status}`}>
            <div>
              <p>{t.body}</p>
              <span>@{t.nickname} · {t.status === 'pending' ? 'pendiente' : t.status === 'approved' ? 'en pantalla' : 'oculta'}</span>
            </div>
            <div className="mod__actions">
              {t.status !== 'approved' && <button className="btn btn--ok" onClick={() => onModerate(t.id, 'approved')}>Aprobar</button>}
              {t.status !== 'rejected' && <button className="btn btn--ghost" onClick={() => onModerate(t.id, 'rejected')}>Ocultar</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tally({ title, options, data, spotlight, onSpotlight, busy }: {
  title: string;
  options: { id: string; label: string }[];
  data: { counts: Record<string, number>; voters: number };
  spotlight?: string | null;
  onSpotlight?: (id: string | null) => void;
  busy?: boolean;
}) {
  const max = Math.max(1, ...Object.values(data.counts));
  return (
    <section className="card">
      <div className="card__head">
        <h2>{title} <small>{data.voters} {data.voters === 1 ? 'persona respondió' : 'personas respondieron'}</small></h2>
        {onSpotlight && spotlight && (
          <button className="btn btn--ghost" disabled={busy} onClick={() => onSpotlight(null)}>Quitar consejos de la pantalla</button>
        )}
      </div>
      {onSpotlight && <p className="fine">Toca un rol para proyectar sus consejos junto al gráfico.</p>}
      <div className="bars bars--admin">
        {options.map((o) => {
          const n = data.counts[o.id] ?? 0;
          const row = (
            <>
              <span className="bar__label">{o.label}</span>
              <span className="bar__track"><i style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="bar__n">{n}</span>
            </>
          );
          return onSpotlight ? (
            <button key={o.id} disabled={busy} className={`bar bar--btn${spotlight === o.id ? ' is-spot' : ''}`} onClick={() => onSpotlight(spotlight === o.id ? null : o.id)}>{row}</button>
          ) : (
            <div key={o.id} className="bar">{row}</div>
          );
        })}
      </div>
    </section>
  );
}
