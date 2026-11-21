import express from "express";
import { equipmentsCollection } from "../../config/db.js";
import { sendSuccess } from "../../utils/apiResponse.js";

const equipmentRoutes = express.Router();

// all equipments
equipmentRoutes.get("/", async(req, res) => {
    const equipments = await equipmentsCollection.find({}).toArray();
    sendSuccess(res, equipments, "Equipments fetched successfully");
})



export default equipmentRoutes;
