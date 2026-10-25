import { RowDataPacket } from "mysql2";

// mysql2's row type includes a constructor-name marker as well as the columns.
export function dbRow<const T extends object>(columns: T): T & RowDataPacket {
  return { ...columns, constructor: { name: "RowDataPacket" } };
}
