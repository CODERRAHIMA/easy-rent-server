import express from "express";
import { ObjectId } from "mongodb";

import {
  bookingsCollection,
  equipmentsCollection,
  usersCollection,
  userProfilesCollection,
} from "../../config/db.js";

import { stripe } from "../../config/stripe.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import verifyRole from "../../middleware/verifyRole.js";

const bookingRoutes = express.Router();

// Rental period calculation
const daysPerPeriod = {
  Daily: 1,
  Weekly: 7,
  Monthly: 30,
};

const getRentalPeriods = (startDate, endDate, rentalType) => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  const days = Math.round((end - start) / 86400000) + 1;

  return Math.ceil(days / daysPerPeriod[rentalType]);
};

// Create Stripe Checkout Session
bookingRoutes.post("/create-check-session", async (req, res) => {
  let bookingId;

  try {
    const {
      equipmentId,
      userId,
      userEmail,
      quantity,
      startDate,
      endDate,
      contactNumber,
      deliveryAddress,
      additionalNotes,
    } = req.body;

    // Validate required fields
    if (
      !equipmentId ||
      !userId ||
      !userEmail ||
      !startDate ||
      !endDate ||
      !contactNumber ||
      !deliveryAddress
    ) {
      return res.status(400).send({
        success: false,
        message: "Please provide all required booking information",
      });
    }

    // Validate equipment ID
    if (!ObjectId.isValid(equipmentId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid equipment ID",
      });
    }

    // Validate quantity
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).send({
        success: false,
        message: "Invalid equipment quantity",
      });
    }

    // Validate dates (YYYY-MM-DD)
    const isValidDate = (value) => {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).send({
        success: false,
        message: "Invalid rental dates",
      });
    }

    if (endDate < startDate) {
      return res.status(400).send({
        success: false,
        message: "End date must be after or equal to start date",
      });
    }

    // Find customer
    if (!ObjectId.isValid(userId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid user ID",
      });
    }

    const customer = await usersCollection.findOne({
      _id: new ObjectId(userId),
      email: userEmail,
    });

    if (!customer) {
      return res.status(404).send({
        success: false,
        message: "Customer not found",
      });
    }

    // Find approved equipment
    const equipment = await equipmentsCollection.findOne({
      _id: new ObjectId(equipmentId),
      status: "approved",
    });

    if (!equipment) {
      return res.status(404).send({
        success: false,
        message: "Equipment not found or not approved",
      });
    }

    // Prevent owner from booking their own equipment
    if (equipment.owner?.email === userEmail) {
      return res.status(400).send({
        success: false,
        message: "You cannot book your own equipment",
      });
    }

    // Check available quantity
    if (quantity > equipment.availableQuantity) {
      return res.status(400).send({
        success: false,
        message: `Only ${equipment.availableQuantity} equipment available`,
      });
    }

    // Validate rental type
    if (!daysPerPeriod[equipment.rentalType]) {
      return res.status(400).send({
        success: false,
        message: "Invalid equipment rental type",
      });
    }

    // Calculate rental duration and total price
    const rentalPeriods = getRentalPeriods(
      startDate,
      endDate,
      equipment.rentalType,
    );

    const rentalPrice = Number(equipment.rentalPrice);

    if (
      !Number.isFinite(rentalPrice) ||
      rentalPrice <= 0 ||
      !Number.isSafeInteger(rentalPrice * 100)
    ) {
      return res.status(400).send({
        success: false,
        message: "Invalid equipment rental price",
      });
    }

    const totalPrice = rentalPrice * rentalPeriods * quantity;
    const amountInSmallestUnit = Math.round(totalPrice * 100);

    // Create pending booking
    const booking = {
      equipmentId: equipment._id.toString(),
      equipmentName: equipment.name,

      customerId: customer._id.toString(),
      userId: customer._id.toString(),
      userEmail: customer.email,

      ownerEmail: equipment.owner.email,

      startDate,
      endDate,
      rentalPeriods,
      rentalType: equipment.rentalType,

      quantity,
      rentalPrice,
      totalPrice,

      contactNumber: contactNumber.trim(),
      deliveryAddress: deliveryAddress.trim(),
      additionalNotes: additionalNotes?.trim() || "",

      status: "pending",
      paymentStatus: "unpaid",

      createdAt: new Date(),
    };

    const bookingResult = await bookingsCollection.insertOne(booking);

    bookingId = bookingResult.insertedId;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "bdt",
            product_data: {
              name: equipment.name,
              description: equipment.description,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],

      mode: "payment",

      success_url: `${process.env.CLIENT_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${process.env.CLIENT_URL}/booking/cancel`,

      customer_email: customer.email,

      metadata: {
        bookingId: bookingId.toString(),
        equipmentId: equipment._id.toString(),
        userId: customer._id.toString(),
      },
    });

    // Save Stripe session ID
    await bookingsCollection.updateOne(
      { _id: bookingId },
      {
        $set: {
          stripeSessionId: session.id,
        },
      },
    );

    return res.send({
      success: true,
      message: "Checkout session created successfully",
      url: session.url,
    });
  } catch (error) {
    console.error("Create checkout session error:", error);

    // Mark booking as failed if checkout creation fails
    if (bookingId) {
      await bookingsCollection.updateOne(
        { _id: bookingId },
        {
          $set: {
            status: "cancelled",
            paymentStatus: "failed",
          },
        },
      );
    }

    return res.status(500).send({
      success: false,
      message: "Failed to create checkout session",
    });
  }
});

// Get all rentals (bookings) of a customer
bookingRoutes.get("/my-rentals",
  verifyToken,
  verifyRole("customer"),
  async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).send({
          success: false,
          message: "Customer email is required",
        });
      }

      const rentals = await bookingsCollection
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();

      return res.send({
        success: true,
        message: "Rentals fetched successfully",
        data: rentals,
      });
    } catch (error) {
      console.error("Fetch my rentals error:", error);

      return res.status(500).send({
        success: false,
        message: "Failed to fetch rentals",
      });
    }
  },
);

// Get all rentals of an owner
bookingRoutes.get("/owner-rentals", verifyToken, verifyRole("owner"), async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return fail(res, 400, "Owner email is required");
    }

    // Find owner's equipment (only the fields we need)
    const ownerEquipments = await equipmentsCollection
      .find(
        { "owner.email": email },
        { projection: { name: 1, category: 1, image: 1 } },
      )
      .toArray();

    if (ownerEquipments.length === 0) {
      return res.send({
        success: true,
        message: "No rentals found",
        data: [],
      });
    }

    // Look up equipment by id without searching the array for every booking
    const equipmentById = new Map(
      ownerEquipments.map((equipment) => [equipment._id.toString(), equipment]),
    );

    // Find bookings for owner's equipment
    const bookings = await bookingsCollection
      .find({ equipmentId: { $in: [...equipmentById.keys()] } })
      .sort({ createdAt: -1 })
      .toArray();

    // Collect the customer ids and emails once, then fetch the customers and
    // profiles with 2 queries (instead of up to 3 queries for every booking)
    const customerIds = new Set();
    const customerEmails = new Set();

    for (const booking of bookings) {
      const customerId = booking.customerId || booking.userId;

      if (customerId && ObjectId.isValid(customerId)) {
        customerIds.add(String(customerId));
      }
      if (booking.userEmail) {
        customerEmails.add(booking.userEmail);
      }
    }

    const [users, profiles] = await Promise.all([
      usersCollection
        .find(
          {
            $or: [
              { _id: { $in: [...customerIds].map((id) => new ObjectId(id)) } },
              { email: { $in: [...customerEmails] } },
            ],
          },
          { projection: { name: 1, email: 1, phone: 1, image: 1, photo: 1 } },
        )
        .toArray(),

      userProfilesCollection
        .find(
          { email: { $in: [...customerEmails] } },
          { projection: { email: 1, phone: 1 } },
        )
        .toArray(),
    ]);

    const usersById = new Map();
    const usersByEmail = new Map();

    for (const user of users) {
      usersById.set(user._id.toString(), user);
      if (user.email && !usersByEmail.has(user.email)) {
        usersByEmail.set(user.email, user);
      }
    }

    const profilesByEmail = new Map();

    for (const profile of profiles) {
      if (!profilesByEmail.has(profile.email)) {
        profilesByEmail.set(profile.email, profile);
      }
    }

    // Attach customer and equipment information
    const data = bookings.map((booking) => {
      const equipment = equipmentById.get(booking.equipmentId.toString());

      // Find customer by id, or by email as a fallback
      const customerId = booking.customerId || booking.userId;
      const customer =
        (customerId && usersById.get(String(customerId))) ||
        (booking.userEmail && usersByEmail.get(booking.userEmail)) ||
        null;

      // Additional customer profile information
      const customerProfile = booking.userEmail
        ? profilesByEmail.get(booking.userEmail)
        : null;

      return {
        ...booking,

        requiredQuantity: booking.quantity || 1,

        // Names that the owner page expects
        totalAmount: booking.totalPrice,
        bookingStatus: booking.status,
        paymentStatus:
          booking.paymentStatus === "unpaid" ? "pending" : booking.paymentStatus,

        customer: {
          name: customer?.name || "Unknown customer",
          email: customer?.email || booking.userEmail || "",
          phone: customerProfile?.phone || customer?.phone || "",
          photo: customer?.image || customer?.photo || "",
        },

        equipment: {
          name: equipment?.name || booking.equipmentName || "Unknown equipment",
          category: equipment?.category || "",
          image: equipment?.image || "",
        },
      };
    });

    return res.send({
      success: true,
      message: "Owner rentals fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Fetch owner rentals error:", error);

    return fail(res, 500, "Failed to fetch owner rentals");
  }
});

// get all rentals (admin)
bookingRoutes.get("/admin/all", verifyToken, verifyRole("admin"), async (req, res) => {
    try {
      const bookings = await bookingsCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      if (bookings.length === 0) {
        return res.send({
          success: true,
          message: "No rentals found",
          data: [],
        });
      }

      const customerIds = new Set();
      const customerEmails = new Set();
      const equipmentIds = new Set();
      const ownerEmails = new Set();

      for (const booking of bookings) {
        const customerId = booking.customerId || booking.userId;

        if (customerId && ObjectId.isValid(customerId)) {
          customerIds.add(String(customerId));
        }

        if (booking.userEmail) {
          customerEmails.add(booking.userEmail);
        }

        if (
          booking.equipmentId &&
          ObjectId.isValid(booking.equipmentId)
        ) {
          equipmentIds.add(String(booking.equipmentId));
        }

        if (booking.ownerEmail) {
          ownerEmails.add(booking.ownerEmail);
        }
      }

      const equipments = await equipmentsCollection
        .find({
          _id: {
            $in: [...equipmentIds].map(
              (id) => new ObjectId(id)
            ),
          },
        })
        .toArray();

      const equipmentById = new Map(
        equipments.map((equipment) => [
          equipment._id.toString(),
          equipment,
        ])
      );

      // Collect owner emails from equipment as fallback
      for (const equipment of equipments) {
        if (equipment.owner?.email) {
          ownerEmails.add(equipment.owner.email);
        }
      }
      const allEmails = new Set([
        ...customerEmails,
        ...ownerEmails,
      ]);

      const [users, profiles] = await Promise.all([
        usersCollection
          .find({
            $or: [
              {
                _id: {
                  $in: [...customerIds].map(
                    (id) => new ObjectId(id)
                  ),
                },
              },
              {
                email: { $in: [...allEmails] },
              },
            ],
          })
          .toArray(),

        userProfilesCollection
          .find({
            email: { $in: [...allEmails] },
          })
          .toArray(),
      ]);

      const usersById = new Map();
      const usersByEmail = new Map();
      const profilesByEmail = new Map();

      for (const user of users) {
        usersById.set(user._id.toString(), user);

        if (user.email) {
          usersByEmail.set(user.email, user);
        }
      }

      for (const profile of profiles) {
        profilesByEmail.set(profile.email, profile);
      }

      const data = bookings.map((booking) => {
        const customerId = booking.customerId || booking.userId;

        const customer =
          (customerId && usersById.get(String(customerId))) ||
          usersByEmail.get(booking.userEmail) ||
          {};

        const customerProfile = profilesByEmail.get(
          booking.userEmail
        );

        const equipment = equipmentById.get(
          String(booking.equipmentId)
        );

        const ownerEmail =
          booking.ownerEmail || equipment?.owner?.email || "";

        const owner =
          usersByEmail.get(ownerEmail) || {};

        const ownerProfile = profilesByEmail.get(ownerEmail);

        return {
          ...booking,

          _id: booking._id.toString(),
          equipmentName:
            equipment?.name || booking.equipmentName || "Unknown equipment",

          requiredQuantity: booking.quantity || 1,
          totalAmount: booking.totalPrice || 0,

          bookingStatus: booking.status || "pending",

          paymentStatus:
            booking.paymentStatus === "unpaid"
              ? "pending"
              : booking.paymentStatus || "pending",

          customer: {
            name: customer.name || "Unknown customer",
            email: customer.email || booking.userEmail || "",
            phone:
              customerProfile?.phone ||
              customer.phone ||
              "",
            photo: customer.image || customer.photo || "",
          },

          owner: {
            name:
              equipment?.owner?.name ||
              owner.name ||
              "Unknown owner",
            email: ownerEmail,
            phone:
              ownerProfile?.phone ||
              owner.phone ||
              "",
          },
        };
      });

      return res.send({
        success: true,
        message: "All rentals fetched successfully",
        data,
      });
    } catch (error) {
      console.error("Admin fetch all rentals error:", error);

      return res.status(500).send({
        success: false,
        message: "Failed to fetch all rentals",
      });
    }
  }
);

// update booking (admin)
bookingRoutes.patch("/:id/status", verifyToken, verifyRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // 1. Validate booking ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          success: false,
          message: "Invalid booking ID",
        });
      }

      const allowedStatuses = [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).send({
          success: false,
          message: "Invalid booking status",
        });
      }

      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!booking) {
        return res.status(404).send({
          success: false,
          message: "Booking not found",
        });
      }

      await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status,
            updatedAt: new Date(),
          },
        }
      );

      return res.send({
        success: true,
        message: "Booking status updated successfully",
        data: {
          _id: id,
          bookingStatus: status,
        },
      });
    } catch (error) {
      console.error("Admin update booking status error:", error);

      return res.status(500).send({
        success: false,
        message: "Failed to update booking status",
      });
    }
  }
);


export default bookingRoutes;
