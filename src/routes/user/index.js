import express from "express";
import { usersCollection } from "../../config/db.js";
import { sendSuccess } from "../../utils/apiResponse.js";

const userRoutes = express.Router();

// Get all users
userRoutes.get("/", async (req, res) => {
  try {
    const users = await usersCollection.find({}).toArray();

    sendSuccess(res, users, "Users fetched successfully");
  } catch (error) {
    console.error("Fetch users error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

export default userRoutes;