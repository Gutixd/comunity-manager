'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isConfigured, supabase, type TextResponse, type Vote, type WorkshopState } from './supabase';

const newer = (a: WorkshopState, b: WorkshopState | null) =>
  !b || Date.parse(a.updated_at) >= Date.parse(b.updated_at);

/** Estado de la sala en vivo: Realtime + sondeo de respaldo cada 5 s. */
export function useWorkshopState() {
  const [state, setState] = useState<WorkshopState | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    const accept = (next: WorkshopState) =>
      setState((prev) => (newer(next, prev) ? next : prev));

    const load = async () => {
      const { data, error } = await supabase.from('workshop_state').select('*').eq('id', 1).single();
      if (!alive) return;
      if (error || !data) return setOnline(false);
      setOnline(true);
      accept(data as WorkshopState);
    };

    load();
    const channel = supabase
      .channel(`estado-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshop_state' }, (p) =>
        accept(p.new as WorkshopState),
      )
      .subscribe();
    const timer = setInterval(load, 5000);
    const offline = () => setOnline(false);
    const wake = () => document.visibilityState === 'visible' && load();
    window.addEventListener('online', load);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', wake);

    return () => {
      alive = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
      window.removeEventListener('online', load);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  return { state, online };
}

/**
 * Votos, textos y total de participantes de la sesión actual.
 * Los textos que llegan dependen de RLS: el público solo recibe los aprobados.
 */
export function useLiveData(sessionId: string | undefined) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [texts, setTexts] = useState<TextResponse[]>([]);
  const [joined, setJoined] = useState(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const [v, t, c] = await Promise.all([
      supabase.from('votes').select('participant_id,question,choices').eq('session_id', sessionId),
      supabase
        .from('text_responses')
        .select('id,question,nickname,body,status,created_at')
        .eq('session_id', sessionId)
        .order('created_at'),
      supabase.rpc('participant_count'),
    ]);
    if (v.data) setVotes(v.data as Vote[]);
    if (t.data) setTexts(t.data as TextResponse[]);
    if (typeof c.data === 'number') setJoined(c.data);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setVotes([]);
    setTexts([]);
    setJoined(0);
    load();
    // Cualquier cambio dispara una recarga (agrupada) del conjunto completo
    const refresh = () => {
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        load();
      }, 250);
    };
    const channel = supabase
      .channel(`datos-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'text_responses' }, refresh)
      .subscribe();
    const timer = setInterval(load, 4000);
    return () => {
      clearInterval(timer);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      supabase.removeChannel(channel);
    };
  }, [sessionId, load]);

  return { votes, texts, joined, reload: load };
}

/** Cuenta votos por opción para una pregunta. */
export function tally(votes: Vote[], question: 'q2' | 'q3') {
  const counts: Record<string, number> = {};
  let voters = 0;
  for (const v of votes) {
    if (v.question !== question) continue;
    voters++;
    for (const c of v.choices) counts[c] = (counts[c] ?? 0) + 1;
  }
  return { counts, voters };
}

/** Segundos restantes del tiempo sugerido (solo informativo, no cierra nada). */
export function useCountdown(openedAt: string | null, seconds: number, active: boolean) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!active || !openedAt) return setLeft(null);
    const tick = () => {
      const elapsed = (Date.now() - Date.parse(openedAt)) / 1000;
      setLeft(Math.max(0, Math.min(seconds, Math.ceil(seconds - elapsed))));
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [openedAt, seconds, active]);
  return left;
}

/** URL pública que se codifica en el QR. */
export function useJoinUrl() {
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl((process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, ''));
  }, []);
  return url;
}
