"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Registration failed");
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setError("Couldn't create your account. Check that the app server is running and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <Link href="/" className={styles.logo}>Stack<span>Up</span></Link>
        <h1 className={styles.title}>Start stacking 🚀</h1>
        <p className={styles.sub}>Create your free account in seconds</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Your Name</label>
            <input
              type="text"
              placeholder="Alex Johnson"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
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
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className={styles.field}>
            <label>I am a...</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="student">Student / Young Budgeter</option>
              <option value="mentor">Financial Mentor</option>
            </select>
          </div>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Creating account..." : "Create Account →"}
          </button>
        </form>

        <p className={styles.switchLink}>
          Already have one? <Link href="/auth/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
