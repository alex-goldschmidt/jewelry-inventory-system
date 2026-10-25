import { createResponse as createHttpResponse } from "node-mocks-http";

export function createResponse() {
  const response = createHttpResponse();
  jest.spyOn(response, "status");
  jest.spyOn(response, "json");
  jest.spyOn(response, "type");
  jest.spyOn(response, "cookie");
  jest.spyOn(response, "clearCookie");
  return response;
}
