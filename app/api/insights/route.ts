import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import OpenAI from "openai";
import { generateRecommendationReport, type SpendingTx } from "@/lib/ai-recommendation";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing in environment variables" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { question } = await req.json();

    // Pull last 30 days of transactions
    const transactions = await query(
      `SELECT type, category, amount, description, date
       FROM transactions
       WHERE user_id = $1 AND date >= NOW() - INTERVAL '30 days'
       ORDER BY date DESC`,
      [session.userId]
    );

    const typedTx: SpendingTx[] = transactions.map((t: any) => ({
      type: t.type,
      category: t.category,
      amount: parseFloat(t.amount),
      description: t.description,
      date: String(t.date),
    }));

    const totalSpent = typedTx
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = typedTx
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const categoryBreakdown: Record<string, number> = {};
    typedTx
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
      });

    const report = await generateRecommendationReport(
      openai,
      {
        userName: session.name,
        totalIncome,
        totalSpent,
        net: totalIncome - totalSpent,
        categoryBreakdown,
        recentTransactions: typedTx,
      },
      question || "Give me a recommendation plan based on my recent spending"
    );

    return NextResponse.json({
      report,
      snapshot: {
        totalIncome,
        totalSpent,
        net: totalIncome - totalSpent,
        categories: categoryBreakdown,
      },
    });
  } catch (error: any) {
    console.error("Insights error:", error);
    const message =
      error?.code === "model_not_found" || error?.status === 403
        ? "This API key/project does not have access to the configured OpenAI model. Set OPENAI_MODEL to a model your project can use (for example: gpt-4o-mini)."
        : "AI insights are unavailable right now. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
