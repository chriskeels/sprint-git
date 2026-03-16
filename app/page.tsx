import Link from "next/link";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <main className={styles.main}>
      <div className={styles.noise} />
      <nav className={styles.nav}>
        <div className={styles.logo}>Stack<span>Up</span></div>
        <div className={styles.navLinks}>
          <Link href="/auth/login" className={styles.loginLink}>Log in</Link>
          <Link href="/auth/register" className={styles.ctaBtn}>Get Started Free</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.badge}>💸 Built for Philly Students</div>
        <h1 className={styles.headline}>
          Your Money,<br /><span className={styles.accent}>Leveled Up</span>
        </h1>
        <p className={styles.subtext}>
          See where your money goes. Hit savings goals. Build habits that last.
          No boring lectures — just real tools that actually help.
        </p>
        <div className={styles.heroCtas}>
          <Link href="/auth/register" className={styles.primaryBtn}>
            Start Stacking Free →
          </Link>
          <Link href="/auth/login" className={styles.ghostBtn}>
            I have an account
          </Link>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.stat}><span>💳</span><p>Track spending</p></div>
          <div className={styles.stat}><span>🎯</span><p>Save smarter</p></div>
          <div className={styles.stat}><span>🤖</span><p>AI insights</p></div>
          <div className={styles.stat}><span>🔥</span><p>Build streaks</p></div>
        </div>
      </section>

      <section className={styles.features}>
        {[
          { emoji: "👀", title: "See It To Believe It", desc: "Visual breakdowns of exactly where your money goes. Food? Clothes? Rides? Now you know." },
          { emoji: "🎮", title: "Save Like a Game", desc: "Set goals, track progress bars, earn streaks. Saving stops feeling boring — it feels like winning." },
          { emoji: "🤖", title: "AI That Gets You", desc: "Ask StackUp anything. Get personalized tips based on YOUR spending, not some textbook example." },
          { emoji: "⏸️", title: "Pause Before You Spend", desc: "Quick prompts help you think twice before buying. That pause alone saves real money." },
        ].map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <div className={styles.featureEmoji}>{f.emoji}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>StackUp © 2025 · Built for Philadelphia students 🦅</p>
      </footer>
    </main>
  );
}
