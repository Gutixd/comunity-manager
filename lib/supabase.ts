import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// Solo se usa la clave pública: los permisos reales viven en las políticas RLS
// y en las funciones SQL (ver supabase/migrations).
export const supabase = createClient(url || 'http://localhost:54321', key || 'sin-configurar');

export type WorkshopState = {
  session_id: string;
  phase: 'lobby' | 'q1' | 'q2' | 'q3' | 'final';
  is_open: boolean;
  opened_at: string | null;
  spotlight: string | null;
  updated_at: string;
};

export type Vote = { participant_id: string; question: 'q2' | 'q3'; choices: string[] };

export type TextResponse = {
  id: string;
  question: 'q1' | 'q2';
  nickname: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

const MESSAGES: Record<string, string> = {
  closed: 'Las respuestas de esta pregunta ya se cerraron.',
  already_answered: 'Ya habíamos guardado tu respuesta.',
  invalid_participant: 'Tu sesión ya no es válida. Vuelve a entrar con tu apodo.',
  invalid_nickname: 'El apodo debe tener entre 2 y 20 caracteres.',
  invalid_text: 'Revisa el largo de tu texto.',
  invalid_choice: 'Selección no válida.',
  session_full: 'La sala está llena.',
  not_admin: 'Tu usuario no tiene permisos de presentador.',
};

// Devuelve el código de error de las funciones SQL (o "network")
export function errorCode(error: { message?: string } | null): string {
  const msg = error?.message ?? '';
  return Object.keys(MESSAGES).find((k) => msg.includes(k)) ?? 'network';
}

export function errorText(code: string): string {
  return MESSAGES[code] ?? 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
}
