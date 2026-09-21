/**
 * PLACEHOLDER. Replace this whole file with generated types once your schema
 * exists in Supabase Project B (README, step "Generate types"):
 *
 *   npx supabase@2 gen types typescript --project-id yzppfufqaekgaxcrsqxp --schema <app> > lib/database.types.ts
 *
 * Until then the `Database` type declares your schema with no tables, which is
 * enough for `createClient<Database, Schema>` to type-check and for the health
 * route to run. Every query you write against a real table needs the real file.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type EmptySchema = {
  Tables: Record<string, never>;
  Views: Record<string, never>;
  Functions: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
};

/**
 * `[schema: string]` stands in for the one real key the generated file will
 * have (for example `hoops: { Tables: { sessions: ... } }`).
 */
export type Database = {
  [schema: string]: EmptySchema;
};
