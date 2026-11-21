
import express from "express";
import { equipmentsCollection } from "../../config/db.js";
import { sendSuccess } from "../../utils/apiResponse.js";

const equipmentRoutes = express.Router();

// all equipments with server-side search, filtering and sorting
equipmentRoutes.get("/", async (req, res) => {
  try {
    const queries = req.query;

    // anly approved equipments
    const filter = {
      status: "approved",
    };

    // escape special regex characters
    const escapeRegex = (value) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // search by equipment name or category
    if (queries.search?.trim()) {
      const searchValue = escapeRegex(queries.search.trim());

      filter.$or = [
        {
          name: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          category: {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }

    // filter by location
    if (queries.location?.trim()) {
      filter.location = {
        $regex: escapeRegex(queries.location.trim()),
        $options: "i",
      };
    }

    // filter by category
    if (queries.category) {
      filter.category = queries.category;
    }

    // filter by rental type
    if (queries.rentalType) {
      filter.rentalType = queries.rentalType;
    }

    // filter by price range
    if (queries.minPrice || queries.maxPrice) {
      filter.rentalPrice = {};

      if (queries.minPrice) {
        filter.rentalPrice.$gte = Number(queries.minPrice);
      }

      if (queries.maxPrice) {
        filter.rentalPrice.$lte = Number(queries.maxPrice);
      }
    }

    // filter by availability
    if (queries.availability === "Available Only") {
      filter.availableQuantity = { $gt: 0 };
    }

    // sorting
    const sortOptions = {
      newest: { createdAt: -1 },
      "price: low to high": { rentalPrice: 1 },
      "price: high to low": { rentalPrice: -1 },
    };

    const sort = sortOptions[queries.sort] || sortOptions.newest;

    const equipments = await equipmentsCollection
      .find(filter)
      .sort(sort)
      .toArray();

    sendSuccess(
      res,
      equipments,
      "Equipments fetched successfully"
    );

  } catch (error) {
    console.error("Get equipments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch equipments",
    });
  }
});

// add equipment
equipmentRoutes.post("/", async (req, res) => {
  const data = req.body;

  const result = await equipmentsCollection.insertOne({
    ...data,
    status: "pending",
    createdAt: new Date(),
  });

  sendSuccess(res, result, "Equipment added successfully");
});

export default equipmentRoutes;
