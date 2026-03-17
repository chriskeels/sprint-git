"use client";
import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";
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
        <p className={styles.sub}>Personalized budgeting tips, savings strategies, and habit changes from your real spending data.</p>
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
