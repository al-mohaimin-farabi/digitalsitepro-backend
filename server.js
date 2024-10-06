const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const port = process.env.PORT || 5000;

// Middleware Setup
app.use(cors());
app.use(express.json());

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// MongoDB URI and Client Setup
const uri = process.env.DATABASE_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Multer Setup for File Storage

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads")); // Files will be stored in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    // MongoDB Collections
    const database = client.db("digitalsitepro");
    const usersCollection = database.collection("users");
    const testimonialCollection = database.collection("testimonial");
    const proposalsCollection = database.collection("proposals");

    console.log("MongoDB connected!");

    // User Endpoints

    // Insert new user
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.status(200).json(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Update or insert user if it does not exist
    app.put("/users", async (req, res) => {
      try {
        const user = req.body;
        const filter = { email: user.email };
        const options = { upsert: true };
        const updateDoc = { $set: user };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.status(200).json(result);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Check if user is admin
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const isAdmin = user?.role === "admin";
        res.status(200).json({ admin: isAdmin });
      } catch (error) {
        console.error("Error checking admin status:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Get user phone number
    app.get("/users/phone/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.phoneNumber) {
          res.status(200).json({ phoneNumber: user.phoneNumber });
        } else {
          res
            .status(404)
            .json({ message: "User does not have a phone number" });
        }
      } catch (error) {
        console.error("Error getting user's phone number:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Update profile
    app.post("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const { displayName, phoneNumber, country } = req.body;

        const filter = { email };
        const updateFields = {};

        if (displayName) updateFields.displayName = displayName;
        if (phoneNumber) updateFields.phoneNumber = phoneNumber;
        if (country) updateFields.country = country;

        const options = { upsert: true };
        const result = await usersCollection.updateOne(
          filter,
          { $set: updateFields },
          options
        );

        if (result.modifiedCount > 0 || result.upsertedCount > 0) {
          console.log("User updated successfully");
          res.status(200).json({ message: "User updated successfully" });
        } else {
          console.log("No changes made to the user");
          res.status(200).json({ message: "No changes made to the user" });
        }
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Testimonial Endpoints

    // Get testimonial for approval
    app.get("/testimonialapprove/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const isAdmin = user?.role === "admin";

        if (isAdmin) {
          const testimonials = await testimonialCollection
            .find({ approved: { $exists: false } })
            .toArray();
          res.status(200).json(testimonials);
        } else {
          res.status(403).json({ error: "Forbidden" });
        }
      } catch (error) {
        console.error("Error getting testimonials for approval:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Approve testimonial
    app.put("/testimonialapprove", async (req, res) => {
      try {
        const { id, user_email } = req.body;

        const user = await usersCollection.findOne({ email: user_email });
        if (user?.role === "admin") {
          const result = await testimonialCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { approved: true } },
            { upsert: true }
          );

          if (result.upsertedCount === 1 || result.modifiedCount === 1) {
            const testimonials = await testimonialCollection.find({}).toArray();
            res.status(200).json(testimonials);
          } else {
            res.status(404).json({ error: "Testimonial not found." });
          }
        } else {
          res.status(403).json({ error: "Forbidden" });
        }
      } catch (error) {
        console.error("Error updating testimonial:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Delete testimonial
    app.delete("/testimonialapprove", async (req, res) => {
      try {
        const { id, user_email } = req.body;

        const user = await usersCollection.findOne({ email: user_email });
        if (user?.role === "admin") {
          const result = await testimonialCollection.deleteOne({
            _id: new ObjectId(id),
          });

          if (result.deletedCount === 1) {
            const testimonials = await testimonialCollection.find({}).toArray();
            res.status(200).json(testimonials);
          } else {
            res.status(404).json({ error: "Testimonial not found." });
          }
        } else {
          res.status(403).json({ error: "Forbidden" });
        }
      } catch (error) {
        console.error("Error deleting testimonial:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Insert testimonial
    app.post("/testimonial", async (req, res) => {
      try {
        const testimonial = req.body;
        const result = await testimonialCollection.insertOne(testimonial);
        res.status(200).json(result);
      } catch (error) {
        console.error("Error inserting testimonial:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Proposal Endpoints

    // Make Proposal - Insert new proposal
    app.post("/makeproposal", upload.single("file"), async (req, res) => {
      try {
        const { name, email, phoneNumber, category, details } = req.body;
        const file = req.file;

        const proposal = {
          name,
          email,
          phoneNumber,
          category,
          details,
          filePath: file ? path.join("uploads", file.filename) : null,
          createdAt: new Date(),
        };

        const result = await proposalsCollection.insertOne(proposal);
        res.status(200).json({ success: true, data: result });
      } catch (error) {
        console.error("Error inserting proposal:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Get Proposals by User Email
    app.get("/makeproposal/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const proposals = await proposalsCollection.find({ email }).toArray();
        res.status(200).json(proposals);
      } catch (error) {
        console.error("Error retrieving proposals:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Get Proposals - Retrieve all proposals if user is an admin
    app.get("/makeproposal", async (req, res) => {
      try {
        const userEmail = req.query.email;
        const user = await usersCollection.findOne({ email: userEmail });

        if (user?.role === "admin") {
          const proposals = await proposalsCollection.find({}).toArray();
          res.status(200).json(proposals);
        } else {
          res
            .status(403)
            .json({ message: "Access denied. User is not an admin." });
        }
      } catch (error) {
        console.error("Error retrieving proposals:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

// Running the server
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Digital Site Pro Server Is Online");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
