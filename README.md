# Workshop CM · web interactiva

Web para el workshop **Community Manager & Influencer Marketing**: el público entra desde un QR, responde tres preguntas desde el móvil y los resultados se proyectan en tiempo real.

| Ruta | Para quién | Qué hace |
| --- | --- | --- |
| `/` | Participantes | Apodo, sala de espera, tres preguntas y descarga del PDF |
| `/pantalla` | Proyector | Vista limpia: QR, tarjetas aprobadas, mapa de roles y gráfico |
| `/admin` | Presentadora | Abrir/cerrar preguntas, moderar, ver participación, reiniciar |

Stack: Next.js (App Router, TypeScript) · Supabase Postgres + Realtime + Auth · Vercel.

## 1. Crear el proyecto en Supabase

1. En [supabase.com](https://supabase.com) → **New project**. Elige la región más cercana al evento (para Chile, `South America (São Paulo)`).
2. **SQL Editor → New query**: pega el contenido completo de `supabase/migrations/20261004000000_workshop.sql` y pulsa **Run**. Crea tablas, políticas RLS, funciones y activa Realtime.
3. Crea tu usuario presentador:
   - **Authentication → Users → Add user → Create new user**: tu correo y una contraseña, con **Auto Confirm User** marcado.
   - Vuelve al **SQL Editor** y dale permiso de presentador (cambia el correo):
     ```sql
     insert into public.admins (user_id)
     select id from auth.users where email = 'tu-correo@ejemplo.com';
     ```
4. Recomendado: **Authentication → Sign In / Providers → Email** → desactiva **Allow new users to sign up**. (Aunque alguien se registrara, sin estar en `admins` no puede hacer nada.)
5. **Project Settings → API**: copia la **Project URL** y la clave pública (**anon** / **publishable**).

## 2. Ejecutar en local

```bash
npm install
```

Copia `.env.example` a `.env.local` y completa:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=clave-publica
NEXT_PUBLIC_SITE_URL=
```

```bash
npm run dev
```

Abre `http://localhost:4391` (participante), `/admin` y `/pantalla`.

## 3. Subir a GitHub

```bash
git init
git add .
git commit -m "Workshop CM"
gh repo create workshop-cm --private --source=. --push
```

(Sin GitHub CLI: crea el repositorio vacío en github.com y sigue las instrucciones de "push an existing repository".) `.env.local` está en `.gitignore` y no se sube.

## 4. Desplegar en Vercel

1. [vercel.com/new](https://vercel.com/new) → importa el repositorio. Vercel detecta Next.js; no cambies nada del build.
2. En **Environment Variables** agrega las tres variables de `.env.example`. En `NEXT_PUBLIC_SITE_URL` pon la URL final (por ejemplo `https://workshop-cm.vercel.app`): **es la que se codifica en el QR**.
3. **Deploy**. Si cambias el dominio después, actualiza `NEXT_PUBLIC_SITE_URL` y vuelve a desplegar.

Para un enlace corto, elige un nombre de proyecto breve en Vercel (**Settings → Domains**) o conecta un dominio propio.

## 5. El día del workshop

1. Entra a `/admin`, inicia sesión y pulsa **Reiniciar…** para partir con la sala vacía.
2. Pulsa **Abrir pantalla de proyección** y lleva esa ventana al proyector (F11 para pantalla completa).
3. Flujo con el botón principal: **Abrir pregunta 1 → Cerrar respuestas → Abrir pregunta 2 → … → Ir al cierre y liberar el PDF**.
4. Los textos (pregunta 1 y explicaciones de la 2) **no se proyectan hasta que los apruebes**. "Ocultar" los retira de la pantalla.
5. En la pregunta 3, toca un rol en el panel para proyectar sus consejos junto al gráfico.

El temporizador es solo una guía visual: las respuestas se cierran cuando tú lo decides.

## Editar contenido

| Qué | Dónde |
| --- | --- |
| Título, preguntas, tiempos, límites, consejos por rol | `lib/content.ts` |
| Colores y tipografía de la web | variables `:root` en `app/globals.css` y fuentes en `app/layout.tsx` |
| Textos y colores del PDF | `content/kit.json`, luego `npm run pdf` |

Si cambias la lista de roles, actualiza también los ids permitidos en las funciones `submit_roles` y `submit_specialty` del SQL.

## Seguridad

- El navegador solo usa la clave pública. No hay `service_role` en ninguna parte del proyecto.
- Las tablas no aceptan escrituras directas: todo pasa por funciones SQL que validan apodo, largo de texto, opciones, que la pregunta esté abierta y **una respuesta por persona y pregunta**.
- El público solo puede leer el estado de la sala, los votos y los textos **aprobados**. Los textos pendientes y los participantes solo los ve un usuario de la tabla `admins`.
- Las acciones del panel (`admin_*`) verifican en la base de datos que quien llama sea admin.
