import AuthForm from "@/components/auth/AuthForm";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <>
      <div className={styles.background} aria-hidden="true" />

      <section className={styles.loginPage}>
        <div className={styles.card}>
          <h1>Account</h1>
          <AuthForm />
        </div>
      </section>
    </>
  );
}