export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: "admin" | "facilitator" | "client";
    };
  }
}
