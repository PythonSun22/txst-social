export default async function Home() {
  const response = await fetch("http://127.0.0.1:8000/health");
  const data = await response.json();

  return (
    <main>
      <h1>TXST Social </h1>
      <p>Backend Status: {data.status}</p>
    </main>
  );
}