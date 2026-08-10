import { forwardRef, type InputHTMLAttributes } from "react";

interface AppInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  { className = "", label, id, ...rest },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="field">
      {label ? (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      ) : null}
      <input id={inputId} ref={ref} className={["app-input", className].filter(Boolean).join(" ")} {...rest} />
    </div>
  );
});

export default AppInput;
