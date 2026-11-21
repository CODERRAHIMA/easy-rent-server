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
};
