import { MongoClient } from "mongodb";
import "dotenv/config";

const client = new MongoClient(process.env.MONGO_URI);
/** @type {import("mongodb").Db} */

let db;
let usersCollection;
let equipmentsCollection;
let bookingsCollection;
let favouritesCollection;
let paymentsCollection;
let userProfilesCollection;

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");

    db = client.db("EasyRentDB");
    usersCollection = db.collection("user");
    equipmentsCollection = db.collection("equipments");
    bookingsCollection = db.collection("bookings");
    favouritesCollection = db.collection("favourites");
    paymentsCollection = db.collection("payments");
    userProfilesCollection = db.collection("userProfiles");

    await favouritesCollection.createIndex(
      { email: 1, equipmentId: 1 },
      { unique: true },
    );

    return client;
  } catch (err) {
    console.dir(err);
  }
}

export {
  db,
  usersCollection,
  equipmentsCollection,
  bookingsCollection,
  favouritesCollection,
  paymentsCollection,
  userProfilesCollection,
};
