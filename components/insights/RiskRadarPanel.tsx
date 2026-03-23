"use client";

import { useEffect, useState } from "react";
import styles from "./InsightPanels.module.css";

type RiskItem = {
  title: string;
  detail: string;
  daysAway: number | null;
  riskLevel: "high" | "medium" | "low";
  icon: string;
};

type Payload = {
  insights?: {
    riskItems?: RiskItem[];
  };
};

export default function RiskRadarPanel() {
  const [items, setItems] = useState<RiskItem[]>([]);
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
          setItems(data?.insights?.riskItems ?? []);
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
        <h3>Cashflow Risk Radar</h3>
        <span>Upcoming pressures</span>
      </div>

      {loading ? (
        <div className={styles.empty}>Scanning risk signals...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>No immediate risks detected.</div>
      ) : (
        <div className={styles.stack}>
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className={styles.rowCard}>
              <div className={styles.rowTop}>
                <strong>{item.icon} {item.title}</strong>
                <span className={`${styles.pill} ${styles[item.riskLevel]}`}>{item.riskLevel}</span>
              </div>
              <p>{item.detail}</p>
              {item.daysAway !== null && (
                <small>{item.daysAway} day{item.daysAway === 1 ? "" : "s"} away</small>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
