"use client";

import { CircleNotch } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Props = Readonly<{ children: ReactNode; pendingLabel: string; className?: string }>;

// Submit button for Server Action forms: shows a spinner and a "…ing" label while the action runs,
// and blocks double submits. Must be rendered inside the <form>.
export function SubmitButton({ children, pendingLabel, className = "" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`flex min-h-11 items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-70 ${className}`}
    >
      {pending ? (
        <>
          <CircleNotch size={20} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          <span role="status">{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
