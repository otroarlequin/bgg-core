function FilterClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Limpiar filtro"
      className="rounded px-1 text-muted-dim hover:text-ink"
    >
      ×
    </button>
  );
}

function FilterLabel({
  label,
  showClear,
  onClear,
}: {
  label: string;
  showClear?: boolean;
  onClear?: () => void;
}) {
  return (
    <div className="mb-1 flex items-center justify-between text-muted">
      <span>{label}</span>
      {showClear && onClear ? <FilterClearButton onClick={onClear} /> : null}
    </div>
  );
}

const controlClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink";

export function FilterSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Todos",
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-sm text-ink-soft">
      <FilterLabel
        label={label}
        showClear={Boolean(value)}
        onClear={() => onChange(undefined)}
      />
      <select
        className={controlClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MultiFilterSelect({
  label,
  options,
  values,
  onChange,
  placeholder = "Añadir...",
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const available = options.filter((option) => !values.includes(option));

  return (
    <div className="text-sm text-ink-soft">
      <FilterLabel
        label={label}
        showClear={values.length > 0}
        onClear={() => onChange([])}
      />
      <select
        className={controlClass}
        value=""
        disabled={available.length === 0}
        onChange={(e) => {
          const next = e.target.value;
          if (next && !values.includes(next)) {
            onChange([...values, next]);
          }
        }}
      >
        <option value="">{available.length === 0 ? "Sin más opciones" : placeholder}</option>
        {available.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {values.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-xs text-ink-soft"
            >
              <span>{value}</span>
              <button
                type="button"
                aria-label={`Quitar ${value}`}
                className="rounded px-0.5 text-muted-dim hover:text-ink"
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FilterNumberInput({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value?: number;
  onChange: (next: number | undefined) => void;
  min?: number;
}) {
  return (
    <label className="text-sm text-ink-soft">
      <FilterLabel
        label={label}
        showClear={value != null}
        onClear={() => onChange(undefined)}
      />
      <input
        type="number"
        min={min}
        className={controlClass}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value ? Number(e.target.value) : undefined)
        }
      />
    </label>
  );
}
