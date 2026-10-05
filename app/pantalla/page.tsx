'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Brand, OfflineBanner, SetupNotice, Timer } from '@/components/Bits';
import RoleMap from '@/components/RoleMap';
import { QUESTIONS, SPECIALTY_OPTIONS, TIPS, WORKSHOP, roleLabel, type QuestionId } from '@/lib/content';
import { tally, useCountdown, useJoinUrl, useLiveData, useWorkshopState } from '@/lib/hooks';
import { isConfigured, type TextResponse, type WorkshopState } from '@/lib/supabase';

const MAX_CARDS = 12;
const MAX_REASONS = 4;

/** Vista limpia para proyectar. Solo muestra datos públicos (textos aprobados y votos). */
export default function ScreenPage() {
  const { state, online } = useWorkshopState();
  const { votes, texts, joined } = useLiveData(state?.session_id);
  const joinUrl = useJoinUrl();

  if (!isConfigured) return <SetupNotice />;
  if (!state) return <main className="stage"><div className="loader" /></main>;

  const approved = texts.filter((t) => t.status === 'approved');
  const q = state.phase === 'q1' || state.phase === 'q2' || state.phase === 'q3' ? state.phase : null;
  const answers =
    q === 'q1' ? null : q ? tally(votes, q).voters : null;

  return (
    <main className={`stage stage--${state.phase}`}>
      <OfflineBanner online={online} />
      <header className="stage__top">
        <Brand />
        <div className="stage__meta">
          <span className="stat"><b>{joined}</b> en la sala</span>
          {answers !== null && <span className="stat stat--hot"><b>{answers}</b> respuestas</span>}
          {q && <StageTimer state={state} q={q} />}
        </div>
      </header>

      <section className="stage__body" key={state.phase}>
        {state.phase === 'lobby' && <Lobby joinUrl={joinUrl} joined={joined} />}
        {state.phase === 'q1' && <Opening cards={approved.filter((t) => t.question === 'q1')} />}
        {state.phase === 'q2' && (
          <Roles counts={tally(votes, 'q2').counts} reasons={approved.filter((t) => t.question === 'q2')} />
        )}
        {state.phase === 'q3' && <Specialty counts={tally(votes, 'q3').counts} spotlight={state.spotlight} />}
        {state.phase === 'final' && <Final joinUrl={joinUrl} />}
      </section>

      {q && joinUrl && (
        <footer className="stage__join">
          <QRCodeSVG value={joinUrl} size={72} marginSize={1} />
          <span>Únete en <b>{joinUrl.replace(/^https?:\/\//, '')}</b></span>
          {!state.is_open && <span className="chip">{state.opened_at ? 'Respuestas cerradas' : 'Abre en segundos…'}</span>}
        </footer>
      )}
    </main>
  );
}

function StageTimer({ state, q }: { state: WorkshopState; q: QuestionId }) {
  const left = useCountdown(state.opened_at, QUESTIONS[q].seconds, state.is_open);
  return <Timer left={left} total={QUESTIONS[q].seconds} />;
}

function Head({ q }: { q: QuestionId }) {
  return (
    <div className="stage__head">
      <span className="kicker">{QUESTIONS[q].n} de 3 · {QUESTIONS[q].kicker}</span>
      <h1>{QUESTIONS[q].title}</h1>
    </div>
  );
}

function Lobby({ joinUrl, joined }: { joinUrl: string; joined: number }) {
  return (
    <div className="lobby">
      <div className="lobby__text">
        <span className="kicker">{WORKSHOP.tag}</span>
        <h1>{WORKSHOP.title}</h1>
        <p>Escanea el código, elige un apodo y espera la primera pregunta.</p>
        <div className="lobby__url">{joinUrl.replace(/^https?:\/\//, '')}</div>
        <span className="stat stat--hot stat--big"><b>{joined}</b> {joined === 1 ? 'persona conectada' : 'personas conectadas'}</span>
      </div>
      <div className="lobby__qr">
        {joinUrl && <QRCodeSVG value={joinUrl} size={512} marginSize={2} />}
      </div>
    </div>
  );
}

function Opening({ cards }: { cards: TextResponse[] }) {
  const shown = cards.slice(-MAX_CARDS);
  return (
    <>
      <Head q="q1" />
      {shown.length === 0 ? (
        <p className="stage__empty">Escribe tu respuesta desde el móvil. Irán apareciendo aquí.</p>
      ) : (
        <div className={`wall wall--${shown.length > 8 ? 'dense' : shown.length > 4 ? 'mid' : 'big'}`}>
          {shown.map((c, i) => (
            <article className={`post post--${(cards.length - shown.length + i) % 4}`} key={c.id}>
              <p>{c.body}</p>
              <span>@{c.nickname}</span>
            </article>
          ))}
        </div>
      )}
      {cards.length > shown.length && <span className="chip wall__more">+{cards.length - shown.length} respuestas más</span>}
    </>
  );
}

function Roles({ counts, reasons }: { counts: Record<string, number>; reasons: TextResponse[] }) {
  const shown = reasons.slice(-MAX_REASONS);
  return (
    <div className="roles">
      <div className="roles__side">
        <Head q="q2" />
        <p className="roles__hint">{QUESTIONS.q2.hint}</p>
        <div className="roles__reasons">
          {shown.map((r, i) => (
            <article className={`post post--${i % 4}`} key={r.id}>
              <p>{r.body}</p>
              <span>@{r.nickname}</span>
            </article>
          ))}
        </div>
      </div>
      <div className="roles__map"><RoleMap counts={counts} /></div>
    </div>
  );
}

function Specialty({ counts, spotlight }: { counts: Record<string, number>; spotlight: string | null }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...Object.values(counts));
  const tips = spotlight ? TIPS[spotlight] : null;
  return (
    <div className={`spec${tips ? ' spec--tips' : ''}`}>
      <div className="spec__chart">
        <Head q="q3" />
        <div className="bars">
          {SPECIALTY_OPTIONS.map((o) => {
            const n = counts[o.id] ?? 0;
            return (
              <div
                key={o.id}
                className={`bar${o.id === 'cm' ? ' bar--cm' : ''}${n === max && n > 0 ? ' is-top' : ''}${spotlight === o.id ? ' is-spot' : ''}`}
              >
                <span className="bar__label">{o.label}</span>
                <span className="bar__track"><i style={{ width: `${(n / max) * 100}%` }} /></span>
                <span className="bar__n">{n}<small>{total ? ` · ${Math.round((n / total) * 100)}%` : ''}</small></span>
              </div>
            );
          })}
        </div>
      </div>
      {tips && spotlight && (
        <aside className="tips" key={spotlight}>
          <span className="kicker">Consejos para</span>
          <h2>{roleLabel(spotlight)}</h2>
          <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </aside>
      )}
    </div>
  );
}

function Final({ joinUrl }: { joinUrl: string }) {
  return (
    <div className="lobby">
      <div className="lobby__text">
        <span className="kicker">¡Gracias!</span>
        <h1>Descarga tu {WORKSHOP.pdfTitle}</h1>
        <p>Ya está disponible en tu móvil. Si recién llegas, escanea el código.</p>
        <div className="lobby__url">{joinUrl.replace(/^https?:\/\//, '')}</div>
      </div>
      <div className="lobby__qr">
        {joinUrl && <QRCodeSVG value={joinUrl} size={512} marginSize={2} />}
      </div>
    </div>
  );
}
