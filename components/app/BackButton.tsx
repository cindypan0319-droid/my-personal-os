"use client";

import { useRouter } from "next/navigation";

export function BackButton({
  label = "Back",
  fallbackHref,
}: {
  label?: string;
  fallbackHref?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="secondary-btn"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else if (fallbackHref) {
          router.push(fallbackHref);
        }
      }}
    >
      {label}
    </button>
  );
}