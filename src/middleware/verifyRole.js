import { ApiError } from "../utils/ApiError.js";

export function verifyRole(...allowedRoles) {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      throw new ApiError(403, "Forbidden");
    }

    next();
  };
}

export default verifyRole;
