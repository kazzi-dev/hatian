"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMemberAction, type ActionState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addMemberAction.bind(null, groupId), {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action}>
      <label htmlFor="new-member" className="label">Add someone</label>
      <div className="flex gap-2">
        <input
          id="new-member"
          name="name"
          className="field"
          placeholder="Their name"
          autoComplete="off"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "new-member-error" : undefined}
          required
        />
        <SubmitButton className="btn-ghost" pendingText="Adding…">Add</SubmitButton>
      </div>
      {state.error && (
        <p id="new-member-error" className="mt-1.5 text-sm text-red-600" role="alert">{state.error}</p>
      )}
    </form>
  );
}
