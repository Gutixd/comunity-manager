-- ============================================================
-- Workshop Community Manager · esquema, RLS y funciones
-- Pega este archivo completo en Supabase → SQL Editor → Run.
-- ============================================================

-- ---------- Tablas ----------

-- Estado único de la sala (una sola fila, id = 1)
create table public.workshop_state (
  id int primary key default 1 check (id = 1),
  session_id uuid not null default gen_random_uuid(),
  phase text not null default 'lobby' check (phase in ('lobby', 'q1', 'q2', 'q3', 'final')),
  is_open boolean not null default false,
  opened_at timestamptz,
  spotlight text,
  updated_at timestamptz not null default now()
);
insert into public.workshop_state default values;

-- Usuarios de Supabase Auth con permiso de presentador
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  nickname text not null check (char_length(nickname) between 2 and 20),
  secret uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index participants_session_idx on public.participants (session_id);

-- Respuestas de texto: q1 (apertura) y q2 (explicación opcional). Se moderan.
create table public.text_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_id uuid not null references public.participants (id) on delete cascade,
  question text not null check (question in ('q1', 'q2')),
  nickname text not null,
  body text not null check (char_length(body) between 2 and 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (participant_id, question)
);
create index text_responses_session_idx on public.text_responses (session_id);

-- Votos: q2 (hasta 3 roles) y q3 (1 opción)
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_id uuid not null references public.participants (id) on delete cascade,
  question text not null check (question in ('q2', 'q3')),
  choices text[] not null,
  created_at timestamptz not null default now(),
  unique (participant_id, question)
);
create index votes_session_idx on public.votes (session_id);

-- ---------- Helpers ----------

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- ---------- RLS ----------

alter table public.workshop_state enable row level security;
alter table public.admins enable row level security;
alter table public.participants enable row level security;
alter table public.text_responses enable row level security;
alter table public.votes enable row level security;

-- Nadie escribe directo en las tablas: toda escritura pasa por las funciones de abajo.
revoke all on public.workshop_state, public.admins, public.participants,
  public.text_responses, public.votes from anon, authenticated;

grant select on public.workshop_state, public.votes, public.text_responses to anon, authenticated;
grant select on public.admins to authenticated;
-- El "secret" del participante nunca se puede leer desde el cliente
grant select (id, session_id, nickname, created_at) on public.participants to authenticated;

create policy "estado visible para todos" on public.workshop_state
  for select to anon, authenticated using (true);

create policy "admin ve su propia fila" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "solo admin ve participantes" on public.participants
  for select to authenticated using ((select public.is_admin()));

create policy "textos aprobados visibles; admin ve todo" on public.text_responses
  for select to anon, authenticated
  using (status = 'approved' or (select public.is_admin()));

create policy "votos visibles para todos" on public.votes
  for select to anon, authenticated using (true);

-- ---------- Funciones de participantes (anon) ----------

create function public.join_session(p_nickname text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_nick text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  v_session uuid;
  v_row public.participants;
begin
  if char_length(v_nick) < 2 or char_length(v_nick) > 20 then
    raise exception 'invalid_nickname';
  end if;
  select session_id into v_session from public.workshop_state where id = 1;
  if (select count(*) from public.participants where session_id = v_session) >= 500 then
    raise exception 'session_full';
  end if;
  insert into public.participants (session_id, nickname)
  values (v_session, v_nick)
  returning * into v_row;
  return json_build_object(
    'id', v_row.id, 'secret', v_row.secret,
    'session_id', v_row.session_id, 'nickname', v_row.nickname
  );
end;
$$;

-- Valida identidad del participante y que la pregunta esté abierta
create function public.check_participant(p_id uuid, p_secret uuid, p_phase text)
returns public.participants
language plpgsql security definer set search_path = ''
as $$
declare
  v_state public.workshop_state;
  v_row public.participants;
begin
  select * into v_state from public.workshop_state where id = 1;
  select * into v_row from public.participants
    where id = p_id and secret = p_secret and session_id = v_state.session_id;
  if not found then
    raise exception 'invalid_participant';
  end if;
  if v_state.phase <> p_phase or not v_state.is_open then
    raise exception 'closed';
  end if;
  return v_row;
end;
$$;

create function public.submit_opening(p_id uuid, p_secret uuid, p_body text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.participants := public.check_participant(p_id, p_secret, 'q1');
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
begin
  if char_length(v_body) < 2 or char_length(v_body) > 120 then
    raise exception 'invalid_text';
  end if;
  insert into public.text_responses (session_id, participant_id, question, nickname, body)
  values (v_p.session_id, v_p.id, 'q1', v_p.nickname, v_body);
exception when unique_violation then
  raise exception 'already_answered';
end;
$$;

create function public.submit_roles(p_id uuid, p_secret uuid, p_roles text[], p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.participants := public.check_participant(p_id, p_secret, 'q2');
  v_roles text[];
  v_reason text := btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g'));
begin
  select array_agg(distinct r) into v_roles from unnest(coalesce(p_roles, '{}')) as r;
  if v_roles is null or cardinality(v_roles) > 3
     or not v_roles <@ array['cuentas', 'redaccion', 'arte', 'paid', 'smm', 'content', 'data', 'sac', 'influencer'] then
    raise exception 'invalid_choice';
  end if;
  if char_length(v_reason) > 100 or char_length(v_reason) = 1 then
    raise exception 'invalid_text';
  end if;
  insert into public.votes (session_id, participant_id, question, choices)
  values (v_p.session_id, v_p.id, 'q2', v_roles);
  if v_reason <> '' then
    insert into public.text_responses (session_id, participant_id, question, nickname, body)
    values (v_p.session_id, v_p.id, 'q2', v_p.nickname, v_reason);
  end if;
exception when unique_violation then
  raise exception 'already_answered';
end;
$$;

create function public.submit_specialty(p_id uuid, p_secret uuid, p_choice text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.participants := public.check_participant(p_id, p_secret, 'q3');
begin
  if p_choice is null or p_choice not in
     ('cuentas', 'redaccion', 'arte', 'paid', 'smm', 'cm', 'content', 'data', 'sac', 'influencer', 'nose') then
    raise exception 'invalid_choice';
  end if;
  insert into public.votes (session_id, participant_id, question, choices)
  values (v_p.session_id, v_p.id, 'q3', array[p_choice]);
exception when unique_violation then
  raise exception 'already_answered';
end;
$$;

-- Total de personas que entraron a la sesión actual (para la pantalla)
create function public.participant_count()
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.participants p
  join public.workshop_state s on s.id = 1 and s.session_id = p.session_id;
$$;

-- ---------- Funciones del presentador (solo admins) ----------

create function public.admin_set_state(p_phase text, p_is_open boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_phase not in ('lobby', 'q1', 'q2', 'q3', 'final') then raise exception 'invalid_phase'; end if;
  update public.workshop_state set
    opened_at = case
      when p_is_open and p_phase in ('q1', 'q2', 'q3') then now()
      when phase <> p_phase then null
      else opened_at end,
    spotlight = case when phase <> p_phase then null else spotlight end,
    is_open = p_is_open and p_phase in ('q1', 'q2', 'q3'),
    phase = p_phase,
    updated_at = now()
  where id = 1;
end;
$$;

create function public.admin_set_spotlight(p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.workshop_state set spotlight = p_role, updated_at = now() where id = 1;
end;
$$;

create function public.admin_moderate(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('pending', 'approved', 'rejected') then raise exception 'invalid_status'; end if;
  update public.text_responses set status = p_status where id = p_id;
end;
$$;

-- Borra todo y deja la sala lista para otro evento
create function public.admin_reset()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  delete from public.votes where true;
  delete from public.text_responses where true;
  delete from public.participants where true;
  update public.workshop_state set
    session_id = gen_random_uuid(), phase = 'lobby', is_open = false,
    opened_at = null, spotlight = null, updated_at = now()
  where id = 1;
end;
$$;

-- Permisos de ejecución
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.join_session(text) to anon, authenticated;
grant execute on function public.submit_opening(uuid, uuid, text) to anon, authenticated;
grant execute on function public.submit_roles(uuid, uuid, text[], text) to anon, authenticated;
grant execute on function public.submit_specialty(uuid, uuid, text) to anon, authenticated;
grant execute on function public.participant_count() to anon, authenticated;
grant execute on function public.admin_set_state(text, boolean) to authenticated;
grant execute on function public.admin_set_spotlight(text) to authenticated;
grant execute on function public.admin_moderate(uuid, text) to authenticated;
grant execute on function public.admin_reset() to authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.workshop_state, public.votes, public.text_responses;
