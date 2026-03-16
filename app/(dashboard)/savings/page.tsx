"use client";
import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import styles from "./page.module.css";

interface Goal {
  id: string;
  title: string;
  target_amount: string;
  current_amount: string;
  emoji: string;
  deadline: string | null;
  is_completed: boolean;
  created_at: string;
}

const EMOJIS = ["🎯", "👟", "💻", "✈️", "🎮", "🎓", "🏠", "🚗", "💍", "🎸", "📱", "💪"];

export default function SavingsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [form, setForm] = useState({ title: "", target_amount: "", emoji: "🎯", deadline: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/savings-goals");
    const data = await res.json();
    setGoals(data.goals ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/savings-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        target_amount: parseFloat(form.target_amount),
        deadline: form.deadline.trim() === "" ? null : form.deadline,
      }),
    });
    setSubmitting(false);
    setShowForm(false);
    setForm({ title: "", target_amount: "", emoji: "🎯", deadline: "" });
    fetchGoals();
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositGoal) return;
    const newAmount = parseFloat(depositGoal.current_amount) + parseFloat(depositAmount);
    await fetch(`/api/savings-goals/${depositGoal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_amount: newAmount }),
    });
    setDepositGoal(null);
    setDepositAmount("");
    fetchGoals();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/savings-goals/${id}`, { method: "DELETE" });
    fetchGoals();
  }

  const activeGoals = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Savings Goals 🎯</h1>
          <p className={styles.sub}>Stack your wins, one goal at a time</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={styles.addBtn}>
          {showForm ? "✕ Cancel" : "+ New Goal"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className={styles.form}>
          <h2 className={styles.formTitle}>Create a Savings Goal</h2>
          <div className={styles.emojiPicker}>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setForm({ ...form, emoji: e })}
                className={`${styles.emojiBtn} ${form.emoji === e ? styles.emojiActive : ""}`}
              >{e}</button>
            ))}
          </div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Goal Name</label>
              <input
                type="text"
                placeholder="New Jordans, PS5, Trip to NYC..."
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Target Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="150.00"
                value={form.target_amount}
                onChange={e => setForm({ ...form, target_amount: e.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Deadline (optional)</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? "Creating..." : "Create Goal 🎯"}
          </button>
        </form>
      )}

      {/* Deposit Modal */}
      {depositGoal && (
        <div className={styles.modalOverlay} onClick={() => setDepositGoal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{depositGoal.emoji} Add to "{depositGoal.title}"</h2>
            <p className={styles.modalSub}>
              Current: {formatCurrency(parseFloat(depositGoal.current_amount))} / {formatCurrency(parseFloat(depositGoal.target_amount))}
            </p>
            <form onSubmit={handleDeposit}>
              <div className={styles.field}>
                <label>Amount to add ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="10.00"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setDepositGoal(null)} className={styles.cancelBtn}>Cancel</button>
                <button type="submit" className={styles.depositBtn}>Add Money ✓</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonGrid}>
          {[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
        </div>
      ) : (
        <>
          {activeGoals.length === 0 && completedGoals.length === 0 ? (
            <div className={styles.empty}>
              <p>🎯 No goals yet!</p>
              <span>Create your first savings goal and start stacking.</span>
            </div>
          ) : (
            <>
              <div className={styles.goalsGrid}>
                {activeGoals.map(goal => {
                  const pct = Math.min((parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100, 100);
                  const remaining = parseFloat(goal.target_amount) - parseFloat(goal.current_amount);
                  return (
                    <div key={goal.id} className={styles.goalCard}>
                      <div className={styles.goalTop}>
                        <div className={styles.goalEmoji}>{goal.emoji}</div>
                        <button onClick={() => handleDelete(goal.id)} className={styles.goalDelete}>✕</button>
                      </div>
                      <h3 className={styles.goalTitle}>{goal.title}</h3>
                      {goal.deadline && (
                        <p className={styles.goalDeadline}>
                          📅 {new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                      <div className={styles.goalBar}>
                        <div className={styles.goalFill} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={styles.goalAmounts}>
                        <span className={styles.goalCurrent}>{formatCurrency(parseFloat(goal.current_amount))}</span>
                        <span className={styles.goalPct}>{Math.round(pct)}%</span>
                        <span className={styles.goalTarget}>{formatCurrency(parseFloat(goal.target_amount))}</span>
                      </div>
                      <p className={styles.goalRemaining}>
                        {formatCurrency(remaining)} left to go
                      </p>
                      <button onClick={() => setDepositGoal(goal)} className={styles.depositGoalBtn}>
                        + Add Money
                      </button>
                    </div>
                  );
                })}
              </div>

              {completedGoals.length > 0 && (
                <div className={styles.completedSection}>
                  <h2 className={styles.completedTitle}>🏆 Completed Goals</h2>
                  <div className={styles.goalsGrid}>
                    {completedGoals.map(goal => (
                      <div key={goal.id} className={`${styles.goalCard} ${styles.completedCard}`}>
                        <div className={styles.goalTop}>
                          <div className={styles.goalEmoji}>{goal.emoji}</div>
                          <span className={styles.completedBadge}>✅ Done!</span>
                        </div>
                        <h3 className={styles.goalTitle}>{goal.title}</h3>
                        <p className={styles.goalSaved}>Saved {formatCurrency(parseFloat(goal.target_amount))} 🎉</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
