import { client } from "./generated/client.gen";
import { getAccessToken } from "../auth/token";

client.setConfig({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  credentials: "include",
  auth: (auth) => auth.scheme === "bearer" ? getAccessToken() : undefined,
});

export { client };
