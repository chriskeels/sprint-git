import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await query(
    "SELECT * FROM savings_goals WHERE user_id = $1 ORDER BY created_at DESC",
    [session.userId]
  );
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, target_amount, emoji = "🎯", deadline } = await req.json();
  const normalizedDeadline = normalizeOptionalDate(deadline);
  if (!title || !target_amount)
    return NextResponse.json({ error: "title and target_amount required" }, { status: 400 });

  const goal = await queryOne(
    `INSERT INTO savings_goals (user_id, title, target_amount, emoji, deadline)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [session.userId, title, target_amount, emoji, normalizedDeadline]
  );
  return NextResponse.json({ goal }, { status: 201 });
}
