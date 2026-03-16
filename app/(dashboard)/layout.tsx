import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/dashboard/Sidebar";
import styles from "./layout.module.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div className={styles.shell}>
      <Sidebar user={session} />
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
