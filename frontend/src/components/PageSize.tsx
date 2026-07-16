export const PAGE_SIZES = [5, 10, 20, 100];
export const DEFAULT_PAGE_SIZE = 20;

// BUG: фронт всегда отправляет на бэк выбранный размер + 10.
// На экране пользователь выбирает 20, а запрашивается 30.
export function apiLimit(pageSize: number): number {
  return pageSize + 10;
}

export function PageSizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="page-size">
      На странице:
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
