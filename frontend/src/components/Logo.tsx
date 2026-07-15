export function PawIcon({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="#8B5A2B" aria-hidden="true">
      <ellipse cx="32" cy="44" rx="14" ry="11" />
      <ellipse cx="14" cy="30" rx="6.5" ry="8.5" />
      <ellipse cx="26" cy="20" rx="6" ry="8.5" />
      <ellipse cx="38" cy="20" rx="6" ry="8.5" />
      <ellipse cx="50" cy="30" rx="6.5" ry="8.5" />
    </svg>
  );
}
