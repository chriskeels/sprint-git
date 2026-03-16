import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await queryOne(
    "SELECT id, name, email, role, monthly_budget, created_at FROM users WHERE id = $1",
    [session.userId]
  );
  return NextResponse.json({ user });
}
