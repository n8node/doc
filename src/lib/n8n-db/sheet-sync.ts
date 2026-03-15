import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { createN8nDbClient } from "./client";
import type { N8nDbTarget } from "./client";

const ROLE_PREFIX = "n8n_sheet_";
const SCHEMA_NAME = "n8n";

/** Транслитерация кириллицы в латиницу для человекочитаемых имён колонок в PG */
const RU_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh", З: "Z",
  И: "I", Й: "J", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R",
  С: "S", Т: "T", У: "U", Ф: "F", Х: "H", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sch",
  Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "Yu", Я: "Ya",
};

function transliterate(text: string): string {
  return text
    .split("")
    .map((ch) => RU_TO_LAT[ch] ?? ch)
    .join("");
}

/** Человекочитаемое имя для PG: транслитерация + только буквы/цифры/подчёркивания, уникальность через суффикс */
function toPgColumnName(displayName: string, columnId: string, used: Set<string>): string {
  const transliterated = transliterate(displayName);
  const base = transliterated
    .replace(/[^a-zA-Z0-9_\s]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32)
    .toLowerCase();
  let candidate = base || `column_${columnId.slice(-8)}`;
  if (!/^[a-z]/.test(candidate)) candidate = `c_${candidate}`.slice(0, 32);
  let name = candidate;
  let n = 1;
  while (used.has(name)) {
    name = `${candidate.slice(0, 28)}_${n}`;
    n += 1;
  }
  used.add(name);
  return name;
}

/** По списку колонок листа возвращает массив имён для PG (по порядку, уникальные, человекочитаемые) */
function getSafeColumnNames(columns: Array<{ id: string; order: number; name: string }>): string[] {
  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const used = new Set<string>();
  return sorted.map((c) => toPgColumnName(c.name, c.id, used));
}

function sanitizeIdent(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
}

export interface SheetForSync {
  id: string;
  columns: Array<{ id: string; order: number; name: string }>;
  rows: Array<{ rowIndex: number; cells: Record<string, string | null> }>;
}

export interface CreateN8nTableConnectionResult {
  dbRoleName: string;
  dbPassword: string;
  tableName: string;
}

/**
 * Create n8n PostgreSQL table for a sheet: schema, role, table (row_index + one column per sheet column), grant SELECT/INSERT/UPDATE/DELETE, push data.
 * connectionId must be unique per connection (e.g. cuid) so multiple connections per sheet get distinct role/table names.
 */
export async function createN8nTableConnection(
  sheet: SheetForSync,
  target: N8nDbTarget = "DEFAULT",
  connectionId: string
): Promise<CreateN8nTableConnectionResult> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }

  const shortId = sanitizeIdent(connectionId).slice(0, 24) || sanitizeIdent(sheet.id).slice(0, 24);
  const dbRoleName = `${ROLE_PREFIX}${shortId}`;
  const tableName = `sheet_${shortId}`;
  const password = randomBytes(24).toString("base64url");

  await client.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);
    const escapedPwd = password.replace(/'/g, "''");
    await client.query(`CREATE ROLE "${dbRoleName}" WITH LOGIN PASSWORD '${escapedPwd}'`);
    await client.query(`ALTER ROLE "${dbRoleName}" SET search_path = '${SCHEMA_NAME}','public'`);
    await client.query(`GRANT USAGE ON SCHEMA ${SCHEMA_NAME} TO "${dbRoleName}"`);

    const cols = sheet.columns.sort((a, b) => a.order - b.order);
    const safeColNames = getSafeColumnNames(cols);
    const colDefs = safeColNames.map((name) => `"${name}" TEXT`).join(", ");
    const fullTableName = `${SCHEMA_NAME}.${tableName}`;
    await client.query(`
      CREATE TABLE ${fullTableName} (
        row_index INTEGER NOT NULL PRIMARY KEY,
        ${colDefs}
      )
    `);

    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${fullTableName} TO "${dbRoleName}"`);

    if (sheet.rows.length > 0) {
      for (const row of sheet.rows) {
        const values = safeColNames.map((cn, i) => {
          const colId = cols[i].id;
          const v = row.cells[colId] ?? null;
          return v;
        });
        const placeholders = safeColNames.map((_, i) => `$${i + 2}`).join(", ");
        await client.query(
          `INSERT INTO ${fullTableName} (row_index, ${safeColNames.map((n) => `"${n}"`).join(", ")}) VALUES ($1, ${placeholders})`,
          [row.rowIndex, ...values]
        );
      }
    }

    return { dbRoleName, dbPassword: password, tableName };
  } finally {
    await client.end();
  }
}

/**
 * Revoke n8n table connection: drop role, drop table.
 */
export async function revokeN8nTableConnection(
  dbRoleName: string,
  tableName: string,
  target: N8nDbTarget = "DEFAULT"
): Promise<void> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }
  await client.connect();
  try {
    const fullTableName = `${SCHEMA_NAME}.${tableName}`;
    await client.query(`DROP TABLE IF EXISTS ${fullTableName}`);
    await client.query(`DROP ROLE IF EXISTS "${dbRoleName}"`);
  } finally {
    await client.end();
  }
}

/**
 * Push sheet data to n8n-db table (add missing columns if needed, then full replace: truncate + insert).
 */
export async function pushSheetToN8n(
  sheet: SheetForSync,
  tableName: string,
  target: N8nDbTarget = "DEFAULT"
): Promise<void> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }
  const fullTableName = `${SCHEMA_NAME}.${tableName}`;
  await client.connect();
  try {
    const cols = sheet.columns.sort((a, b) => a.order - b.order);
    const safeColNames = getSafeColumnNames(cols);
    const existingRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA_NAME, tableName]
    );
    const existingCols = new Set((existingRes.rows as { column_name: string }[]).map((r) => r.column_name));
    for (const name of safeColNames) {
      if (!existingCols.has(name)) {
        await client.query(`ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${name}" TEXT`);
      }
    }
    await client.query(`TRUNCATE TABLE ${fullTableName}`);
    const colList = safeColNames.map((n) => `"${n}"`).join(", ");
    for (const row of sheet.rows) {
      const values = safeColNames.map((_, i) => row.cells[cols[i].id] ?? null);
      const placeholders = values.map((_, i) => `$${i + 2}`).join(", ");
      await client.query(
        `INSERT INTO ${fullTableName} (row_index, ${colList}) VALUES ($1, ${placeholders})`,
        [row.rowIndex, ...values]
      );
    }
  } finally {
    await client.end();
  }
}

/**
 * Pull data from n8n-db table into sheet rows (read-only snapshot; caller merges into app DB).
 */
export async function pullSheetFromN8n(
  tableName: string,
  columnIds: string[],
  target: N8nDbTarget = "DEFAULT"
): Promise<Array<{ rowIndex: number; cells: Record<string, string | null> }>> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }
  const fullTableName = `${SCHEMA_NAME}.${tableName}`;
  await client.connect();
  try {
    const res = await client.query(`SELECT * FROM ${fullTableName} ORDER BY row_index`);
    const rows: Array<{ rowIndex: number; cells: Record<string, string | null> }> = [];
    const dataColNames = res.fields?.filter((f) => f.name !== "row_index").map((f) => f.name) ?? [];
    for (const r of res.rows) {
      const row = r as Record<string, unknown>;
      const rowIndex = Number(row.row_index);
      if (!Number.isFinite(rowIndex)) continue;
      const cells: Record<string, string | null> = {};
      dataColNames.forEach((name, i) => {
        const colId = columnIds[i];
        if (colId != null) {
          const v = row[name];
          cells[colId] = v == null ? null : String(v);
        }
      });
      rows.push({ rowIndex, cells });
    }
    return rows;
  } finally {
    await client.end();
  }
}

/**
 * Переименовать колонку в таблице n8n-db (после переименования в приложении).
 * columnIndex — индекс колонки в sheet.columns (по order), newDisplayName — новое отображаемое имя.
 */
export async function renameSheetColumnInN8n(
  tableName: string,
  columnIndex: number,
  newDisplayName: string,
  columns: Array<{ id: string; order: number; name: string }>,
  target: N8nDbTarget = "DEFAULT"
): Promise<void> {
  const client = createN8nDbClient(target);
  if (!client) {
    throw new Error(target === "RF" ? "N8N_DB_URL_RF не настроен" : "N8N_DB_URL не настроен");
  }
  const fullTableName = `${SCHEMA_NAME}.${tableName}`;
  await client.connect();
  try {
    const res = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = $1 AND table_name = $2 AND column_name != 'row_index' 
       ORDER BY ordinal_position`,
      [SCHEMA_NAME, tableName]
    );
    const pgCols = (res.rows as { column_name: string }[]).map((r) => r.column_name);
    const oldName = pgCols[columnIndex];
    if (!oldName) return;

    const used = new Set(pgCols);
    const sorted = [...columns].sort((a, b) => a.order - b.order);
    const col = sorted[columnIndex];
    const newName = col ? toPgColumnName(newDisplayName, col.id, used) : toPgColumnName(newDisplayName, `col_${columnIndex}`, used);
    if (newName === oldName) return;

    await client.query(`ALTER TABLE ${fullTableName} RENAME COLUMN "${oldName}" TO "${newName}"`);
  } finally {
    await client.end();
  }
}

export async function hashN8nTablePassword(password: string): Promise<string> {
  return hash(password, 12);
}
