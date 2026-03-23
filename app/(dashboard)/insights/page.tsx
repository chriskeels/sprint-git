"use client";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, getCategoryLabel } from "@/lib/utils";
import styles from "./page.module.css";

interface RecommendationReport {
  summary: string;
  budgetingTips: string[];
  savingsStrategies: string[];
  habitChanges: string[];
  answer: string;
}

interface Snapshot {
  totalIncome: number;
  totalSpent: number;
  net: number;
}

interface InsightCard {
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
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

interface GoalForecast {
  id: string;
  title: string;
  emoji: string;
  currentAmount: number;
  targetAmount: number;
  projectedWeeks: number | null;
  weeklyNeeded: number | null;
  status: string;
}

interface NextAction {
  title: string;
  detail: string;
  tag: string;
  icon: string;
}

interface InsightsPayload {
  anomalies: InsightCard[];
  budgetTargets: BudgetTarget[];
  recurringCharges: RecurringCharge[];
  goalForecasts: GoalForecast[];
  nextActions: NextAction[];
  monthChanges: string[];
}

const STARTER_QUESTIONS = [
  "Analyze my spending behavior and tell me my biggest issue.",
  "Give me 3 budgeting tips based on my last 30 days.",
  "How can I save faster without cutting everything?",
  "What habit should I change first this week?",
];

const DEFAULT_PROMPT = "Give me a full recommendation report based on my recent spending.";

export default function InsightsPage() {
  const hasAutoRun = useRef(false);
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function runAnalysis(question: string) {
    if (!question.trim() || loading) return;
    setError("");
    setInput("");
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 second timeout (+ 5s buffer)

      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = data?.error || `Service error (${res.status})`;
        setError(errorMsg);
        console.error("Insights API error:", res.status, errorMsg);
        return;
      }

      setReport(data?.report ?? null);
      setSnapshot(data?.snapshot ?? null);
      setInsights(data?.insights ?? null);
    } catch (err: any) {
      const msg = err?.name === "AbortError"
        ? "Request timed out. The AI service took too long to respond. Try again."
        : "Network error. Check your connection and try again.";
      setError(msg);
      console.error("Insights fetch error:", err?.message || err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasAutoRun.current) return;
    hasAutoRun.current = true;
    void runAnalysis(DEFAULT_PROMPT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>AI Recommendation Service 🤖</h1>
        <p className={styles.sub}>Turn spending history into budget targets, anomaly alerts, savings forecasts, and next-step recommendations.</p>
      </div>

      <div className={styles.chatContainer}>
        {!report ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>🤖</div>
            <h2>{loading ? "Analyzing your spending..." : "Get your recommendation plan"}</h2>
            <p>
              {loading
                ? "Crunching your last 30 days and building personalized advice."
                : "The service analyzes your behavior and gives practical actions you can apply this week."}
            </p>
            <div className={styles.starters}>
              {STARTER_QUESTIONS.map((q) => (
                <button key={q} onClick={() => runAnalysis(q)} className={styles.starterBtn}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.messages}>
            {snapshot && (
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

            {insights && (
              <>
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3>Next Best Actions</h3>
                    <span>Business logic driven</span>
                  </div>
                  <div className={styles.actionGrid}>
                    {insights.nextActions.map((action, i) => (
                      <div key={i} className={styles.actionCard}>
                        <div className={styles.actionCardHeader}>
                          <span className={styles.actionIcon}>{action.icon}</span>
                          <span className={styles.actionTag}>{action.tag}</span>
                        </div>
                        <strong>{action.title}</strong>
                        <p>{action.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3>Spending Alerts</h3>
                    <span>Anomaly detection</span>
                  </div>
                  {insights.anomalies.length === 0 ? (
                    <div className={styles.emptyMini}>No major anomalies detected in the last 30 days.</div>
                  ) : (
                    <div className={styles.insightGrid}>
                      {insights.anomalies.map((item, i) => (
                        <div key={`${item.title}-${i}`} className={styles.metricCard}>
                          <div className={styles.metricTop}>
                            <strong>{item.title}</strong>
                            <span className={`${styles.pill} ${styles[item.severity]}`}>{item.severity}</span>
                          </div>
                          <p>{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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

                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3>Goal Forecasting</h3>
                    <span>Will you hit it on time?</span>
                  </div>
                  {insights.goalForecasts.length === 0 ? (
                    <div className={styles.emptyMini}>Create a savings goal to unlock forecast cards.</div>
                  ) : (
                    <div className={styles.insightGrid}>
                      {insights.goalForecasts.map((goal) => (
                        <div key={goal.id} className={styles.metricCard}>
                          <div className={styles.metricTop}>
                            <strong>{goal.emoji} {goal.title}</strong>
                            <span className={`${styles.pill} ${goal.status.includes("Behind") ? styles.high : styles.low}`}>{goal.status}</span>
                          </div>
                          <p>{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</p>
                          <p>
                            {goal.projectedWeeks
                              ? `Projected in about ${goal.projectedWeeks} week${goal.projectedWeeks === 1 ? "" : "s"}.`
                              : "No pace yet. Add positive monthly leftover or contributions."}
                          </p>
                          {goal.weeklyNeeded && <p>Needed pace: {formatCurrency(goal.weeklyNeeded)}/week</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3>What Changed</h3>
                    <span>Last 30 days vs previous 30</span>
                  </div>
                  <div className={styles.recoSection}>
                    <ul>
                      {insights.monthChanges.map((change, i) => (
                        <li key={i}>{change}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}

            <div className={styles.recoSection}>
              <h3>Behavior Analysis</h3>
              <p>{report.summary}</p>
            </div>

            <div className={styles.recoSection}>
              <h3>Budgeting Tips</h3>
              <ul>
                {report.budgetingTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>

            <div className={styles.recoSection}>
              <h3>Savings Strategies</h3>
              <ul>
                {report.savingsStrategies.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>

            <div className={styles.recoSection}>
              <h3>Habit Changes</h3>
              <ul>
                {report.habitChanges.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>

            {report.answer && (
              <div className={styles.recoSection}>
                <h3>Answer</h3>
                <p>{report.answer}</p>
              </div>
            )}

            <button
              className={styles.starterBtn}
              onClick={() => {
                setReport(null);
                setSnapshot(null);
              }}
            >
              Generate new recommendations
            </button>
          </div>
        )}

        <div className={styles.inputArea}>
          <input
            type="text"
            placeholder="Ask for recommendations: budget plan, savings strategy, habit changes..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runAnalysis(input)}
            disabled={loading}
            className={styles.chatInput}
          />
          <button
            onClick={() => runAnalysis(input)}
            disabled={loading || !input.trim()}
            className={styles.sendBtn}
          >
            {loading ? "..." : "Run"}
          </button>
        </div>

        {loading && (
          <div className={styles.loadingBar}>
            <div className={styles.thinking}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorWrap}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
