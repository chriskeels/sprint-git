import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyPassword, signToken, createAuthCookie } from "@/lib/auth";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const user = await queryOne<User>(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (!user || !(await verifyPassword(password, user.password_hash)))
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      success: true,
    });
    response.cookies.set(createAuthCookie(token));
    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
