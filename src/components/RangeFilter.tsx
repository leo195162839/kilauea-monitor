import { RANGES, type RangeKey } from '../config';

export function RangeFilter({ value, onChange }: { value: RangeKey; onChange: (range: RangeKey) => void }) {
  return (
    <fieldset className="range-filter">
      <legend className="visually-hidden">Time range for tilt and earthquakes</legend>
      {RANGES.map((r) => (
        <label key={r.key} className="range-option">
          <input
            type="radio"
            name="range"
            value={r.key}
            checked={value === r.key}
            onChange={() => onChange(r.key)}
          />
          <span>{r.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
