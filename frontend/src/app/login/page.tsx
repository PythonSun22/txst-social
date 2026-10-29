import AuthForm from "@/components/auth/AuthForm";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <section className={styles.loginPage}>
      <div className={styles.card}>
        <h1>Account</h1>
        <AuthForm />
      </div>
    </section>
  );
}
