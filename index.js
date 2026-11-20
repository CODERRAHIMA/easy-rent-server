import express from "express";
import cors from "cors";
import { MongoClient } from 'mongodb';
import 'dotenv/config'

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
const db = connectedClient.db("EasyRentDB");
const userCollection = db.collection("users");
const equipmentsCollection = db.collection("equipments");
const favouritesCollection = db.collection("favourites");
const bookingsCollection = db.collection("bookings");
const paymentsCollection = db.collection("payments");

app.get("/", (req, res) => {
    res.send("server running...")
})

app.get("/users", async (req, res) => {
  const result = await userCollection.find({}).toArray();
  res.send(result);
})

app.listen(port, () => {
  console.log("Server is Listening to port", port);
});