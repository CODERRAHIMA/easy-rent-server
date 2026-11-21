import express from "express";
import { equipmentsCollection } from "../../config/db.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ObjectId } from "mongodb";

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
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

    sendSuccess(res, equipments, "Equipments fetched successfully");
  } catch (error) {
    console.error("Get equipments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch equipments",
    });
  }
});

// my equipments (owner dashboard)
equipmentRoutes.get("/my-equipment", async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Owner email is required",
      });
    }

    const equipments = await equipmentsCollection
      .find({ "owner.email": email })
      .toArray();

    sendSuccess(res, equipments, "My equipments fetched successfully");
  } catch (error) {
    console.error("Get my equipments error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch my equipments",
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

// update equipment
equipmentRoutes.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    const updatedData = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Owner email is required",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment ID",
      });
    }

    const allowedFields = [
      "name",
      "brand",
      "model",
      "category",
      "image",
      "rentalPrice",
      "rentalType",
      "availableQuantity",
    ];

    const updateFields = {};

    allowedFields.forEach((field) => {
      if (updatedData[field] !== undefined) {
        updateFields[field] = updatedData[field];
      }
    });

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const result = await equipmentsCollection.updateOne(
      {
        _id: new ObjectId(id),
        "owner.email": email,
      },
      {
        $set: updateFields,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found or you are not the owner",
      });
    }

    sendSuccess(res, result, "Equipment updated successfully");
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update equipment",
    });
  }
});

// delete equipment
equipmentRoutes.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Owner email is required",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment ID",
      });
    }

    const result = await equipmentsCollection.deleteOne({
      _id: new ObjectId(id),
      "owner.email": email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    sendSuccess(res, result, "Equipment deleted successfully");
  } catch (error) {
    console.error("Delete equipment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete equipment",
    });
  }
});

// get equipment details
equipmentRoutes.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment ID",
      });
    }

    const equipment = await equipmentsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    sendSuccess(res, equipment, "Equipment details fetched successfully");
  } catch (error) {
    console.log("Get equipment details error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch equipment details",
    });
  }
});

export default equipmentRoutes;
