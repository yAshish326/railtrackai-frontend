import { forwardRef, type ButtonHTMLAttributes } from "react";

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
}

const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  { children, className = "", variant = "primary", isLoading = false, disabled, type = "button", ...rest },
  ref,
) {
  const resolvedClassName = ["app-button", `app-button--${variant}`, className].filter(Boolean).join(" ");

  return (
    <button ref={ref} type={type} className={resolvedClassName} disabled={disabled || isLoading} {...rest}>
      {isLoading ? "Please wait..." : children}
    </button>
  );
});

export default AppButton;
