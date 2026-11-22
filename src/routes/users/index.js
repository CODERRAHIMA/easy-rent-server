import express from "express";
import { userProfilesCollection } from "../../config/db.js";

const userRoutes = express.Router();

// GET: Fetch profile information
userRoutes.get("/profile", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const profile = await userProfilesCollection.findOne(
      { email },
      { projection: { _id: 0, phone: 1, address: 1 } },
    );

    return res.status(200).json({
      success: true,
      data: profile || { phone: "", address: "" },
      message: "Profile fetched successfully",
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
});

// PATCH: Update profile information
userRoutes.patch("/profile", async (req, res) => {
  try {
    const { email } = req.query;
    const { phone, address } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (typeof phone !== "string" || typeof address !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone and address must be strings",
      });
    }

    await userProfilesCollection.updateOne(
      { email },
      {
        $set: {
          email,
          phone: phone.trim(),
          address: address.trim(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
});

export default userRoutes;