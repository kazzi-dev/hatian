"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** A submit button that shows progress while its form's server action runs. */
export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/**
 * Destructive submit that asks for a second tap instead of a blocking dialog.
 * The armed state resets after a few seconds so a stray tap can't delete anything.
 */
export function ConfirmSubmitButton({
  children,
  confirmText,
  className = "btn-ghost",
}: {
  children: React.ReactNode;
  confirmText: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      className={`${className} ${armed ? "!border-red-600 !bg-red-600 !text-white" : ""}`}
      disabled={pending}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      {pending && <Spinner />}
      {armed ? confirmText : children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
