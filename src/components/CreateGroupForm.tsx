"use client";

import { useActionState, useState } from "react";
import { createGroupAction, type ActionState } from "@/app/actions";
import { Spinner } from "./SubmitButton";
import { Avatar } from "./ui";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createGroupAction, {});
  const [members, setMembers] = useState("");
  // Live preview of the parsed names so people see exactly who will be in the group.
  const names = [...new Set(members.split(/[\n,]/).map((n) => n.trim()).filter(Boolean))];

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Group name</label>
        <input id="name" name="name" className="field" placeholder="Siargao Trip" autoComplete="off" required />
      </div>
      <div>
        <label className="label" htmlFor="members">Who&apos;s in it?</label>
        <textarea
          id="members"
          name="members"
          className="field min-h-20"
          placeholder="Ana, Ben, Carlo"
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          aria-describedby="members-hint"
          required
        />
        <p id="members-hint" className="mt-1.5 text-xs text-stone-500">
          Separate names with commas or new lines. Include yourself.
        </p>
        {names.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Members to add">
            {names.map((n) => (
              <li key={n} className="chip min-h-8 py-0.5 text-xs">
                <Avatar id={n} name={n} size="sm" />
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending} aria-busy={pending}>
        {pending && <Spinner />}
        {pending ? "Creating…" : names.length >= 2 ? `Create group with ${names.length} people` : "Create group"}
      </button>
    </form>
  );
}
