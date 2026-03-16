import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatCurrency, getCategoryEmoji } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

type DashboardData = {
  totalExpenses: number;
  totalIncome: number;
  recentTx: any[];
  goals: any[];
  streak: any;
  topCategories: any[];
};

async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [monthlyStats, recentTx, goals, streak] = await Promise.all([
    query(
      `SELECT type, category, SUM(amount) as total
       FROM transactions
       WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
       GROUP BY type, category`,
      [userId, month, year]
    ),
    query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 5`,
      [userId]
    ),
    query(
      `SELECT * FROM savings_goals WHERE user_id = $1 AND is_completed = FALSE ORDER BY created_at DESC LIMIT 3`,
      [userId]
    ),
    queryOne(
      `SELECT current_streak, longest_streak, total_days FROM streaks WHERE user_id = $1`,
      [userId]
    ),
  ]);

  const totalExpenses = monthlyStats
    .filter((r: any) => r.type === "expense")
    .reduce((s: number, r: any) => s + parseFloat(r.total), 0);
  const totalIncome = monthlyStats
    .filter((r: any) => r.type === "income")
    .reduce((s: number, r: any) => s + parseFloat(r.total), 0);

  const topCategories = monthlyStats
    .filter((r: any) => r.type === "expense")
    .sort((a: any, b: any) => parseFloat(b.total) - parseFloat(a.total))
    .slice(0, 4);

  return { totalExpenses, totalIncome, recentTx, goals, streak, topCategories } as DashboardData;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const { totalExpenses, totalIncome, recentTx, goals, streak, topCategories } =
    await getDashboardData(session.userId);

  const net = Number(totalIncome) - Number(totalExpenses);
  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long" });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            Hey, {session.name.split(" ")[0]} 👋
          </h1>
          <p className={styles.sub}>{monthName} overview — here's where you stand</p>
        </div>
        <Link href="/transactions" className={styles.addBtn}>+ Add Transaction</Link>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.incomeCard}`}>
          <p className={styles.statLabel}>Income This Month</p>
          <p className={styles.statValue}>{formatCurrency(totalIncome)}</p>
          <p className={styles.statIcon}>💰</p>
        </div>
        <div className={`${styles.statCard} ${styles.expenseCard}`}>
          <p className={styles.statLabel}>Spent This Month</p>
          <p className={styles.statValue}>{formatCurrency(totalExpenses)}</p>
          <p className={styles.statIcon}>💸</p>
        </div>
        <div className={`${styles.statCard} ${net >= 0 ? styles.netPositive : styles.netNegative}`}>
          <p className={styles.statLabel}>Left Over</p>
          <p className={styles.statValue}>{formatCurrency(Math.abs(net))}</p>
          <p className={styles.statIcon}>{net >= 0 ? "✅" : "⚠️"}</p>
        </div>
        <div className={`${styles.statCard} ${styles.streakCard}`}>
          <p className={styles.statLabel}>Day Streak</p>
          <p className={styles.statValue}>{(streak as any)?.current_streak ?? 0}</p>
          <p className={styles.statIcon}>🔥</p>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Top Spending Categories */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Top Spending</h2>
            <Link href="/transactions" className={styles.viewAll}>View all</Link>
          </div>
          {topCategories.length === 0 ? (
            <div className={styles.empty}>
              <p>No spending logged yet this month.</p>
              <Link href="/transactions" className={styles.emptyAction}>Log your first transaction →</Link>
            </div>
          ) : (
            <div className={styles.categories}>
              {topCategories.map((cat: any) => {
                const pct = totalExpenses > 0 ? (parseFloat(cat.total) / totalExpenses) * 100 : 0;
                return (
                  <div key={cat.category} className={styles.catRow}>
                    <div className={styles.catLeft}>
                      <span className={styles.catEmoji}>{getCategoryEmoji(cat.category)}</span>
                      <span className={styles.catName}>{cat.category}</span>
                    </div>
                    <div className={styles.catRight}>
                      <div className={styles.barTrack}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.catAmount}>{formatCurrency(parseFloat(cat.total))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Recent Transactions</h2>
            <Link href="/transactions" className={styles.viewAll}>View all</Link>
          </div>
          {recentTx.length === 0 ? (
            <div className={styles.empty}>
              <p>No transactions yet.</p>
              <Link href="/transactions" className={styles.emptyAction}>Add one now →</Link>
            </div>
          ) : (
            <div className={styles.txList}>
              {recentTx.map((tx: any) => (
                <div key={tx.id} className={styles.txRow}>
                  <div className={styles.txIcon}>{getCategoryEmoji(tx.category)}</div>
                  <div className={styles.txInfo}>
                    <p className={styles.txDesc}>{tx.description || tx.category}</p>
                    <p className={styles.txDate}>
                      {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <p className={`${styles.txAmount} ${tx.type === "income" ? styles.income : styles.expense}`}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(parseFloat(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Savings Goals */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Savings Goals</h2>
            <Link href="/savings" className={styles.viewAll}>View all</Link>
          </div>
          {goals.length === 0 ? (
            <div className={styles.empty}>
              <p>No goals yet. Start saving for something!</p>
              <Link href="/savings" className={styles.emptyAction}>Create a goal →</Link>
            </div>
          ) : (
            <div className={styles.goalsList}>
              {goals.map((goal: any) => {
                const pct = Math.min((parseFloat(goal.current_amount) / parseFloat(goal.target_amount)) * 100, 100);
                return (
                  <div key={goal.id} className={styles.goalRow}>
                    <div className={styles.goalHeader}>
                      <span>{goal.emoji} {goal.title}</span>
                      <span className={styles.goalPct}>{Math.round(pct)}%</span>
                    </div>
                    <div className={styles.goalBar}>
                      <div className={styles.goalFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.goalAmounts}>
                      <span>{formatCurrency(parseFloat(goal.current_amount))}</span>
                      <span className={styles.goalTarget}>{formatCurrency(parseFloat(goal.target_amount))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Nudge */}
        <div className={`${styles.card} ${styles.aiCard}`}>
          <div className={styles.aiIcon}>🤖</div>
          <h2>Get AI Insights</h2>
          <p>Ask StackUp about your spending habits, savings tips, or how to hit your goals faster.</p>
          <Link href="/insights" className={styles.aiBtn}>Chat with StackUp AI →</Link>
        </div>
      </div>
    </div>
  );
}
