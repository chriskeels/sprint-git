"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./Sidebar.module.css";

interface Props {
  user: { name: string; email: string; role: string };
}

const NAV = [
  { href: "/dashboard", icon: "⚡", label: "Dashboard" },
  { href: "/transactions", icon: "💳", label: "Transactions" },
  { href: "/savings", icon: "🎯", label: "Savings Goals" },
  { href: "/insights", icon: "🤖", label: "AI Insights" },
];

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>Stack<span>Up</span></div>

      <nav className={styles.nav}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navItem} ${pathname === item.href ? styles.active : ""}`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.bottom}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user.name}</p>
            <p className={styles.userRole}>{user.role === "mentor" ? "💼 Mentor" : "🎓 Student"}</p>
          </div>
        </div>
        <button onClick={logout} className={styles.logout}>Sign out</button>
      </div>
    </aside>
  );
}
