import { DbProjection } from "../../types/dbTypes/dbProjection";
import { UserDTO } from "../user.dto";

export type AuthUserDTO = DbProjection<
  Pick<UserDTO, "userId" | "email" | "password">
>;
