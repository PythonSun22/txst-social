import Image from "next/image";
import AuthForm from "@/components/auth/AuthForm";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <section className={styles.loginPage} aria-label="TXST Lynx account">
      <div className={styles.card}>
        <header className={styles.brand}>
          <h1 className="sr-only">TXST Lynx</h1>
          <Image
            className={styles.logo}
            src="/images/logo.png"
            alt=""
            width={2172}
            height={724}
            sizes="(max-width: 600px) 110vw, 610px"
            priority
          />
        </header>
        <AuthForm />
      </div>
    </section>
  );
}
