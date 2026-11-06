// Email + password login lives in server/auth/passwordAuth.ts (Replit Auth was
// removed because it only works inside Replit).
export { setupAuth, isAuthenticated, getSession, registerAuthRoutes } from "../../auth/passwordAuth";
export { authStorage } from "./storage";
