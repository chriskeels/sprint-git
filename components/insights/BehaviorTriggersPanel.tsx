"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import styles from "./InsightPanels.module.css";

type BehaviorTrigger = {
  pattern: string;
  detail: string;
  totalImpact: number;
  rule: string;
  icon: string;
};

type Payload = {
  insights?: {
    behaviorTriggers?: BehaviorTrigger[];
  };
};

export default function BehaviorTriggersPanel() {
  const [items, setItems] = useState<BehaviorTrigger[]>([]);
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
          setItems(data?.insights?.behaviorTriggers ?? []);
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
        <h3>Behavioral Trigger Detector</h3>
        <span>Spend pattern analysis</span>
      </div>

      {loading ? (
        <div className={styles.empty}>Detecting behavior triggers...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>Not enough data to detect strong patterns yet.</div>
      ) : (
        <div className={styles.stack}>
          {items.map((item, i) => (
            <div key={i} className={styles.rowCard}>
              <div className={styles.rowTop}>
                <strong>{item.icon} {item.pattern}</strong>
                <span className={styles.softTag}>{formatCurrency(item.totalImpact)} impact</span>
              </div>
              <p>{item.detail}</p>
              <small><span>💡 Rule:</span> {item.rule}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
