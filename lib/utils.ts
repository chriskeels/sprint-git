export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function getMonthName(monthIndex: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(2024, monthIndex)
  );
}

export const CATEGORIES = {
  expense: [
    { value: "food", label: "Food & Drinks", emoji: "🍔" },
    { value: "transport", label: "Transport", emoji: "🚌" },
    { value: "clothes", label: "Clothes", emoji: "👟" },
    { value: "subscriptions", label: "Subscriptions", emoji: "📱" },
    { value: "entertainment", label: "Entertainment", emoji: "🎮" },
    { value: "school", label: "School", emoji: "📚" },
    { value: "personal", label: "Personal Care", emoji: "💆" },
    { value: "other", label: "Other", emoji: "💸" },
  ],
  income: [
    { value: "job", label: "Job / Work", emoji: "💼" },
    { value: "allowance", label: "Allowance", emoji: "🏠" },
    { value: "gift", label: "Gift", emoji: "🎁" },
    { value: "freelance", label: "Freelance", emoji: "💻" },
    { value: "other", label: "Other", emoji: "💰" },
  ],
};

export function getCategoryEmoji(category: string): string {
  const all = [...CATEGORIES.expense, ...CATEGORIES.income];
  return all.find((c) => c.value === category)?.emoji ?? "💸";
}

export function getCategoryLabel(category: string): string {
  const all = [...CATEGORIES.expense, ...CATEGORIES.income];
  return all.find((c) => c.value === category)?.label ?? category;
}
