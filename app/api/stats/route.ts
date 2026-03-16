import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [monthlyStats, streakData, goalsCount] = await Promise.all([
    query(
      `SELECT type, category, SUM(amount) as total, COUNT(*) as count
       FROM transactions
       WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
       GROUP BY type, category`,
      [session.userId, month, year]
    ),
    queryOne(
      "SELECT current_streak, longest_streak, total_days FROM streaks WHERE user_id = $1",
      [session.userId]
    ),
    queryOne(
      "SELECT COUNT(*) as total, SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed FROM savings_goals WHERE user_id = $1",
      [session.userId]
    ),
  ]);

  const expenses = monthlyStats.filter((r: any) => r.type === "expense");
  const income = monthlyStats.filter((r: any) => r.type === "income");

  const totalExpenses = expenses.reduce((s: number, r: any) => s + parseFloat(r.total), 0);
  const totalIncome = income.reduce((s: number, r: any) => s + parseFloat(r.total), 0);

  const categoryBreakdown = expenses.map((r: any) => ({
    category: r.category,
    total: parseFloat(r.total),
    count: parseInt(r.count),
  }));

  return NextResponse.json({
    totalExpenses,
    totalIncome,
    net: Number(totalIncome) - Number(totalExpenses),
    categoryBreakdown,
    streak: streakData,
    goals: goalsCount,
  });
}
