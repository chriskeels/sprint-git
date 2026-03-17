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
      console.warn("OPENAI_API_KEY is missing in environment variables");
      return NextResponse.json(
        { error: "AI service is not configured. Please contact support." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30 * 1000, // 30 second timeout
    });

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

    console.log("Calling OpenAI for insights...", { userName: session.name, model: process.env.OPENAI_MODEL || "gpt-4o-mini" });

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

    console.log("OpenAI response received successfully");

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
    console.error("Insights error:", error?.message || error);
    const status = error?.status;
    const code = error?.code;
    
    let message = "AI insights are unavailable right now. Please try again.";
    let httpStatus = 500;

    if (code === "model_not_found" || status === 403) {
      message = "API key does not have access to the configured model. Check OPENAI_API_KEY and OPENAI_MODEL.";
    } else if (status === 401) {
      message = "API authentication failed. Check OPENAI_API_KEY.";
      httpStatus = 401;
    } else if (error?.message?.includes("timeout") || code === "ERR_HTTP_REQUEST_TIMEOUT") {
      message = "AI service took too long to respond. Please try again.";
      httpStatus = 504;
    }

    return NextResponse.json({ error: message }, { status: httpStatus });
  }
}
