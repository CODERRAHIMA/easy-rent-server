import express from "express";
import cors from "cors";
import "dotenv/config";
import { ObjectId } from "mongodb";

import {
  connectToMongoDB,
  bookingsCollection,
} from "./config/db.js";

import userRoutes from "./routes/users/index.js";
import equipmentRoutes from "./routes/equipment/index.js";
import bookingRoutes from "./routes/booking/index.js";
import favouriteRoutes from "./routes/favorite/index.js";
import imageRoutes from "./routes/image/index.js";

import { stripe } from "./config/stripe.js";

const app = express();
const port = process.env.PORT || 5000;

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    // Verify Stripe signature
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error("Webhook signature verification failed:", error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    console.log("Stripe Event Received:", event.type);

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        if (session.payment_status === "paid") {
          const bookingId = session.metadata?.bookingId;

          if (!bookingId || !ObjectId.isValid(bookingId)) {
            console.error("Invalid booking ID:", bookingId);
            return res.status(400).json({ message: "Invalid booking ID" });
          }

          const result = await bookingsCollection.updateOne(
            {
              _id: new ObjectId(bookingId),
              stripeSessionId: session.id,
              paymentStatus: { $ne: "paid" },
            },
            {
              $set: {
                paymentStatus: "paid",
                status: "confirmed",
                stripePaymentIntentId: session.payment_intent,
                paidAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );

          console.log("Booking updated:", result.modifiedCount);
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).json({ message: "Webhook processing failed" });
    }
  }
);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server running...");
});

app.use("/users", userRoutes);
app.use("/equipments", equipmentRoutes);
app.use("/bookings", bookingRoutes);
app.use("/favourites", favouriteRoutes);
app.use("/images", imageRoutes);

await connectToMongoDB();

app.listen(port, () => {
  console.log("Server is Listening to port", port);
});
