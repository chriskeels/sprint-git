import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { current_amount, title, target_amount, emoji, deadline } = await req.json();
  const normalizedDeadline = normalizeOptionalDate(deadline);

  const goal = await queryOne(
    `UPDATE savings_goals SET
       current_amount = COALESCE($1, current_amount),
       title = COALESCE($2, title),
       target_amount = COALESCE($3, target_amount),
       emoji = COALESCE($4, emoji),
       deadline = COALESCE($5, deadline),
       is_completed = CASE WHEN COALESCE($1, current_amount) >= target_amount THEN TRUE ELSE FALSE END,
       updated_at = NOW()
     WHERE id = $6 AND user_id = $7 RETURNING *`,
    [current_amount, title, target_amount, emoji, normalizedDeadline, id, session.userId]
  );

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ goal });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await queryOne(
    "SELECT id FROM savings_goals WHERE id = $1 AND user_id = $2",
    [id, session.userId]
  );
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await queryOne("DELETE FROM savings_goals WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
