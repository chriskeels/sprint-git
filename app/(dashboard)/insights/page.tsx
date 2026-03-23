"use client";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, getCategoryLabel } from "@/lib/utils";
import styles from "./page.module.css";

interface Snapshot {
  totalIncome: number;
  totalSpent: number;
  net: number;
}

interface BudgetTarget {
  category: string;
  displayName: string;
  current: number;
  target: number;
}

interface RecurringCharge {
  label: string;
  category: string;
  amount: number;
  occurrences: number;
}

interface RecommendationReport {
  summary: string;
  budgetingTips: string[];
  savingsStrategies: string[];
}

interface InsightsPayload {
  budgetTargets: BudgetTarget[];
  recurringCharges: RecurringCharge[];
}

export default function InsightsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadInsights() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetsOnly: false }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || `Service error (${res.status})`);
        return;
      }

      setSnapshot(data?.snapshot ?? null);
      setReport(data?.report ?? null);
      setInsights({
        budgetTargets: data?.insights?.budgetTargets ?? [],
        recurringCharges: data?.insights?.recurringCharges ?? [],
      });
    } catch {
      setError("Could not load insights right now.");
    } finally {
      setLoading(false);
    }
  }

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void loadInsights();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Spending Insights</h1>
        <p className={styles.sub}>Focused view: category caps and recurring expenses.</p>
      </div>

      <div className={styles.chatContainer}>
        <div className={styles.messages}>
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinnerWrap}>
                <span className={styles.spinner} />
                <span className={styles.loadingLabel}>Analysing your transactions...</span>
              </div>
              <div className={styles.skeletonBlock}>
                <div className={styles.skeletonLine} style={{ width: "55%" }} />
                <div className={styles.skeletonLine} style={{ width: "80%" }} />
                <div className={styles.skeletonLine} style={{ width: "65%" }} />
              </div>
              <div className={styles.skeletonBlock}>
                <div className={styles.skeletonLine} style={{ width: "40%" }} />
                <div className={styles.skeletonLine} style={{ width: "70%" }} />
              </div>
            </div>
          )}

          {!loading && snapshot && (
            <div className={styles.snapshotRow}>
              <div className={styles.snapshotCard}>
                <span>Income</span>
                <strong>{formatCurrency(snapshot.totalIncome)}</strong>
              </div>
              <div className={styles.snapshotCard}>
                <span>Spent</span>
                <strong>{formatCurrency(snapshot.totalSpent)}</strong>
              </div>
              <div className={styles.snapshotCard}>
                <span>Net</span>
                <strong>{formatCurrency(snapshot.net)}</strong>
              </div>
            </div>
          )}

          {!loading && report && (
            <div className={styles.aiBlock}>
              <div className={styles.aiBlockHeader}>
                <span className={styles.aiBlockTitle}>✨ Personalized Recommendations</span>
                <span className={styles.aiBlockBadge}>AI · based on your data</span>
              </div>

              <p className={styles.aiSummaryText}>{report.summary}</p>

              <div className={styles.tipColumns}>
                {report.budgetingTips.length > 0 && (
                  <div className={styles.tipGroup}>
                    <span className={styles.tipGroupLabel}>💰 Budgeting</span>
                    {report.budgetingTips.map((tip, i) => (
                      <div key={i} className={`${styles.tipItem} ${styles.tipBudget}`}>{tip}</div>
                    ))}
                  </div>
                )}
                {report.savingsStrategies.length > 0 && (
                  <div className={styles.tipGroup}>
                    <span className={styles.tipGroupLabel}>🎯 Savings</span>
                    {report.savingsStrategies.map((s, i) => (
                      <div key={i} className={`${styles.tipItem} ${styles.tipSavings}`}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && insights && (
            <>
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <h3>Smart Budget Targets</h3>
                  <span>Suggested category caps</span>
                </div>
                {insights.budgetTargets.length === 0 ? (
                  <div className={styles.emptyMini}>Add more expense transactions to generate budget targets.</div>
                ) : (
                  <div className={styles.insightGrid}>
                    {insights.budgetTargets.map((item) => (
                      <div key={item.category} className={styles.metricCard}>
                        <strong>{item.displayName || getCategoryLabel(item.category)}</strong>
                        <p>Current pace: {formatCurrency(item.current)}</p>
                        <p>Suggested target: {formatCurrency(item.target)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <h3>Recurring Expense Detection</h3>
                  <span>Potential subscriptions or repeats</span>
                </div>
                {insights.recurringCharges.length === 0 ? (
                  <div className={styles.emptyMini}>No strong recurring patterns detected yet.</div>
                ) : (
                  <div className={styles.insightGrid}>
                    {insights.recurringCharges.map((item, i) => (
                      <div key={`${item.label}-${i}`} className={styles.metricCard}>
                        <strong>{item.label}</strong>
                        <p>{getCategoryLabel(item.category)} · {item.occurrences} matches</p>
                        <p>{formatCurrency(item.amount)} each</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && (
            <button className={styles.starterBtn} onClick={() => void loadInsights()}>
              Refresh Insights
            </button>
          )}
        </div>

        {error && <div className={styles.errorWrap}>{error}</div>}
      </div>
    </div>
  );
}
