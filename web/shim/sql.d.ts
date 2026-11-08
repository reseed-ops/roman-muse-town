// The Postgres migrations are imported as text (Bun `with { type: "text" }`).
declare module "*.sql" {
  const text: string;
  export default text;
}
