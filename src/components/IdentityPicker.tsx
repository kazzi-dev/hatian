"use client";

import { useState } from "react";
import type { Member } from "@/lib/repo";
import { Avatar } from "./ui";

/**
 * "Who are you?" — big tappable name chips instead of a dropdown. Once chosen it
 * collapses to a single line with a "change" link so it stays out of the way.
 */
export function IdentityPicker({
  members,
  meId,
  action,
}: {
  members: Member[];
  meId: string;
  action: (form: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!meId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const me = members.find((m) => m.id === meId);

  if (me && !editing) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-600">
        <Avatar id={me.id} name={me.name} size="sm" />
        Viewing as <span className="font-semibold text-stone-900">{me.name}</span>
        <button type="button" onClick={() => setEditing(true)} className="text-emerald-700 underline-offset-2 hover:underline">
          Not you?
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="font-medium text-emerald-950">Who are you?</p>
      <p className="mb-3 text-sm text-emerald-800">Tap your name to see what you owe and what you&apos;re owed.</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choose your name">
        {members.map((m) => (
          <form
            key={m.id}
            action={async (fd) => {
              setPendingId(m.id);
              await action(fd);
              setPendingId(null);
              setEditing(false);
            }}
          >
            <input type="hidden" name="memberId" value={m.id} />
            <button className="chip" role="radio" aria-checked={m.id === (pendingId ?? meId)}>
              <Avatar id={m.id} name={m.name} />
              {m.name}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
