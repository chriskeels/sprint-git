"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import styles from "./InsightPanels.module.css";

type GoalAllocation = {
  id: string;
  title: string;
  emoji: string;
  recommendedWeekly: number;
  allocationPercent: number;
  priority: number;
  reason: string;
};

type Payload = {
  insights?: {
    goalAllocations?: GoalAllocation[];
  };
};

export default function GoalRoutePanel() {
  const [items, setItems] = useState<GoalAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widgetsOnly: true }),
        });
        const data: Payload = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setItems(data?.insights?.goalAllocations ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>Goal Route Optimizer</h3>
        <span>Weekly surplus split</span>
      </div>

      {loading ? (
        <div className={styles.empty}>Optimizing your goal route...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>Need active goals and positive surplus to optimize.</div>
      ) : (
        <div className={styles.stack}>
          {items.map((item) => (
            <div key={item.id} className={styles.rowCard}>
              <div className={styles.rowTop}>
                <strong>{item.emoji} {item.title}</strong>
                <span className={styles.softTag}>#{item.priority}</span>
              </div>
              <div className={styles.progressWrap}>
                <div className={styles.progressBar} style={{ width: `${item.allocationPercent}%` }} />
              </div>
              <p>{item.allocationPercent}% • {formatCurrency(item.recommendedWeekly)}/week</p>
              <small>{item.reason}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
