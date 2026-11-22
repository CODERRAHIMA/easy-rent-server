import express from "express";
import cors from "cors";
import "dotenv/config";

import { connectToMongoDB } from "./config/db.js";

import userRoutes from "./routes/user/index.js";
import equipmentRoutes from "./routes/equipment/index.js";
import bookingRoutes from "./routes/booking/index.js";
import favouriteRoutes from "./routes/favorite/index.js";
import paymentRoutes from "./routes/payment/index.js";
import adminRoutes from "./routes/admin/index.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server running...");
});

app.use("/users", userRoutes);
app.use("/equipments", equipmentRoutes);
app.use("/bookings", bookingRoutes);
app.use("/favourites", favouriteRoutes);
app.use("/payments", paymentRoutes);
app.use("/admin", adminRoutes);

await connectToMongoDB();

app.listen(port, () => {
  console.log("Server is Listening to port", port);
});
