import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import OpenAI from "openai";
import {
  generateRecommendationReport,
  type RecommendationReport,
  type SpendingTx,
} from "@/lib/ai-recommendation";

type GoalRow = {
  id: string;
  title: string;
  emoji: string;
  target_amount: string;
  current_amount: string;
  deadline: string | null;
};

type InsightCard = {
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};

type BudgetTarget = {
  category: string;
  displayName: string;
  current: number;
  target: number;
};

type RecurringCharge = {
  label: string;
  category: string;
  amount: number;
  occurrences: number;
};

type GoalForecast = {
  id: string;
  title: string;
  emoji: string;
  currentAmount: number;
  targetAmount: number;
  projectedWeeks: number | null;
  weeklyNeeded: number | null;
  status: string;
};

type NextAction = {
  title: string;
  detail: string;
  tag: string;
  icon: string;
};

type RiskItem = {
  title: string;
  detail: string;
  daysAway: number | null;
  riskLevel: "high" | "medium" | "low";
  icon: string;
};

type BehaviorTrigger = {
  pattern: string;
  detail: string;
  totalImpact: number;
  rule: string;
  icon: string;
};

type GoalAllocation = {
  id: string;
  title: string;
  emoji: string;
  recommendedWeekly: number;
  allocationPercent: number;
  priority: number;
  reason: string;
};

function resolveDisplayName(category: string, transactions: SpendingTx[]): string {
  if (category.toLowerCase() !== "other") return category;
  // Sum amounts per description for 'other' category transactions
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense" || tx.category.toLowerCase() !== "other") continue;
    const desc = tx.description?.trim();
    if (!desc) continue;
    totals.set(desc, (totals.get(desc) || 0) + tx.amount);
  }
  if (totals.size === 0) return "Other";
  // Return the description with the highest total spend
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function categoryLabel(category: string): string {
  return category.toLowerCase() === "other" ? "Other" : category;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function groupExpensesByCategory(transactions: SpendingTx[]) {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  }
  return totals;
}

function sumByType(transactions: SpendingTx[], type: "income" | "expense") {
  return transactions
    .filter((tx) => tx.type === type)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function findRecurringCharges(transactions: SpendingTx[]): RecurringCharge[] {
  const grouped = new Map<string, { label: string; category: string; amount: number; dates: Set<string> }>();

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const label = (tx.description?.trim() || tx.category).toLowerCase();
    const roundedAmount = Math.round(tx.amount * 100) / 100;
    const key = `${label}::${roundedAmount}`;
    const existing = grouped.get(key) || {
      label: tx.description?.trim() || tx.category,
      category: tx.category,
      amount: roundedAmount,
      dates: new Set<string>(),
    };
    existing.dates.add(String(tx.date).slice(0, 10));
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .filter((item) => item.dates.size >= 2)
    .map((item) => ({
      label: item.label,
      category: item.category,
      amount: item.amount,
      occurrences: item.dates.size,
    }))
    .sort((a, b) => b.amount * b.occurrences - a.amount * a.occurrences)
    .slice(0, 3);
}

const CATEGORY_TIPS: Record<
  string,
  { title: (a: number) => string; detail: (a: number, t: number) => string; icon: string }
> = {
  food: {
    title: () => "Meal-prep to cut your food bill",
    detail: (a) =>
      `Food cost you $${a.toFixed(2)} this month. Cooking 3–4 meals at home per week saves students an average of $60–$80/month — that's one less shift you need to work.`,
    icon: "🍱",
  },
  groceries: {
    title: () => "Plan grocery trips before you shop",
    detail: (a) =>
      `You spent $${a.toFixed(2)} on groceries. Writing a list before each shop and buying strictly from it cuts grocery spend by 20–30% for most students.`,
    icon: "🛒",
  },
  dining: {
    title: () => "Cap dining out at twice a week",
    detail: (a) =>
      `Dining out cost you $${a.toFixed(2)} this month. A strict twice-a-week rule typically cuts this by 35–50% — choose your two days in advance so you don't decide in the moment.`,
    icon: "🍽️",
  },
  entertainment: {
    title: () => "Audit every subscription you're paying for",
    detail: (a) =>
      `You spent $${a.toFixed(2)} on entertainment. List every recurring charge, open each one, and cancel anything you haven't used in the last 2 weeks — forgotten trials average $13/month for students.`,
    icon: "📺",
  },
  transport: {
    title: () => "Switch to a student transit pass",
    detail: (a) =>
      `Transport cost you $${a.toFixed(2)} this month. A monthly student pass typically cuts commuting costs by 30–40% versus ride-hailing apps — check if your institution subsidises it further.`,
    icon: "🚌",
  },
  shopping: {
    title: () => "Use the 48-hour rule before every non-essential purchase",
    detail: (a) =>
      `Shopping totalled $${a.toFixed(2)}. Add items to a wishlist and wait 48 hours before buying — this removes roughly 40% of impulse purchases for students without requiring willpower.`,
    icon: "🛍️",
  },
  subscriptions: {
    title: () => "Cancel one subscription right now — not later",
    detail: (a) =>
      `You're paying $${a.toFixed(2)} in subscriptions. Open each service, check your last login date, and cancel the one you used least. You can always re-subscribe — but you can't un-pay what's already gone.`,
    icon: "🔁",
  },
  health: {
    title: () => "Check if your university covers this for free",
    detail: (a) =>
      `Health spending hit $${a.toFixed(2)}. Most universities offer free or subsidised counselling, physio, and GP visits through student services — check before paying out of pocket.`,
    icon: "🏥",
  },
  clothing: {
    title: () => "Try a one-in-one-out rule for clothing",
    detail: (a) =>
      `Clothing cost you $${a.toFixed(2)}. Only buying something new when you donate or sell an existing item forces you to evaluate whether you actually need it — most students find this halves clothing spend.`,
    icon: "👗",
  },
};

function buildNextActions(
  budgetTargets: BudgetTarget[],
  recurringCharges: RecurringCharge[],
  goalForecasts: GoalForecast[],
  totalIncome: number,
  totalSpent: number
): NextAction[] {
  const actions: NextAction[] = [];

  // Action 1: Top category with student-specific advice
  if (budgetTargets[0]) {
    const { category, displayName, current, target } = budgetTargets[0];
    const label = displayName;
    const cat = label.toLowerCase();
    const tipKey = Object.keys(CATEGORY_TIPS).find((k) => cat.includes(k)) ??
      (category.toLowerCase() !== label.toLowerCase() ? undefined : undefined);
    const catKey = tipKey ?? Object.keys(CATEGORY_TIPS).find((k) => category.toLowerCase().includes(k));
    if (catKey) {
      const tip = CATEGORY_TIPS[catKey];
      actions.push({
        title: tip.title(current),
        detail: tip.detail(current, target),
        tag: "Top Spend",
        icon: tip.icon,
      });
    } else {
      const weeklyReduction = Math.max((current - target) / 4, 0).toFixed(2);
      actions.push({
        title: `Set a weekly spending cap for ${label}`,
        detail: `${label} was your highest category at $${current.toFixed(2)}. Decide your weekly max before you spend — not after. Trimming $${weeklyReduction}/week lands you at your target by next month.`,
        tag: "Top Spend",
        icon: "✂️",
      });
    }
  }

  // Action 2: Overspending gap or savings goal
  if (totalSpent > totalIncome) {
    const gap = totalSpent - totalIncome;
    const weeklyFix = (gap / 4).toFixed(2);
    actions.push({
      title: "You're spending more than you earn — fix this now",
      detail: `You spent $${gap.toFixed(2)} more than you brought in this month. Cutting just $${weeklyFix}/week across your top two categories would break even within 30 days — that's the only number that matters right now.`,
      tag: "⚠️ Alert",
      icon: "⚠️",
    });
  } else if (goalForecasts[0]) {
    const goal = goalForecasts[0];
    const isBehind = goal.status === "Behind pace";
    if (isBehind && goal.weeklyNeeded) {
      actions.push({
        title: `Get \"${goal.title}\" back on schedule`,
        detail: `You need $${goal.weeklyNeeded.toFixed(2)}/week to hit your goal by the deadline but you're currently behind. Set a recurring Monday transfer for exactly that amount — automate it so the decision is already made.`,
        tag: "Savings",
        icon: "🎯",
      });
    } else {
      const net = totalIncome - totalSpent;
      actions.push({
        title: `Direct your $${net.toFixed(2)} surplus — don't let it disappear`,
        detail: `You have a $${net.toFixed(2)} surplus this month. Split it: half to \"${goal.title}\", half to an emergency buffer. Unallocated money gets spent on nothing memorable — give it a job before the week ends.`,
        tag: "Savings",
        icon: "💰",
      });
    }
  } else {
    const net = totalIncome - totalSpent;
    if (net > 0) {
      actions.push({
        title: "Create a savings goal for your surplus",
        detail: `You have a $${net.toFixed(2)} surplus with no active savings goal to direct it. Even a $500 emergency fund stops you from going into debt the next time something unexpected happens.`,
        tag: "Savings",
        icon: "💰",
      });
    }
  }

  // Action 3: Recurring charge review or behavioural habit
  if (recurringCharges[0]) {
    const charge = recurringCharges[0];
    const annualised = (charge.amount * 12).toFixed(2);
    actions.push({
      title: `Is \"${charge.label}\" worth $${annualised}/year to you?`,
      detail: `This charge appears ${charge.occurrences}× in your recent history at $${charge.amount.toFixed(2)} each — that's $${annualised} annualised. Open the app right now and ask: would I pay this if I had to re-sign up today?`,
      tag: "Review",
      icon: "🔍",
    });
  } else {
    actions.push({
      title: "Commit to one no-spend day every week",
      detail: `Students who hold one no-spend day per week save $50–$80/month without changing any other habits. Pick your day now, plan meals for it, and block it in your calendar — the structure is what makes it stick.`,
      tag: "Habit",
      icon: "📅",
    });
  }

  return actions.slice(0, 3);
}

function buildRiskRadar(
  goals: GoalRow[],
  recurringCharges: RecurringCharge[],
  totalIncome: number,
  totalSpent: number,
  now: Date
): RiskItem[] {
  const items: RiskItem[] = [];
  const net = totalIncome - totalSpent;

  if (net < 0) {
    items.push({
      title: "Spending exceeds income this month",
      detail: `You're $${Math.abs(net).toFixed(2)} over your income. Every upcoming charge is hitting an already-negative balance — pause optional spending immediately.`,
      daysAway: null,
      riskLevel: "high",
      icon: "🚨",
    });
  }

  for (const goal of goals) {
    if (!goal.deadline) continue;
    const deadlineDate = startOfDay(new Date(goal.deadline));
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) continue;
    const currentAmount = parseFloat(goal.current_amount);
    const targetAmount = parseFloat(goal.target_amount);
    const remaining = targetAmount - currentAmount;
    if (remaining <= 0) continue;
    const progress = currentAmount / targetAmount;

    if (daysLeft <= 14) {
      const weeklyRate = remaining / Math.max(daysLeft / 7, 0.5);
      items.push({
        title: `"${goal.title}" deadline in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        detail: `${goal.emoji} $${remaining.toFixed(2)} still needed. You need $${weeklyRate.toFixed(2)}/week from now — act now or update the deadline.`,
        daysAway: daysLeft,
        riskLevel: daysLeft <= 7 ? "high" : "medium",
        icon: "⏰",
      });
    } else if (daysLeft <= 30 && progress < 0.5) {
      items.push({
        title: `"${goal.title}" is under halfway with ${daysLeft} days left`,
        detail: `Only ${Math.round(progress * 100)}% saved ($${currentAmount.toFixed(2)} of $${targetAmount.toFixed(2)}). At current pace this deadline will be missed.`,
        daysAway: daysLeft,
        riskLevel: "medium",
        icon: "⚠️",
      });
    }
  }

  for (const charge of recurringCharges.slice(0, 2)) {
    if (net < charge.amount * 2) {
      items.push({
        title: `"${charge.label}" is a strain at your current balance`,
        detail: `This $${charge.amount.toFixed(2)} recurring charge is significant against your net of $${net.toFixed(2)}. Consider pausing it until your balance improves.`,
        daysAway: null,
        riskLevel: net < charge.amount ? "high" : "medium",
        icon: "🔄",
      });
    }
  }

  if (items.length === 0 && totalIncome > 0) {
    const bufferPct = Math.round(Math.max(net / totalIncome, 0) * 100);
    items.push({
      title: "No immediate cashflow risks detected",
      detail: `Your income covers spending with a ${bufferPct}% buffer this month. Keep an eye on goal deadlines and recurring costs.`,
      daysAway: null,
      riskLevel: "low",
      icon: "✅",
    });
  }

  return items.slice(0, 4);
}

function buildBehaviorTriggers(transactions: SpendingTx[], now: Date): BehaviorTrigger[] {
  const triggers: BehaviorTrigger[] = [];
  const expenseTx = transactions.filter((tx) => tx.type === "expense");

  // Weekend vs weekday
  const weekendTx = expenseTx.filter((tx) => { const d = new Date(tx.date).getDay(); return d === 0 || d === 6; });
  const weekdayTx = expenseTx.filter((tx) => { const d = new Date(tx.date).getDay(); return d >= 1 && d <= 5; });
  const weekendTotal = weekendTx.reduce((s, t) => s + t.amount, 0);
  const weekdayTotal = weekdayTx.reduce((s, t) => s + t.amount, 0);
  const weekendPerDay = weekendTotal / 2;
  const weekdayPerDay = weekdayTotal / 5;
  if (weekendTx.length >= 3 && weekdayPerDay > 0 && weekendPerDay > weekdayPerDay * 1.5) {
    triggers.push({
      pattern: "Weekend spending spike",
      detail: `You spend ${((weekendPerDay / weekdayPerDay - 1) * 100).toFixed(0)}% more per day on weekends ($${weekendPerDay.toFixed(2)}/day) vs weekdays ($${weekdayPerDay.toFixed(2)}/day). Most of it likely isn't planned.`,
      totalImpact: weekendTotal,
      rule: "Set a weekend cash cap on Friday morning — a fixed amount for Sat+Sun. Once it's gone, it's gone.",
      icon: "📅",
    });
  }

  // Frequent small purchases accumulating
  const smallByCategory: Record<string, number[]> = {};
  for (const tx of expenseTx) {
    if (tx.amount < 20) {
      smallByCategory[tx.category] = smallByCategory[tx.category] || [];
      smallByCategory[tx.category].push(tx.amount);
    }
  }
  const topSmallEntry = Object.entries(smallByCategory)
    .sort(([, a], [, b]) => b.reduce((s, x) => s + x, 0) - a.reduce((s, x) => s + x, 0))[0];
  if (topSmallEntry && topSmallEntry[1].length >= 5) {
    const [cat, amounts] = topSmallEntry;
    const total = amounts.reduce((s, x) => s + x, 0);
    triggers.push({
      pattern: `Frequent small purchases in "${cat}"`,
      detail: `${amounts.length} transactions under $20 in ${cat} added up to $${total.toFixed(2)}. Each one feels harmless — together they're one of your biggest costs.`,
      totalImpact: total,
      rule: "Apply a 3-purchase weekly limit in this category. After the 3rd, wait until next week.",
      icon: "🪙",
    });
  }

  // Month-end spending acceleration
  const lastWeekTx = expenseTx.filter((tx) => {
    const daysAgo = Math.floor((now.getTime() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo <= 7;
  });
  const earlierTx = expenseTx.filter((tx) => {
    const daysAgo = Math.floor((now.getTime() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo > 7 && daysAgo <= 30;
  });
  const lastWeekPerDay = lastWeekTx.reduce((s, t) => s + t.amount, 0) / 7;
  const earlierPerDay = earlierTx.length > 0 ? earlierTx.reduce((s, t) => s + t.amount, 0) / 23 : 0;
  if (lastWeekTx.length >= 3 && earlierPerDay > 0 && lastWeekPerDay > earlierPerDay * 1.4) {
    triggers.push({
      pattern: "Spending accelerates near month-end",
      detail: `Last 7 days: $${lastWeekPerDay.toFixed(2)}/day vs $${earlierPerDay.toFixed(2)}/day earlier — a ${((lastWeekPerDay / earlierPerDay - 1) * 100).toFixed(0)}% spike. Often caused by "I've already blown the budget" thinking.`,
      totalImpact: lastWeekTx.reduce((s, t) => s + t.amount, 0),
      rule: "On the 20th of each month, check remaining budget and set a hard daily cap for the final 10 days.",
      icon: "📆",
    });
  }

  // Single category dominance
  const catTotals: Record<string, number> = {};
  for (const tx of expenseTx) catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  const totalExp = expenseTx.reduce((s, t) => s + t.amount, 0);
  const topEntry = Object.entries(catTotals).sort(([, a], [, b]) => b - a)[0];
  if (topEntry && totalExp > 0 && topEntry[1] / totalExp > 0.45) {
    const [topCat, topTotal] = topEntry;
    const pct = Math.round((topTotal / totalExp) * 100);
    triggers.push({
      pattern: `${topCat} is ${pct}% of all spending`,
      detail: `$${topTotal.toFixed(2)} of your $${totalExp.toFixed(2)} total goes to ${topCat}. One category concentrating this much spend is a fragility risk — one bad week there breaks your whole budget.`,
      totalImpact: topTotal,
      rule: `Set a firm monthly cap for ${topCat}. Treat it as fully spent once you hit it — no exceptions.`,
      icon: "📊",
    });
  }

  return triggers.slice(0, 3);
}

function buildGoalRouteOptimizer(
  goals: GoalRow[],
  weeklySurplus: number,
  now: Date
): GoalAllocation[] {
  if (goals.length === 0 || weeklySurplus <= 0) return [];

  const scored = goals.map((goal) => {
    const currentAmount = parseFloat(goal.current_amount);
    const targetAmount = parseFloat(goal.target_amount);
    const remaining = Math.max(targetAmount - currentAmount, 0);
    const progress = targetAmount > 0 ? currentAmount / targetAmount : 0;
    let urgencyScore = 1;
    let reason = "";

    if (goal.deadline) {
      const deadlineDate = startOfDay(new Date(goal.deadline));
      const weeksLeft = Math.max((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7), 0);
      if (weeksLeft > 0) {
        const weeklyNeeded = remaining / weeksLeft;
        urgencyScore += Math.min(weeklyNeeded / (weeklySurplus + 1), 10);
        urgencyScore += weeksLeft < 4 ? 5 : weeksLeft < 12 ? 2 : 0;
        const wl = Math.ceil(weeksLeft);
        reason = `Needs $${weeklyNeeded.toFixed(2)}/week to hit deadline in ${wl} week${wl === 1 ? "" : "s"}.`;
      } else {
        urgencyScore += 8;
        reason = "Deadline passed — prioritise to catch up.";
      }
    } else {
      urgencyScore += (1 - progress) * 3;
      reason = `${Math.round(progress * 100)}% complete — stay consistent.`;
    }
    if (progress < 0.05) urgencyScore += 2;
    return { goal, urgencyScore, reason };
  });

  const totalScore = scored.reduce((s, g) => s + g.urgencyScore, 0) || 1;
  return scored
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .map((item, i) => {
      const pct = Math.round((item.urgencyScore / totalScore) * 100);
      const recommendedWeekly = Math.round((item.urgencyScore / totalScore) * weeklySurplus * 100) / 100;
      return {
        id: item.goal.id,
        title: item.goal.title,
        emoji: item.goal.emoji,
        recommendedWeekly,
        allocationPercent: pct,
        priority: i + 1,
        reason: item.reason,
      };
    });
}

function buildFallbackReport(
  userName: string,
  totalIncome: number,
  totalSpent: number,
  nextActions: NextAction[],
  budgetTargets: BudgetTarget[],
  goalForecasts: GoalForecast[]
): RecommendationReport {
  const topBudget = budgetTargets[0];
  const goal = goalForecasts[0];
  const net = totalIncome - totalSpent;

  return {
    summary:
      net >= 0
        ? `${userName}, you are spending below or near your income, which gives you room to plan intentionally.`
        : `${userName}, your recent spending is ahead of your income, so the fastest win is tightening your top expense areas.`,
    budgetingTips: [
      topBudget
        ? `Bring ${topBudget.displayName} down from $${topBudget.current.toFixed(2)} toward $${topBudget.target.toFixed(2)} next cycle.`
        : "Review your top expense category once a week and set a limit before spending.",
      `Keep total monthly spending under $${Math.max(totalIncome * 0.9, 0).toFixed(2)} to leave room for savings.`,
      "Check your transactions mid-week so course corrections happen before the month ends.",
    ],
    savingsStrategies: [
      goal?.weeklyNeeded
        ? `Set aside about $${goal.weeklyNeeded.toFixed(2)} each week to stay on pace for ${goal.title}.`
        : "Move a fixed amount into savings each week right after income hits.",
      "Use low-spend days after your biggest spending category spikes.",
      "Route part of any extra income into your highest-priority goal immediately.",
    ],
    habitChanges: nextActions.slice(0, 3).map((a) => a.detail),
    answer: nextActions[0]?.detail || "Focus on your top spending category first, then review your progress weekly.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === "string" ? body.question : "";
    const widgetsOnly = body?.widgetsOnly === true;

    const [transactions, goals] = await Promise.all([
      query(
        `SELECT type, category, amount, description, date
         FROM transactions
         WHERE user_id = $1 AND date >= NOW() - INTERVAL '90 days'
         ORDER BY date DESC`,
        [session.userId]
      ),
      query(
        `SELECT id, title, emoji, target_amount, current_amount, deadline
         FROM savings_goals
         WHERE user_id = $1 AND is_completed = FALSE
         ORDER BY created_at DESC`,
        [session.userId]
      ),
    ]);

    const typedTx: SpendingTx[] = transactions.map((t: any) => ({
      type: t.type,
      category: t.category,
      amount: parseFloat(t.amount),
      description: t.description,
      date: String(t.date),
    }));

    const now = startOfDay(new Date());
    const last30Start = addDays(now, -30);
    const prev30Start = addDays(now, -60);

    const recentTx = typedTx.filter((tx) => new Date(tx.date) >= last30Start);
    const previousTx = typedTx.filter((tx) => {
      const date = new Date(tx.date);
      return date >= prev30Start && date < last30Start;
    });

    const totalSpent = sumByType(recentTx, "expense");
    const totalIncome = sumByType(recentTx, "income");
    const prevSpent = sumByType(previousTx, "expense");
    const prevIncome = sumByType(previousTx, "income");

    const categoryBreakdown = groupExpensesByCategory(recentTx);
    const previousCategoryBreakdown = groupExpensesByCategory(previousTx);

    const anomalies: InsightCard[] = [];
    for (const [category, current] of Object.entries(categoryBreakdown)) {
      const previous = previousCategoryBreakdown[category] || 0;
      if (previous > 0 && current >= previous * 1.35 && current - previous >= 20) {
        const label = categoryLabel(category);
        anomalies.push({
          title: `${label} jumped sharply`,
          detail: `${label} spending rose from $${previous.toFixed(2)} to $${current.toFixed(2)} in the last 30 days.`,
          severity: current >= previous * 1.75 ? "high" : "medium",
        });
      }
    }

    const expenseTransactions = recentTx.filter((tx) => tx.type === "expense");
    const avgExpense = expenseTransactions.length ? totalSpent / expenseTransactions.length : 0;
    const largestExpense = [...expenseTransactions].sort((a, b) => b.amount - a.amount)[0];
    if (largestExpense && largestExpense.amount >= Math.max(avgExpense * 1.8, 30)) {
      anomalies.push({
        title: "One transaction was much larger than usual",
        detail: `${largestExpense.description || largestExpense.category} came in at $${largestExpense.amount.toFixed(2)}.`,
        severity: "medium",
      });
    }
    if (totalIncome > 0 && totalSpent > totalIncome) {
      anomalies.push({
        title: "Spending is ahead of income",
        detail: `You spent $${(totalSpent - totalIncome).toFixed(2)} more than you brought in over the last 30 days.`,
        severity: "high",
      });
    }

    const budgetTargets: BudgetTarget[] = Object.entries(categoryBreakdown)
      .map(([category, current]) => {
        const previous = previousCategoryBreakdown[category] || current;
        const baseline = (current + previous) / 2;
        const target = Math.max(Math.round(baseline * 0.9 * 100) / 100, 10);
        const displayName = resolveDisplayName(category, recentTx);
        return { category, displayName, current: Math.round(current * 100) / 100, target };
      })
      .sort((a, b) => b.current - a.current)
      .slice(0, 3);

    const recurringCharges = findRecurringCharges(typedTx);

    const monthlySavingsPace = Math.max(totalIncome - totalSpent, 0);
    const weeklySavingsPace = monthlySavingsPace / 4.3;
    const goalForecasts: GoalForecast[] = (goals as GoalRow[]).slice(0, 3).map((goal) => {
      const currentAmount = parseFloat(goal.current_amount);
      const targetAmount = parseFloat(goal.target_amount);
      const remaining = Math.max(targetAmount - currentAmount, 0);

      let projectedWeeks: number | null = null;
      if (weeklySavingsPace > 0 && remaining > 0) {
        projectedWeeks = Math.ceil(remaining / weeklySavingsPace);
      }

      let weeklyNeeded: number | null = null;
      let status = weeklySavingsPace > 0 ? "On pace" : "Needs a savings pace";
      if (goal.deadline) {
        const deadlineDate = startOfDay(new Date(goal.deadline));
        const weeksLeft = Math.max(Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)), 0);
        weeklyNeeded = weeksLeft > 0 ? remaining / weeksLeft : remaining;
        if (weeklyNeeded > 0 && weeklySavingsPace <= 0) {
          status = "Behind pace";
        } else if (weeklyNeeded && weeklySavingsPace < weeklyNeeded) {
          status = "Behind pace";
        }
      }

      return {
        id: goal.id,
        title: goal.title,
        emoji: goal.emoji,
        currentAmount,
        targetAmount,
        projectedWeeks,
        weeklyNeeded: weeklyNeeded ? Math.round(weeklyNeeded * 100) / 100 : null,
        status,
      };
    });

    const monthChanges = [
      `Spending ${totalSpent >= prevSpent ? "rose" : "fell"} by $${Math.abs(totalSpent - prevSpent).toFixed(2)} versus the previous 30 days.`,
      `Income ${totalIncome >= prevIncome ? "rose" : "fell"} by $${Math.abs(totalIncome - prevIncome).toFixed(2)} versus the previous 30 days.`,
    ];

    const nextActions = buildNextActions(budgetTargets, recurringCharges, goalForecasts, totalIncome, totalSpent);
    const riskItems = buildRiskRadar(goals as GoalRow[], recurringCharges, totalIncome, totalSpent, now);
    const behaviorTriggers = buildBehaviorTriggers(recentTx, now);
    const goalAllocations = buildGoalRouteOptimizer(goals as GoalRow[], weeklySavingsPace, now);

    let report: RecommendationReport;
    if (widgetsOnly) {
      report = buildFallbackReport(session.name, totalIncome, totalSpent, nextActions, budgetTargets, goalForecasts);
    } else if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30 * 1000,
      });

      console.log("Calling OpenAI for insights...", {
        userName: session.name,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      });

      try {
        report = await generateRecommendationReport(
          openai,
          {
            userName: session.name,
            totalIncome,
            totalSpent,
            net: totalIncome - totalSpent,
            categoryBreakdown,
            recentTransactions: recentTx,
          },
          question || "Give me a recommendation plan based on my recent spending"
        );
        console.log("OpenAI response received successfully");
      } catch (openAiError: any) {
        console.error("Insights AI fallback:", openAiError?.message || openAiError);
        report = buildFallbackReport(session.name, totalIncome, totalSpent, nextActions, budgetTargets, goalForecasts);
      }
    } else {
      report = buildFallbackReport(session.name, totalIncome, totalSpent, nextActions, budgetTargets, goalForecasts);
    }

    return NextResponse.json({
      report,
      snapshot: {
        totalIncome,
        totalSpent,
        net: totalIncome - totalSpent,
        categories: categoryBreakdown,
      },
      insights: {
        anomalies: anomalies.slice(0, 3),
        budgetTargets,
        recurringCharges,
        goalForecasts,
        nextActions,
        monthChanges,
        riskItems,
        behaviorTriggers,
        goalAllocations,
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
