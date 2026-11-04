// Bun imports a .sql file as its text with `with { type: "text" }`, which
// is how the Postgres migrations travel inside the web server bundle.
declare module "*.sql" {
  const text: string;
  export default text;
}
