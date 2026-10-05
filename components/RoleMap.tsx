import { OTHER_ROLES } from '@/lib/content';

const W = 1000;
const H = 720;
const CX = W / 2;
const CY = H / 2;
const RX = 385;
const RY = 285;

const NODES = OTHER_ROLES.map((role, i) => {
  const a = ((-90 + (i * 360) / OTHER_ROLES.length) * Math.PI) / 180;
  return { role, x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
});

type Props = {
  /** Votos por rol: el grosor de cada conexión crece con su cantidad. */
  counts?: Record<string, number>;
  /** Roles elegidos por el participante (versión móvil). */
  selected?: string[];
  compact?: boolean;
  onToggle?: (id: string) => void;
};

export default function RoleMap({ counts = {}, selected, compact, onToggle }: Props) {
  const max = Math.max(1, ...NODES.map((n) => counts[n.role.id] ?? 0));
  const nodeW = compact ? 250 : 230;
  const nodeH = compact ? 84 : 78;

  return (
    <svg className={`rolemap${compact ? ' rolemap--compact' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Mapa de roles de la agencia con Community Manager al centro">
      {NODES.map(({ role, x, y }) => {
        const n = counts[role.id] ?? 0;
        const on = selected ? selected.includes(role.id) : n > 0;
        const ratio = selected ? (on ? 0.55 : 0) : n / max;
        return (
          <line
            key={role.id}
            className={`rolemap__link${on ? ' is-on' : ''}`}
            x1={CX} y1={CY} x2={x} y2={y}
            style={{ strokeWidth: on ? 4 + 26 * ratio : 2, opacity: on ? 0.35 + 0.65 * ratio : 0.22 }}
          />
        );
      })}

      {NODES.map(({ role, x, y }) => {
        const n = counts[role.id] ?? 0;
        const on = selected ? selected.includes(role.id) : n > 0;
        const lines = compact ? [role.short] : role.lines;
        return (
          <g
            key={role.id}
            className={`rolemap__node${on ? ' is-on' : ''}${onToggle ? ' is-tappable' : ''}`}
            onClick={onToggle ? () => onToggle(role.id) : undefined}
          >
            <rect x={x - nodeW / 2} y={y - nodeH / 2} width={nodeW} height={nodeH} rx={nodeH / 2} />
            {lines.map((line, i) => (
              <text key={line} x={x} y={y + (i - (lines.length - 1) / 2) * 27} dy="0.35em" textAnchor="middle">
                {line}
              </text>
            ))}
            {!selected && n > 0 && (
              <g className="rolemap__badge" key={n}>
                <circle cx={x + nodeW / 2 - 8} cy={y - nodeH / 2 + 4} r={25} />
                <text x={x + nodeW / 2 - 8} y={y - nodeH / 2 + 4} dy="0.35em" textAnchor="middle">{n}</text>
              </g>
            )}
          </g>
        );
      })}

      <g className="rolemap__center">
        <circle className="rolemap__halo" cx={CX} cy={CY} r={128} />
        <circle cx={CX} cy={CY} r={104} />
        <text x={CX} y={CY - 16} dy="0.35em" textAnchor="middle">Community</text>
        <text x={CX} y={CY + 18} dy="0.35em" textAnchor="middle">Manager</text>
      </g>
    </svg>
  );
}
