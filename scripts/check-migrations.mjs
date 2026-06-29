// Quad — migration rollback-safety gate (LG-10 support). Forward migrations must be ADDITIVE so the
// previous app version keeps working against the new schema — then an app rollback needs no DB
// migration rollback (the core contingency property). This fails if any migration STATEMENT removes
// or renames a table/column the prior app reads, destroys data, or adds a NOT NULL column with no
// default (which breaks the prior app's inserts and any existing rows).
//
// Widening changes are allowed (DROP NOT NULL, DROP CONSTRAINT/DEFAULT/INDEX, ADD COLUMN nullable or
// with a default, CREATE TABLE/INDEX, ...). A genuinely destructive change must be split into an
// expand/contract sequence across releases instead.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(here, '..', 'packages', 'db', 'prisma', 'migrations');

// Each predicate runs against ONE statement (semicolon-delimited), so patterns never span statements.
function statementViolations(stmt) {
  const out = [];
  if (/\bDROP\s+TABLE\b/i.test(stmt)) out.push('DROP TABLE');
  if (/\bDROP\s+COLUMN\b/i.test(stmt)) out.push('DROP COLUMN');
  // Postgres lets COLUMN be omitted: `ALTER TABLE t DROP "col"`. A quote right after DROP is a column
  // drop; DROP CONSTRAINT/DEFAULT/NOT NULL/INDEX all have a keyword before the name, so they don't match.
  if (/\bDROP\s+"/i.test(stmt)) out.push('DROP column (shorthand)');
  if (/\bRENAME\s+TO\b/i.test(stmt)) out.push('RENAME TABLE');
  if (/\bRENAME\s+COLUMN\b/i.test(stmt)) out.push('RENAME COLUMN');
  // `TRUNCATE` is also a valid CREATE TRIGGER event. Only a statement whose command is TRUNCATE is
  // destructive; `CREATE TRIGGER ... BEFORE TRUNCATE` is an additive integrity guard.
  if (/^\s*TRUNCATE\b/i.test(stmt)) out.push('TRUNCATE');
  if (/\bDELETE\s+FROM\b/i.test(stmt)) out.push('DELETE FROM');
  if (/\bADD\s+COLUMN\b/i.test(stmt) && /\bNOT\s+NULL\b/i.test(stmt) && !/\bDEFAULT\b/i.test(stmt)) {
    out.push('ADD COLUMN NOT NULL without DEFAULT');
  }
  return out;
}

let dirs;
try {
  dirs = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
} catch (err) {
  console.error(`Cannot read migrations directory (${MIGRATIONS}): ${err.message}`);
  process.exit(1);
}

const violations = [];
for (const dir of dirs) {
  let sql;
  try {
    sql = readFileSync(path.join(MIGRATIONS, dir, 'migration.sql'), 'utf8');
  } catch (err) {
    // Fail closed: an unreadable migration must stop the gate, not be silently skipped.
    console.error(`Cannot read migration '${dir}/migration.sql': ${err.message}`);
    process.exit(1);
  }
  // Strip line comments so prose mentioning a keyword doesn't trip the check, then split into statements.
  const cleaned = sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
  for (const stmt of cleaned.split(';')) {
    for (const what of statementViolations(stmt)) violations.push(`${dir}: ${what}`);
  }
}

if (violations.length > 0) {
  console.error('Non-additive (rollback-unsafe) migration statement(s):');
  for (const v of violations) console.error(`  - ${v}`);
  console.error('\nForward migrations must be additive so the previous app version keeps working');
  console.error('(an app rollback then needs no DB rollback). Use an expand/contract sequence instead.');
  process.exit(1);
}

console.log(`Checked ${dirs.length} migration(s): all additive (rollback-safe).`);
