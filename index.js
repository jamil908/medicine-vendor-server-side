const express = require("express");
const cors = require("cors");

const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.PK_SECRET_KEY);

const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY || "key-yourkeyhere",
});
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqwcx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    // category
    const categoryCollection = client
      .db("medicinePortal")
      .collection("category");
    // medicine
    const MedicineCollection = client.db("medicinePortal").collection("Medicines");
    // cart
    const cartCollection = client.db("medicinePortal").collection("carts");
    // users
    const usersCollection = client.db("medicinePortal").collection("users");
    // payments
    const paymentCollection = client.db("medicinePortal").collection("payments");
    // sells collection
    const sellsCollection = client.db("medicinePortal").collection("sells");

    // JWT RELATED API __________________________________________________________________________________________

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });
    //  _____________________--------------jwt middle were------------------_________________________________________________
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // get category --------------------------------------------------------------------------------
    app.get("/category", async (req, res) => {
      try {
        const categories = await categoryCollection
          .aggregate([
            {
              $lookup: {
                from: "Medicines", // The name of the Medicines collection
                localField: "categoryName", // Field in the category collection
                foreignField: "categoryName", // Field in the Medicines collection
                as: "medicines",
              },
            },
            {
              $addFields: {
                numberOfMedicines: { $size: "$medicines" }, // Count the medicines array
              },
            },
            {
              $project: {
                medicines: 0, // Exclude the medicines array from the response
              },
            },
          ])
          .toArray();
        res.send(categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).send({ error: "Failed to fetch categories" });
      }
    });

    // get medicine by category wise ----------------------------------------------------------------------------------
    app.get("/medicines/:categoryName", async (req, res) => {
      const categoryName = req.params.categoryName;
      const query = { categoryName: categoryName }; // Match categoryName with the request parameter
      const medicines = await MedicineCollection.find(query).toArray();
      res.send(medicines);
    });

    // get all medicine ------------------------------------------------------------------------------------------------

    app.get("/medicines", async (req, res) => {
      const cursor = MedicineCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // post users data -------------------------------------------------------------------------------------------------

    app.post("/users/:email", async (req, res) => {
      try {
        // Your code...
        const email = req.params.email;
        const query = { email };
        const user = req.body;
        // check if user exist in database
        const isExist = await usersCollection.findOne(query);
        if (isExist) {
          return res.send(isExist);
        }
        const result = await usersCollection.insertOne({
          ...user,
          role: "user",
          timestamp: Date.now(),
        });
        res.send(result);
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send({ error: "Failed to save user" });
      }
    });

    // post cart item by user -------------------------------------------------------------------------------------------
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;

      delete cartItem._id;

      try {
        const result = await cartCollection.insertOne(cartItem);
        res.send(result);
      } catch (error) {
        console.error("Error inserting cart item:", error);
        res.status(500).send({ error: "Failed to add item to the cart" });
      }
    });

    // GET CART ITEM  by user---------------------------------------------------------------------------------------------
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      // console.log('Received email:', email); // Debugging
      const query = { userEmail: email };
      const result = await cartCollection.find(query).toArray();
      // console.log('Cart items for email:', result); // Debugging
      res.send(result);
    });
    // --------------------------------------------------------------------------------------------------------------------------

    // Remove an Item from Cart -------------------------------------------------------------------------
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;

      // Ensure `id` is converted to ObjectId
      const query = { _id: new ObjectId(id) };

      try {
        const result = await cartCollection.deleteOne(query);
        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Item removed successfully" });
        } else {
          res.status(404).send({ success: false, message: "Item not found" });
        }
      } catch (error) {
        console.error("Error deleting cart item:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to delete cart item" });
      }
    });

    // Increase Quantity ---------------------------------------------------------------------------------
    app.put("/carts/increase/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }; // Ensure you use ObjectId for MongoDB queries
      const updateDoc = {
        $inc: { quantity: 1 }, // Increment the quantity by 1
      };
      try {
        const result = await cartCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error increasing quantity:", error);
        res.status(500).send({ error: "Failed to increase quantity" });
      }
    });

    // Decrease Quantity ---------------------------------------------------------------------------------
    app.put("/carts/decrease/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: { quantity: -1 }, // Decrement the quantity by 1
      };
      try {
        const result = await cartCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error decreasing quantity:", error);
        res.status(500).send({ error: "Failed to decrease quantity" });
      }
    });

    // Clear all items from the cart for a specific user ---------------------------------------------------------------------------------
    app.delete("/carts", async (req, res) => {
      const email = req.query.email; // Get the user's email from the query parameter
      const query = { userEmail: email }; // Query to match user's cart items

      try {
        const result = await cartCollection.deleteMany(query); // Delete all matching documents
        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Cart cleared successfully" });
        } else {
          res
            .status(404)
            .send({ success: false, message: "No items found in the cart" });
        }
      } catch (error) {
        console.error("Error clearing cart:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to clear cart" });
      }
    });

    //payment intent --------------------------------------------------------------------------------------------------
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      if (!amount || amount < 1000) {
        return res.status(400).send({
          error: "Invalid amount. Amount must be at least 50 BDT.",
        });
      }
      console.log(amount);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecrete: paymentIntent.client_secret,
      });
    });

    // payment post --------------------------------------------------------------------------------------------------
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      try {
        const paymentResult = await paymentCollection.insertOne(payment);
        console.log("payment info", payment);
        const query = {
          _id: {
            $in: payment.cartIds.map((id) => new ObjectId(id)),
          },
        };
        const deleteResult = await cartCollection.deleteMany(query);
        // Combine both results into a single response object
        // send mail

        mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Excited User <postmaster@sandboxebff48151bab45888d7fcae723ddf31c.mailgun.org>",
          to: ["md3711451@gmail.com"],
          subject: "Hello",
          text: "Testing some Mailgun awesomness!",
          html: `<div>
                  <h1>Thankyou you for ordering!</h1>
                  <h1>Thankyou you for ordering!</h1>
                  <p>your transaction id is ${payment.transactionId}</p>
                  <p>We are waiting for your feedback</p>
                </div>`,
        })
        .then((msg) => console.log(msg))
        .catch((err) => console.error(err));
        res.send({
          success: true,
          paymentResult,
          deleteResult,
        });
      } catch (error) {
        console.error("Error processing payment:", error);
        res
          .status(500)
          .send({ success: false, message: "Payment processing failed" });
      }
    });

    // get payments data for invoice page --------------------------------------------------------------------------------------------------------------
    app.get("/payments/:transactionId", async (req, res) => {
      const transactionId = req.params.transactionId;
      const payment = await paymentCollection.findOne({ transactionId });
      res.send(payment);
    });

    // _________________________________________--------------------------------________________________________________
    // -----------------------------------------         Admin related          ---------------------------------------
    // verify admin -------------------------------------------------

    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded.email; // User's email passed in headers (temporarily).
        if (!email) {
          return res
            .status(401)
            .send({ message: "Unauthorized: Email not provided" });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        if (user.role === "admin") {
          // Proceed to the next middleware or route handler
          next();
        } else {
          res
            .status(403)
            .send({
              message: "Forbidden: Only admins can perform this action",
            });
        }
      } catch (error) {
        console.error("Error in verifyAdmin middleware:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    };

    // admin stats or chart----------------------------------------------------------------------------------
    app.get('/admin-stats',verifyToken,verifyAdmin, async(req,res)=>{
      const users =await usersCollection.estimatedDocumentCount();
      const cartItems = await MedicineCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      // const payment = await paymentCollection.find().toArray();
      // const revenue = payment.reduce((total,payment)=>total + payment.price,0)
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id:null,
            totalRevenue:{
              $sum: '$price'
            }
          }
        }
      ]).toArray()
      const revenue =result.length > 0 ? result[0].totalRevenue : 0;
      res.send({
        users,
        cartItems,
        orders,
        revenue
      })
    })
    // aggregate Pipeline-______________________________________________________________________________
    app.get('/order-stats',async(req,res)=>{
      const result = await paymentCollection.aggregate([
        {
          $unwind:'$cartIds'
        },{
          $lookup:{
            from:'Medicines',
            localField:'cartItemIds',
            foreignField:'id',
            as:'cartItems'
          }
        },
        {
          $unwind:'$cartItems'
        },{
          $group:{
            _id:'$cartItems.categoryName',
            quantity:{$sum:1},
            revenue:{$sum:'$cartItems.price'}
          }
        }
      ]).toArray()
      res.send(result)
    })


    // get all users___________________________________________________________________________
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    // check admin_______________________________________________________________________________
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    }) 
    //check seller _______________________________________________________________________________-
    app.get("/users/seller/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let seller = false;
      if (user) {
        seller = user?.role === "seller";
      }
      res.send({ seller });
    }) 


      // Update user role_____________________________________________________________________________
      app.put("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
        try {
          const id = req.params.id;
          const { role } = req.body; // New role to assign
          if (!role) {
            return res.status(400).send({ message: "Role is required" });
          }

          const filter = { _id: new ObjectId(id) };
          const updateDoc = { $set: { role } };

          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
        } catch (error) {
          console.error("Error updating user role:", error);
          res.status(500).send({ message: "Failed to update user role" });
        }
      });

    // delete category_________________________________________________________________________________

    app.delete("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      try {
        const result = await categoryCollection.deleteOne(query);
        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Category deleted successfully" });
        } else {
          res
            .status(404)
            .send({ success: false, message: "Category not found" });
        }
      } catch (error) {
        console.error("Error deleting category:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to delete category" });
      }
    });
    // post new category ______________________________________________________________________________________________

    app.post("/categories", async (req, res) => {
      const { categoryName, categoryImage, quantity } = req.body;

      if (!categoryName || !categoryImage || !quantity) {
        return res
          .status(400)
          .send({
            error:
              "All fields (categoryName, categoryImage, quantity) are required.",
          });
      }

      try {
        const newCategory = {
          categoryName,
          categoryImage,
          quantity,
          timestamp: Date.now(),
        };
        const result = await categoryCollection.insertOne(newCategory);
        if (result.insertedId) {
          res
            .status(201)
            .send({ success: true, message: "Category added successfully!" });
        } else {
          res.status(500).send({ error: "Failed to add category." });
        }
      } catch (error) {
        console.error("Error adding category:", error);
        res
          .status(500)
          .send({ error: "An error occurred while adding the category." });
      }
    });

    // get all carts data_____________________________________________________________________________________________________________
    // GET all cart items (admin or authorized user only) ------------------------------------------------------------
    app.get("/carts/all", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const allCartItems = await sellsCollection.find().toArray();
        res.send(allCartItems);
      } catch (error) {
        console.error("Error fetching cart items:", error);
        res.status(500).send({ error: "Failed to fetch cart items" });
      }
    });

    // post sells product
    app.post("/sales", async (req, res) => {
      const { cartData, transactionId } = req.body; // Get cart data and transactionId from request
      try {
        // Prepare the data to be inserted
        const sellsData = cartData.map((item) => ({
          ...item,
          transactionId, // Link the transaction ID to each sold item
          soldAt: new Date(), // Add a timestamp
        }));

        // Insert into sellsCollection
        const result = await sellsCollection.insertMany(sellsData);

        res.send({
          success: true,
          message: "Sales data saved successfully",
          result,
        });
      } catch (error) {
        console.error("Error saving sales data:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to save sales data" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("med for you");
});

app.listen(port, () => {
  console.log(`medicine is wait at:${port}`);
});
