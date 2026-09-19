import styles from "./page.module.css";

/**
 * Public face of the licensing server. Deliberately shows nothing about any
 * licence: management happens in WHMCS, and this page is only proof of life.
 */
export default function Home() {
  return (
    <main className={styles.card}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`${styles.logo} ${styles.logoLight}`} src="/logo-on-light.svg" alt="ShrotiHost" width={180} height={36} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`${styles.logo} ${styles.logoDark}`} src="/logo-on-dark.svg" alt="" aria-hidden="true" width={180} height={36} />
      <h1 className={styles.title}>Licensing Server</h1>
      <p className={styles.lede}>
        Activation, signed entitlements and updates for ShrotiHost WHMCS modules.
      </p>
      <span className={styles.status}><span className={styles.dot} aria-hidden="true" />Operational</span>
      <p className={styles.foot}>
        Manage your licences in the <a href="https://portal.shrotihost.in/clientarea.php">ShrotiHost client area</a>.
      </p>
    </main>
  );
}
