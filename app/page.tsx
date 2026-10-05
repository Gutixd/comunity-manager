'use client';

import { useEffect, useState } from 'react';
import { Brand, OfflineBanner, SetupNotice, Timer } from '@/components/Bits';
import RoleMap from '@/components/RoleMap';
import {
  OTHER_ROLES, QUESTIONS, SPECIALTY_OPTIONS, TIPS, WORKSHOP, roleLabel, type QuestionId,
} from '@/lib/content';
import { useCountdown, useWorkshopState } from '@/lib/hooks';
import { errorCode, errorText, isConfigured, supabase } from '@/lib/supabase';

type Me = {
  id: string;
  secret: string;
  sessionId: string;
  nickname: string;
  answered: Partial<Record<QuestionId, boolean>>;
  specialty?: string;
};

const STORAGE_KEY = 'workshop-cm:participante';

function readMe(): Me | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export default function ParticipantPage() {
  const { state, online } = useWorkshopState();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [wasReset, setWasReset] = useState(false);

  useEffect(() => {
    setMe(readMe());
    setReady(true);
  }, []);

  const save = (next: Me | null) => {
    setMe(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Si el presentador reinició la sala, el apodo guardado ya no sirve
  useEffect(() => {
    if (state && me && me.sessionId !== state.session_id) {
      save(null);
      setWasReset(true);
    }
  }, [state, me]);

  // Presencia: el panel del presentador cuenta quién está conectado ahora
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel('sala', { config: { presence: { key: me.id } } });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ at: Date.now() });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id]);

  if (!isConfigured) return <SetupNotice />;

  const markAnswered = (q: QuestionId, extra?: Partial<Me>) =>
    me && save({ ...me, ...extra, answered: { ...me.answered, [q]: true } });
  const onInvalid = () => {
    save(null);
    setWasReset(true);
  };

  let screen: React.ReactNode;
  if (!ready || !state) {
    screen = online ? <div className="loader" aria-label="Cargando" /> : (
      <div className="card center">
        <h2>No pudimos conectar</h2>
        <p>Revisa tu conexión. Seguimos intentando automáticamente.</p>
      </div>
    );
  } else if (!me) {
    screen = <Join wasReset={wasReset} onJoined={(m) => { setWasReset(false); save(m); }} />;
  } else if (state.phase === 'lobby') {
    screen = <Waiting nickname={me.nickname} />;
  } else if (state.phase === 'final') {
    screen = <Final me={me} />;
  } else {
    const q = state.phase;
    if (me.answered[q]) screen = <Saved q={q} open={state.is_open} />;
    else if (!state.is_open) screen = <Closed q={q} upcoming={!state.opened_at} />;
    else {
      const props = { me, openedAt: state.opened_at, onDone: markAnswered, onInvalid };
      screen = q === 'q1' ? <OpeningForm {...props} /> : q === 'q2' ? <RolesForm {...props} /> : <SpecialtyForm {...props} />;
    }
  }

  return (
    <main className="phone">
      <OfflineBanner online={online} />
      <header className="phone__top">
        <Brand small />
        {me && <span className="chip chip--me">@{me.nickname}</span>}
      </header>
      <div className="phone__body" key={`${state?.phase}-${state?.is_open}-${Boolean(me)}`}>{screen}</div>
    </main>
  );
}

/* ---------- Entrada ---------- */

function Join({ onJoined, wasReset }: { onJoined: (me: Me) => void; wasReset: boolean }) {
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clean = nick.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || clean.length < 2) return;
    setBusy(true);
    setError('');
    const { data, error } = await supabase.rpc('join_session', { p_nickname: clean });
    setBusy(false);
    if (error || !data) return setError(errorText(errorCode(error)));
    onJoined({ id: data.id, secret: data.secret, sessionId: data.session_id, nickname: data.nickname, answered: {} });
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="hero">
        <span className="kicker">{WORKSHOP.tag}</span>
        <h1>{WORKSHOP.title}</h1>
        <p>{WORKSHOP.subtitle}</p>
      </div>
      {wasReset && <p className="note">La sala se reinició. Entra de nuevo con tu apodo.</p>}
      <div className="card">
        <label htmlFor="nick">Tu apodo</label>
        <div className="field field--at">
          <input
            id="nick" value={nick} maxLength={20} autoComplete="off" autoCapitalize="none"
            placeholder="como quieras aparecer" onChange={(e) => setNick(e.target.value)}
          />
        </div>
        <p className="fine">Sin cuenta ni correo. Solo un apodo de 2 a 20 caracteres.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || clean.length < 2}>{busy ? 'Entrando…' : 'Entrar a la sala'}</button>
      </div>
    </form>
  );
}

/* ---------- Estados de espera ---------- */

function Waiting({ nickname }: { nickname: string }) {
  return (
    <div className="stack center">
      <div className="pulse" aria-hidden><i /><i /><i /><b>CM</b></div>
      <h1>¡Ya estás dentro, {nickname}!</h1>
      <p>Deja esta pantalla abierta. La primera actividad aparecerá aquí en cuanto la abramos.</p>
      <div className="bubbles" aria-hidden>
        <span>3 preguntas</span><span>sin respuestas correctas</span><span>resultados en vivo</span><span>PDF de regalo</span>
      </div>
    </div>
  );
}

function Saved({ q, open }: { q: QuestionId; open: boolean }) {
  return (
    <div className="stack center">
      <div className="check" aria-hidden>
        <svg viewBox="0 0 52 52"><path d="M14 27l8 8 16-17" /></svg>
      </div>
      <h1>Respuesta guardada</h1>
      <p>
        {q === 'q1'
          ? 'Gracias. Mira la pantalla: las respuestas irán apareciendo.'
          : 'Gracias. Mira la pantalla: los resultados se actualizan en vivo.'}
      </p>
      <span className="chip">{open ? `Pregunta ${QUESTIONS[q].n} de 3 · abierta` : 'Esperando la siguiente actividad…'}</span>
    </div>
  );
}

function Closed({ q, upcoming }: { q: QuestionId; upcoming: boolean }) {
  return (
    <div className="stack center">
      <span className="kicker">Pregunta {QUESTIONS[q].n} de 3</span>
      <h1>{upcoming ? 'Prepárate…' : 'Respuestas cerradas'}</h1>
      <p>
        {upcoming
          ? 'La siguiente pregunta se abre en unos segundos.'
          : 'Esta pregunta ya no recibe respuestas. Sigue la conversación en la pantalla; la próxima actividad aparecerá aquí.'}
      </p>
    </div>
  );
}

/* ---------- Preguntas ---------- */

type FormProps = {
  me: Me;
  openedAt: string | null;
  onDone: (q: QuestionId, extra?: Partial<Me>) => void;
  onInvalid: () => void;
};

/** Envío común: evita dobles envíos y traduce errores de las funciones SQL. */
function useSubmit(q: QuestionId, { onDone, onInvalid }: FormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async (fn: string, args: Record<string, unknown>, extra?: Partial<Me>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (!error) return onDone(q, extra);
    const code = errorCode(error);
    if (code === 'already_answered') return onDone(q, extra);
    if (code === 'invalid_participant') return onInvalid();
    setError(errorText(code));
  };
  return { busy, error, send };
}

function QuestionHead({ q, openedAt }: { q: QuestionId; openedAt: string | null }) {
  const info = QUESTIONS[q];
  const left = useCountdown(openedAt, info.seconds, true);
  return (
    <div className="qhead">
      <div>
        <span className="kicker">{info.n} de 3 · {info.kicker}</span>
        <h1>{info.title}</h1>
      </div>
      <Timer left={left} total={info.seconds} />
    </div>
  );
}

function OpeningForm(props: FormProps) {
  const { me, openedAt } = props;
  const { busy, error, send } = useSubmit('q1', props);
  const [text, setText] = useState('');
  const max = QUESTIONS.q1.maxChars;
  const clean = text.trim();

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length >= 2) send('submit_opening', { p_id: me.id, p_secret: me.secret, p_body: clean });
      }}
    >
      <QuestionHead q="q1" openedAt={openedAt} />
      <div className="card">
        <label htmlFor="q1">{QUESTIONS.q1.hint}</label>
        <div className="field">
          <textarea id="q1" rows={3} maxLength={max} value={text} placeholder="Un CM es quien…" onChange={(e) => setText(e.target.value)} />
          <span className={`count${text.length >= max ? ' is-max' : ''}`}>{text.length}/{max}</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || clean.length < 2}>{busy ? 'Guardando…' : 'Enviar respuesta'}</button>
      </div>
    </form>
  );
}

function RolesForm(props: FormProps) {
  const { me, openedAt } = props;
  const { busy, error, send } = useSubmit('q2', props);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const { maxPicks, maxChars } = QUESTIONS.q2;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < maxPicks ? [...p, id] : p));

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (picked.length) {
          send('submit_roles', { p_id: me.id, p_secret: me.secret, p_roles: picked, p_reason: reason.trim() || null });
        }
      }}
    >
      <QuestionHead q="q2" openedAt={openedAt} />
      <p className="lead">{QUESTIONS.q2.hint}</p>
      <div className="card card--map">
        <RoleMap compact selected={picked} onToggle={toggle} />
      </div>
      <div className="options options--chips">
        {OTHER_ROLES.map((r) => {
          const on = picked.includes(r.id);
          return (
            <button
              key={r.id} type="button" aria-pressed={on}
              className={`option${on ? ' is-on' : ''}`}
              disabled={!on && picked.length >= maxPicks}
              onClick={() => toggle(r.id)}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <div className="card">
        <label htmlFor="why">¿Por qué? <em>(opcional)</em></label>
        <div className="field">
          <input id="why" maxLength={maxChars} value={reason} placeholder="Porque juntos…" onChange={(e) => setReason(e.target.value)} />
          <span className="count">{reason.length}/{maxChars}</span>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || picked.length === 0}>
          {busy ? 'Guardando…' : `Enviar (${picked.length}/${maxPicks})`}
        </button>
      </div>
    </form>
  );
}

function SpecialtyForm(props: FormProps) {
  const { me, openedAt } = props;
  const { busy, error, send } = useSubmit('q3', props);
  const [choice, setChoice] = useState('');

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (choice) send('submit_specialty', { p_id: me.id, p_secret: me.secret, p_choice: choice }, { specialty: choice });
      }}
    >
      <QuestionHead q="q3" openedAt={openedAt} />
      <p className="lead">{QUESTIONS.q3.hint}</p>
      <div className="options" role="radiogroup">
        {SPECIALTY_OPTIONS.map((o) => (
          <button
            key={o.id} type="button" role="radio" aria-checked={choice === o.id}
            className={`option option--row${choice === o.id ? ' is-on' : ''}${o.id === 'cm' ? ' option--cm' : ''}`}
            onClick={() => setChoice(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="sticky">
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || !choice}>{busy ? 'Guardando…' : 'Enviar mi elección'}</button>
      </div>
    </form>
  );
}

/* ---------- Cierre ---------- */

function Final({ me }: { me: Me }) {
  const tips = me.specialty ? TIPS[me.specialty] : null;
  return (
    <div className="stack">
      <div className="hero">
        <span className="kicker">Gracias por participar</span>
        <h1>Llévate tu kit, {me.nickname}</h1>
      </div>
      <div className="card card--pdf">
        <span className="pdf-badge">PDF</span>
        <h2>{WORKSHOP.pdfTitle}</h2>
        <ul className="ticks">
          <li>Plantilla de calendario de contenidos</li>
          <li>Checklist para publicar</li>
          <li>Guía de respuesta a comentarios y mensajes</li>
          <li>Mapa de roles de la agencia</li>
        </ul>
        <a className="btn" href={WORKSHOP.pdfFile} download>Descargar PDF</a>
      </div>
      {tips && me.specialty && (
        <div className="card">
          <span className="kicker">Tu camino: {roleLabel(me.specialty)}</span>
          <ul className="ticks">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
