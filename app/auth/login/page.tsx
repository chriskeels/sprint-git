"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error ?? `Login failed (${res.status})`;
        console.error("Login error:", msg, data);
        setError(msg);
        return;
      }

      window.location.assign("/dashboard");
    } catch (err) {
      const msg = "Couldn't reach the server. Make sure the app is running.";
      console.error("Login fetch error:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>Stack<span>Up</span></Link>
        <h1 className={styles.title}>Welcome back 👋</h1>
        <p className={styles.sub}>Log in to check your money moves</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Logging in..." : "Log In →"}
          </button>
          {error && (
            <div className={styles.error} style={{ marginTop: "12px" }}>
              ⚠️ {error}
            </div>
          )}
        </form>

        <p className={styles.switchLink}>
          No account? <Link href="/auth/register">Sign up free</Link>
        </p>
      </div>
    </main>
  );
}
