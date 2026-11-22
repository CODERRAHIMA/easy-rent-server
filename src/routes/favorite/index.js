import express from "express";
import { ObjectId } from "mongodb";
import {
  favouritesCollection,
  equipmentsCollection,
} from "../../config/db.js";

const favouriteRoutes = express.Router();

// Add favourite
favouriteRoutes.post("/", async (req, res) => {
  try {
    const { email, equipmentId } = req.body;

    if (!email || !equipmentId) {
      return res.status(400).json({
        success: false,
        message: "Email and equipment ID are required",
      });
    }

    if (!ObjectId.isValid(equipmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment ID",
      });
    }

    const equipment = await equipmentsCollection.findOne({
      _id: new ObjectId(equipmentId),
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    const existingFavourite = await favouritesCollection.findOne({
      email,
      equipmentId: new ObjectId(equipmentId),
    });

    if (existingFavourite) {
      return res.status(409).json({
        success: false,
        message: "Already added to favourites",
      });
    }

    await favouritesCollection.insertOne({
      email,
      equipmentId: new ObjectId(equipmentId),
    });

    res.status(201).json({
      success: true,
      message: "Added to favourites successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to add favourite",
    });
  }
});

// Check favourite status
favouriteRoutes.get("/status/:equipmentId", async (req, res) => {
  try {
    const { email } = req.query;
    const { equipmentId } = req.params;

    if (!email || !ObjectId.isValid(equipmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or equipment ID",
      });
    }

    const favourite = await favouritesCollection.findOne({
      email,
      equipmentId: new ObjectId(equipmentId),
    });

    res.json({
      success: true,
      isFavourite: !!favourite,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to check favourite status",
    });
  }
});

// Get favourites
favouriteRoutes.get("/", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const favourites = await favouritesCollection
      .aggregate([
        { $match: { email } },
        {
          $lookup: {
            from: "equipments",
            localField: "equipmentId",
            foreignField: "_id",
            as: "equipment",
          },
        },
        { $unwind: "$equipment" },
      ])
      .toArray();

    res.json({
      success: true,
      message: "Favourites fetched successfully",
      data: favourites,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch favourites",
    });
  }
});

// Remove favourite
favouriteRoutes.delete("/:equipmentId", async (req, res) => {
  try {
    const { email } = req.query;
    const { equipmentId } = req.params;

    if (!email || !ObjectId.isValid(equipmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or equipment ID",
      });
    }

    await favouritesCollection.deleteOne({
      email,
      equipmentId: new ObjectId(equipmentId),
    });

    res.json({
      success: true,
      message: "Removed from favourites successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to remove favourite",
    });
  }
});

export default favouriteRoutes;