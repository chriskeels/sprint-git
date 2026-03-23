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

const systemPrompt = `You are a money coach for university and college students.
Your tone is friendly, casual, and direct — like advice from a financially savvy friend, not a bank.

The student is likely juggling part-time work, tight income, and everyday expenses like food, transport, and entertainment.

Rules:
- Write like you're texting a friend, not writing a report. Short sentences. No jargon.
- Use "you" directly. Never say "one should" or "it is advisable to".
- Be specific — use the actual dollar amounts from the data.
- No corporate language. No phrases like "discretionary spending", "allocate funds", or "fiscal discipline".
- Tips should feel doable this week, not someday.
- Never mention "20% of income" as a savings rule — give them the actual dollar number instead.
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
