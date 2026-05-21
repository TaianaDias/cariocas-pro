import type { InputHTMLAttributes, ReactNode } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  icon?: ReactNode;
};

export function TextInput({ className = "", helperText, icon, label, ...props }: TextInputProps) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span className="field__label">{label}</span> : null}
      <span className={icon ? "field__control field__control--with-icon" : "field__control"}>
        {icon ? (
          <span className="field__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <input className="text-input" {...props} />
      </span>
      {helperText ? <span className="field__helper">{helperText}</span> : null}
    </label>
  );
}
