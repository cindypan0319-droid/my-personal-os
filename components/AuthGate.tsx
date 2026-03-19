"use client";

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  return <>{children}</>;
}