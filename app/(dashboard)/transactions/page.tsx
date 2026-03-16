"use client";
import { useState, useEffect, useCallback } from "react";
import { formatCurrency, getCategoryEmoji, getCategoryLabel, CATEGORIES } from "@/lib/utils";
import styles from "./page.module.css";

interface Transaction {
  id: string;
  amount: string;
  type: "income" | "expense";
  category: string;
  description: string;
  date: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState({ type: "", month: "", year: new Date().getFullYear().toString() });
  const [form, setForm] = useState({
    amount: "",
    type: "expense",
    category: "food",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.type) params.set("type", filter.type);
    if (filter.month) params.set("month", filter.month);
    if (filter.year) params.set("year", filter.year);
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setSubmitting(false);
    setShowForm(false);
    setForm({ amount: "", type: "expense", category: "food", description: "", date: new Date().toISOString().split("T")[0] });
    fetchTransactions();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchTransactions();
  }

  const categories = form.type === "expense" ? CATEGORIES.expense : CATEGORIES.income;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Transactions 💳</h1>
          <p className={styles.sub}>Every dollar in and out</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={styles.addBtn}>
          {showForm ? "✕ Cancel" : "+ Add Transaction"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <h2 className={styles.formTitle}>New Transaction</h2>
          <div className={styles.formGrid}>
            <div className={styles.typeToggle}>
              <button
                type="button"
                className={`${styles.typeBtn} ${form.type === "expense" ? styles.expenseActive : ""}`}
                onClick={() => setForm({ ...form, type: "expense", category: "food" })}
              >💸 Expense</button>
              <button
                type="button"
                className={`${styles.typeBtn} ${form.type === "income" ? styles.incomeActive : ""}`}
                onClick={() => setForm({ ...form, type: "income", category: "job" })}
              >💰 Income</button>
            </div>

            <div className={styles.field}>
              <label>Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>

            <div className={styles.field}>
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Description (optional)</label>
              <input
                type="text"
                placeholder="What was this for?"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
          </div>
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? "Saving..." : "Save Transaction ✓"}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} className={styles.filterSelect}>
          <option value="">All Types</option>
          <option value="expense">💸 Expenses</option>
          <option value="income">💰 Income</option>
        </select>
        <select value={filter.month} onChange={e => setFilter({ ...filter, month: e.target.value })} className={styles.filterSelect}>
          <option value="">All Months</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {new Date(2024, i).toLocaleString("default", { month: "long" })}
            </option>
          ))}
        </select>
        <select value={filter.year} onChange={e => setFilter({ ...filter, year: e.target.value })} className={styles.filterSelect}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className={styles.skeleton}>
          {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className={styles.empty}>
          <p>🔍 No transactions found</p>
          <span>Try changing filters or add a new transaction</span>
        </div>
      ) : (
        <div className={styles.list}>
          {transactions.map((tx) => (
            <div key={tx.id} className={styles.txRow}>
              <div className={styles.txIcon}>{getCategoryEmoji(tx.category)}</div>
              <div className={styles.txInfo}>
                <p className={styles.txDesc}>{tx.description || getCategoryLabel(tx.category)}</p>
                <p className={styles.txMeta}>
                  <span className={`${styles.badge} ${tx.type === "income" ? styles.incomeBadge : styles.expenseBadge}`}>
                    {tx.type}
                  </span>
                  · {getCategoryLabel(tx.category)} ·{" "}
                  {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <p className={`${styles.amount} ${tx.type === "income" ? styles.income : styles.expense}`}>
                {tx.type === "income" ? "+" : "-"}{formatCurrency(parseFloat(tx.amount))}
              </p>
              <button onClick={() => handleDelete(tx.id)} className={styles.deleteBtn} title="Delete">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
