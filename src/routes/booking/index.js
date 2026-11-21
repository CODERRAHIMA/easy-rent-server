import express from "express";
import { ObjectId } from "mongodb";

const bookingRoutes = express.Router();

// Get all rentals for a specific equipment owner
bookingRoutes.get("/owner-rentals", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Owner email is required",
      });
    }

    const ownerEquipments = await equipmentsCollection
      .find({ "owner.email": email })
      .toArray();

    if (ownerEquipments.length === 0) {
      return res.send({
        success: true,
        message: "No rentals found",
        data: [],
      });
    }

    const equipmentIds = ownerEquipments.flatMap((equipment) => [
      equipment._id,
      equipment._id.toString(),
    ]);

    const bookings = await bookingsCollection
      .find({
        equipmentId: { $in: equipmentIds },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Attach customer and equipment information
    const data = await Promise.all(
      bookings.map(async (booking) => {
        const equipment = ownerEquipments.find(
          (item) => item._id.toString() === booking.equipmentId.toString(),
        );

        let customer = null;

        if (booking.customerId) {
          customer = await usersCollection.findOne({
            _id: booking.customerId,
          });

          if (!customer && typeof booking.customerId === "string") {
            try {
              customer = await usersCollection.findOne({
                _id: new ObjectId(booking.customerId),
              });
            } catch {}
          }
        }

        return {
          ...booking,
          requiredQuantity: booking.quantity,
          customer: {
            name: customer?.name || "Unknown customer",
            email: customer?.email || "",
            phone: customer?.phone || "",
            photo: customer?.image || customer?.photo || "",
          },
          equipment: {
            name: equipment?.name || "Unknown equipment",
            category: equipment?.category || "",
            image: equipment?.image || "",
          },
        };
      }),
    );

    return res.send({
      success: true,
      message: "Owner rentals fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Fetch owner rentals error:", error);

    return res.status(500).send({
      success: false,
      message: "Failed to fetch owner rentals",
    });
  }
});

export default bookingRoutes;
