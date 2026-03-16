import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await queryOne(
    "SELECT id FROM transactions WHERE id = $1 AND user_id = $2",
    [id, session.userId]
  );
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await query("DELETE FROM transactions WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { amount, category, description, date } = await req.json();

  const transaction = await queryOne(
    `UPDATE transactions SET
       amount = COALESCE($1, amount),
       category = COALESCE($2, category),
       description = COALESCE($3, description),
       date = COALESCE($4, date)
     WHERE id = $5 AND user_id = $6 RETURNING *`,
    [amount, category, description, date, id, session.userId]
  );

  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ transaction });
}
