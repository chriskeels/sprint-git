import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const type = searchParams.get("type");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  let whereClause = "WHERE user_id = $1";
  const params: unknown[] = [session.userId];
  let paramIdx = 2;

  if (type) {
    whereClause += ` AND type = $${paramIdx++}`;
    params.push(type);
  }
  if (month && year) {
    whereClause += ` AND EXTRACT(MONTH FROM date) = $${paramIdx++} AND EXTRACT(YEAR FROM date) = $${paramIdx++}`;
    params.push(parseInt(month), parseInt(year));
  }

  const transactions = await query(
    `SELECT * FROM transactions ${whereClause} ORDER BY date DESC, created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  );

  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, type, category, description, date } = await req.json();
  if (!amount || !type || !category)
    return NextResponse.json({ error: "amount, type, category required" }, { status: 400 });

  const transaction = await queryOne(
    `INSERT INTO transactions (user_id, amount, type, category, description, date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [session.userId, Math.abs(amount), type, category, description ?? "", date ?? new Date()]
  );

  // Update streak
  await query(
    `INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date, total_days)
     VALUES ($1, 1, 1, CURRENT_DATE, 1)
     ON CONFLICT (user_id) DO UPDATE SET
       current_streak = CASE
         WHEN streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN streaks.current_streak + 1
         WHEN streaks.last_activity_date = CURRENT_DATE THEN streaks.current_streak
         ELSE 1
       END,
       longest_streak = GREATEST(streaks.longest_streak,
         CASE WHEN streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day'
              THEN streaks.current_streak + 1 ELSE 1 END),
       last_activity_date = CURRENT_DATE,
       total_days = CASE WHEN streaks.last_activity_date < CURRENT_DATE
                         THEN streaks.total_days + 1 ELSE streaks.total_days END`,
    [session.userId]
  );

  return NextResponse.json({ transaction }, { status: 201 });
}
