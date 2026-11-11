import {
  DATA_TABLES,
  FIELDS,
  TABLE_LABEL,
  type DataTable,
} from "@/lib/data/tables";

// The read-only schema view (DAT-04). The live view reads information_schema
// (lib/server/data.ts); the demo view is built from the table definitions here,
// so both show the same shape.

export type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
};
export type SchemaRelation = {
  column: string;
  references: string;
  referencedColumn: string;
};
export type SchemaTable = {
  name: DataTable;
  label: string;
  columns: SchemaColumn[];
  relations: SchemaRelation[];
};
export type SchemaView = { tables: SchemaTable[] };

const KIND_TYPE: Record<string, string> = {
  code: "varchar",
  text: "varchar",
  "long-text": "text",
  enum: "enum",
  reference: "bigint unsigned",
  date: "date",
};

/** The schema as the table definitions describe it, used in demo sessions. */
export function schemaFromDefinitions(): SchemaView {
  return {
    tables: DATA_TABLES.map((name) => ({
      name,
      label: TABLE_LABEL[name],
      columns: [
        { name: "id", type: "bigint unsigned", nullable: false, key: "PRI" },
        ...FIELDS[name].map((f) => ({
          name: f.name,
          type: KIND_TYPE[f.kind] ?? "varchar",
          nullable: !f.required,
          key:
            f.name === "code" ||
            f.name === "asset_tag" ||
            f.name === "ticket_no"
              ? "UNI"
              : "",
        })),
      ],
      relations: FIELDS[name]
        .filter((f) => f.references)
        .map((f) => ({
          column: f.name,
          references: f.references!,
          referencedColumn: "id",
        })),
    })),
  };
}
