// TODO: Implement token verification (Better Auth JWT integration)
// Do not create a separate manual JWT system.
// Example:
// export function verifyToken(req, res, next) {
//   const token = req.headers.authorization?.split(" ")[1];
//   if (!token) return res.status(401).json({ message: "Unauthorized" });
//   try {
//     const decoded = await verifyJWT(token);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     res.status(401).json({ message: "Invalid token" });
//   }
// }
