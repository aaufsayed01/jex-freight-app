export type UserRole = "CORPORATE_CLIENT" | "AGENT" | "INTERNAL_STAFF" | "ADMIN";

export function homeRouteForRole(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "INTERNAL_STAFF":
      return "/staff";
    case "AGENT":
    case "CORPORATE_CLIENT":
    default:
      return "/dashboard";
  }
}

export function isExternalRole(role: UserRole) {
  return role === "CORPORATE_CLIENT" || role === "AGENT";
}
