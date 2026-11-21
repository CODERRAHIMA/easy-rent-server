import express from "express";
import { usersCollection } from "../../config/db.js";
import { sendSuccess } from "../../utils/apiResponse.js";

const router = express.Router();

// all users
router.get("/", async (req, res) => {
  const result = await usersCollection.find({}).toArray();
  sendSuccess(res, result, "Users fetched successfully");
});

export default router;
