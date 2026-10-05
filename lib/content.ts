// ============================================================
// TEXTOS EDITABLES DEL WORKSHOP
// Cambia aquí nombres, preguntas, límites y consejos.
// Los ids de los roles deben coincidir con los del SQL (no los cambies).
// ============================================================

export const WORKSHOP = {
  tag: 'Workshop',
  title: 'Community Manager & Influencer Marketing',
  // Línea bajo el título en la pantalla de entrada (presentadoras, evento, fecha…)
  subtitle: 'Responde desde tu móvil y mira los resultados en la pantalla.',
  pdfFile: '/kit-inicio-community-managers.pdf',
  pdfTitle: 'Kit de inicio para Community Managers',
  // Sección final: participar en próximas grabaciones de la marca
  formsUrl: 'https://forms.gle/znxiRdLZJMcXWUPN6',
  formsTitle: 'Participa en las próximas grabaciones',
  formsText: 'Si quieres ser parte de las próximas grabaciones de la marca, déjanos tus datos en el formulario.',
};

export type Role = { id: string; label: string; short: string; lines: string[] };

export const CM_ID = 'cm';

export const ROLES: Role[] = [
  { id: 'cuentas', label: 'Cuentas', short: 'Cuentas', lines: ['Cuentas'] },
  { id: 'redaccion', label: 'Redacción', short: 'Redacción', lines: ['Redacción'] },
  { id: 'arte', label: 'Dirección de Arte', short: 'Arte', lines: ['Dirección', 'de Arte'] },
  { id: 'paid', label: 'Paid Media', short: 'Paid Media', lines: ['Paid Media'] },
  { id: 'smm', label: 'Social Media Manager', short: 'SMM', lines: ['Social Media', 'Manager'] },
  { id: 'cm', label: 'Community Manager', short: 'CM', lines: ['Community', 'Manager'] },
  { id: 'content', label: 'Content Manager / Creative', short: 'Content', lines: ['Content Manager', '/ Creative'] },
  { id: 'data', label: 'Data / Planning', short: 'Data', lines: ['Data /', 'Planning'] },
  { id: 'sac', label: 'SAC', short: 'SAC', lines: ['SAC'] },
  { id: 'influencer', label: 'Influencer Marketing', short: 'Influencers', lines: ['Influencer', 'Marketing'] },
];

export const UNSURE = { id: 'nose', label: 'Aún no lo sé' };

export const OTHER_ROLES = ROLES.filter((r) => r.id !== CM_ID);
export const SPECIALTY_OPTIONS = [...ROLES.map((r) => ({ id: r.id, label: r.label })), UNSURE];

export const roleLabel = (id: string) =>
  SPECIALTY_OPTIONS.find((r) => r.id === id)?.label ?? id;

export const QUESTIONS = {
  q1: {
    n: 1,
    kicker: 'Apertura',
    title: '¿Qué crees que hace un Community Manager?',
    hint: 'Una frase corta, lo primero que se te venga a la cabeza.',
    seconds: 45,
    maxChars: 120,
  },
  q2: {
    n: 3,
    kicker: 'Cierre · roles dentro de una agencia',
    title: '¿Cómo se conectan?',
    hint: 'Una marca va a lanzar una campaña. ¿Con qué tres roles debería colaborar más de cerca el Community Manager?',
    seconds: 90,
    maxPicks: 3,
    maxChars: 100,
  },
  q3: {
    n: 2,
    kicker: 'Especialización',
    title: '¿En qué te quieres especializar?',
    hint: 'Elige una sola opción. No hay respuestas correctas.',
    seconds: 45,
  },
} as const;

export type QuestionId = keyof typeof QUESTIONS;
export type Phase = 'lobby' | QuestionId | 'final';
// Orden en que se presentan: la especialización (q3) va antes que el mapa de roles (q2)
export const PHASES: Phase[] = ['lobby', 'q1', 'q3', 'q2', 'final'];
export const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Sala de espera',
  q1: '1 · Apertura',
  q3: '2 · Especialización',
  q2: '3 · Roles',
  final: 'Cierre y PDF',
};

// Consejos para el cierre: aparecen en la pantalla cuando el presentador
// destaca un rol, y en el móvil de quien lo eligió. EDÍTALOS con tu mirada.
export const TIPS: Record<string, string[]> = {
  cuentas: [
    'Practica traducir lo que pide el cliente en un brief claro para el equipo.',
    'Aprende a manejar expectativas: tiempos, alcances y presupuestos.',
  ],
  redaccion: [
    'Escribe todos los días y adapta una misma idea al tono de tres marcas distintas.',
    'Arma un portafolio de copies: lo que importa es cómo piensas, no para quién fue.',
  ],
  arte: [
    'Entrena el ojo: guarda referencias y explica por qué funcionan.',
    'Domina los formatos de cada red antes de diseñar la pieza.',
  ],
  paid: [
    'Empieza con presupuestos pequeños y mide: aprender a leer resultados es la mitad del trabajo.',
    'Conoce bien los objetivos de campaña y a qué etapa del embudo responde cada uno.',
  ],
  smm: [
    'Piensa en estrategia: objetivos, pilares de contenido y calendario antes que publicaciones sueltas.',
    'Aprende a coordinar personas y plazos; el rol es tanto gestión como redes.',
  ],
  cm: [
    'Escucha antes de responder: la comunidad te dice qué contenido necesita.',
    'Documenta preguntas frecuentes y casos difíciles; es tu mejor insumo para el equipo.',
  ],
  content: [
    'Publica tus propias ideas: probar formatos en tus redes es el mejor laboratorio.',
    'Parte del insight, no de la tendencia; la tendencia es solo el envase.',
  ],
  data: [
    'Aprende a convertir números en una recomendación concreta para el equipo.',
    'Hazte amiga/o de las planillas y de las métricas nativas de cada plataforma.',
  ],
  sac: [
    'Trabaja la empatía por escrito: resolver bien un reclamo fideliza más que un buen post.',
    'Conoce el producto y los protocolos al detalle para responder rápido y con seguridad.',
  ],
  influencer: [
    'Mira más allá de los seguidores: afinidad con la marca y calidad de la comunidad.',
    'Aprende lo básico de contratos, briefs y entregables para cuidar ambas partes.',
  ],
  nose: [
    'Es normal no tenerlo claro: prueba varios roles en prácticas o proyectos propios.',
    'Fíjate en qué tareas se te pasa el tiempo volando; ahí suele haber una pista.',
  ],
};
