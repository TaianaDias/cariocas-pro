import type { SelectHTMLAttributes } from "react";

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  helperText?: string;
  label?: string;
  options: SelectOption[];
};

export function Select({ className = "", helperText, label, options, ...props }: SelectProps) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span className="field__label">{label}</span> : null}
      <select className="select-input" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <span className="field__helper">{helperText}</span> : null}
    </label>
  );
}
