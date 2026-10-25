import { UserDTO } from "../dtos/user.dto";
import { User, UserSchema } from "../models/user.model";

export function toUserModel(userDto: UserDTO): User {
  return UserSchema.parse({
    userId: userDto.userId,
    email: userDto.email,
  });
}
