"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim()) return;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("登录链接已经发到你的邮箱。");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="px-6 py-8 md:px-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-6 py-8 md:px-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Login</p>
          <h1 className="mt-2 text-2xl font-semibold">进入你的任务系统</h1>
          <p className="mt-2 text-neutral-600">
            输入邮箱，系统会发一个登录链接给你。
          </p>

          <div className="mt-6 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-neutral-400"
            />

            <button
              onClick={handleLogin}
              className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-white hover:opacity-90"
            >
              Send Magic Link
            </button>

            {message && (
              <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-neutral-200 bg-white px-6 py-4 md:px-10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-500">
            Logged in as {session.user.email}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white hover:opacity-90"
          >
            Sign out
          </button>
        </div>
      </div>
      {children}
    </>
  );
}