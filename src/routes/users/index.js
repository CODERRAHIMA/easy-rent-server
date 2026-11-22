import express from "express";
import {
  usersCollection,
  userProfilesCollection,
  db,
} from "../../config/db.js";
import { ObjectId } from "mongodb";
import { verifyToken } from "../../middleware/verifyToken.js";
import verifyRole from "../../middleware/verifyRole.js";

const userRoutes = express.Router();

const allowedRoles = ["customer", "owner", "admin"];


// GET: Fetch profile information
userRoutes.get("/profile", verifyToken, async (req, res) => {
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
userRoutes.patch("/profile", verifyToken, async (req, res) => {
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


// get all registered users (Admin)
userRoutes.get("/", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const users = await usersCollection
      .find({})
      .project({
        name: 1,
        email: 1,
        role: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: users,
      message: "Users fetched successfully",
    });
  } catch (error) {
    console.error("Fetch users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});


// Change user role (Admin)
userRoutes.patch("/:id/role", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const { email } = req.query;
    const { role } = req.body;
    const { id } = req.params;

    const admin = await verifyAdmin(email);

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Only admins can change user roles",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const targetUser = await usersCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (targetUser.email === admin.email) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } },
    );

    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
    });
  } catch (error) {
    console.error("Change role error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to change user role",
    });
  }
});


// Delete user (Admin)
userRoutes.delete("/:id", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const { email } = req.query;
    const { id } = req.params;

    const admin = await verifyAdmin(email);

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete users",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const targetUser = await usersCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (targetUser.email === admin.email) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    // Delete the Better Auth user document
    await usersCollection.deleteOne({
      _id: new ObjectId(id),
    });

    // Delete additional profile information
    await userProfilesCollection.deleteOne({
      email: targetUser.email,
    });

    // Clean up Better Auth sessions and linked accounts
    await db.collection("session").deleteMany({
      userId: id,
    });

    await db.collection("account").deleteMany({
      userId: id,
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
});

export default userRoutes;