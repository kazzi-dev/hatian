"use client";

import { useState } from "react";

/** The group URL is the invite: anyone with the link can join in. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Link copied!" : "Copy invite link"}
    </button>
  );
}
