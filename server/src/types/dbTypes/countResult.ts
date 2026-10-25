import { RowDataPacket } from "mysql2";

export interface CountResult extends RowDataPacket {
  count: number;
}
