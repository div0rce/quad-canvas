// @quad/db — repository contract (T6 skeleton). INTERFACE ONLY — no business logic, no raw SQL.
// Concrete Prisma-backed implementations land with their feature milestones (DB writes go
// through repositories only; see docs/DATABASE.md, BACKEND.md).
import type { Tenant } from '../client.js';

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  list(): Promise<readonly Tenant[]>;
}
