import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "../utils/ApiError.js";

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized: Token is required");
  }

  const token = authHeader.split(" ")[1];

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.CLIENT_URL,
      audience: process.env.CLIENT_URL,
    });

    req.user = payload;
  } catch (error) {
    throw new ApiError(401, "Unauthorized: Invalid token");
  }

  next();
};
