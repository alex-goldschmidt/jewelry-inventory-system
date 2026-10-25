import { RowDataPacket } from "mysql2";

export type DbProjection<T> = T & RowDataPacket;
