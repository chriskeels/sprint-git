import OpenAI from "openai";

export interface SpendingTx {
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string | null;
  date: string;
}

export interface SpendingSnapshot {
  userName: string;
  totalIncome: number;
  totalSpent: number;
  net: number;
  categoryBreakdown: Record<string, number>;
  recentTransactions: SpendingTx[];
}

export interface RecommendationReport {
  summary: string;
  budgetingTips: string[];
  savingsStrategies: string[];
  habitChanges: string[];
  answer: string;
}

const PRIMARY_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const FALLBACK_MODEL = "gpt-4o-mini";

const systemPrompt = `You are the StackUp AI Recommendation Service.
You provide actionable, personalized financial coaching for students.

Responsibilities:
1) Analyze spending behavior
2) Generate personalized budgeting tips
3) Answer the user's question in natural language
4) Suggest savings strategies and habit changes

Rules:
- Be encouraging, practical, and direct.
- Keep total response concise.
- Use specific numbers from the provided data when possible.
- Avoid generic filler advice.
- Return valid JSON only using this exact shape:
{
  "summary": "string",
  "budgetingTips": ["string", "string", "string"],
  "savingsStrategies": ["string", "string", "string"],
  "habitChanges": ["string", "string", "string"],
  "answer": "string"
}`;

function normalizeReport(raw: any): RecommendationReport {
  const asList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

  return {
    summary: String(raw?.summary || "Your spending is being tracked. Keep going and review your top categories weekly.").trim(),
    budgetingTips: asList(raw?.budgetingTips),
    savingsStrategies: asList(raw?.savingsStrategies),
    habitChanges: asList(raw?.habitChanges),
    answer: String(raw?.answer || "I can help break this into a weekly spending plan based on your current data.").trim(),
  };
}

export async function generateRecommendationReport(
  openai: OpenAI,
  snapshot: SpendingSnapshot,
  question: string
): Promise<RecommendationReport> {
  const userPrompt = `Student: ${snapshot.userName}
Question: ${question || "Give me a recommendation plan based on my recent spending"}

Data (last 30 days):
- Total income: $${snapshot.totalIncome.toFixed(2)}
- Total spent: $${snapshot.totalSpent.toFixed(2)}
- Net: $${snapshot.net.toFixed(2)}
- Category breakdown: ${JSON.stringify(snapshot.categoryBreakdown)}
- Recent transactions: ${JSON.stringify(snapshot.recentTransactions.slice(0, 12))}`;

  const request = {
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
    response_format: { type: "json_object" as const },
  };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      ...request,
    });
  } catch (error: any) {
    const status = error?.status;
    const code = error?.code;
    if ((status === 403 || code === "model_not_found") && PRIMARY_MODEL !== FALLBACK_MODEL) {
      completion = await openai.chat.completions.create({
        model: FALLBACK_MODEL,
        ...request,
      });
    } else {
      throw error;
    }
  }

  const content = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  return normalizeReport(parsed);
}
