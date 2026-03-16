import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { hashPassword, signToken, createAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role = "student" } = await req.json();

    if (!name || !email || !password)
      return NextResponse.json({ error: "All fields required" }, { status: 400 });

    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
    if (existing)
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const password_hash = await hashPassword(password);
    const [user] = await query<{ id: string; name: string; email: string; role: string }>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, password_hash, role]
    );

    await query(`INSERT INTO streaks (user_id) VALUES ($1)`, [user.id]);

    const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
    const response = NextResponse.json({ user, success: true }, { status: 201 });
    response.cookies.set(createAuthCookie(token));
    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
