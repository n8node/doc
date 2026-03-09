"use client";

import { ReactNode } from "react";
import { signOut } from "next-auth/react";

interface LogoutButtonProps {
  className?: string;
  children: ReactNode;
}

export function LogoutButton({ className, children }: LogoutButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void signOut({ callbackUrl: "/" });
      }}
    >
      {children}
    </button>
  );
}
