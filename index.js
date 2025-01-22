const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port =process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId, } = require('mongodb');


app.use(cors())
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqwcx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
// category
    const categoryCollection=client.db('medicinePortal').collection('category');
// medicine
    const MedicineCollection = client.db('medicinePortal').collection('Medicines');
// cart
    const cartCollection = client.db('medicinePortal').collection('carts');
// users
    const usersCollection = client.db('medicinePortal').collection('users');



    // get category --------------------------------------------------------------------------------
app.get('/category', async (req, res) => {
  try {
    const categories = await categoryCollection.aggregate([
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
    ]).toArray();
    res.send(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send({ error: "Failed to fetch categories" });
  }
});





// get medicine by category wise ----------------------------------------------------------------------------------

app.get('/medicines/:categoryName', async (req, res) => {
  const categoryName = req.params.categoryName;
  const query = { categoryName: categoryName }; // Match categoryName with the request parameter
  const medicines = await MedicineCollection.find(query).toArray();
  res.send(medicines);
});

// get all medicine ------------------------------------------------------------------------------------------------
app.get('/medicines', async (req, res) => {
  const cursor = MedicineCollection.find();
        const result = await cursor.toArray()
        res.send(result)
});


// post users data -------------------------------------------------------------------------------------------------

app.post('/users/:email',async(req,res)=>{
  const email = req.params.email;
  const query = {email}
  const user = req.body
  // check if user exist in database
  const isExist = await usersCollection.findOne(query);
  if(isExist){
    return res.send(isExist)
  }
  const result = await usersCollection.insertOne({...user,
       role:'user',
    timestamp : Date.now(),
  })
  res.send(result)
})


// post cart item by user -------------------------------------------------------------------------------------------

app.post('/carts', async (req, res) => {
  const cartItem = req.body;

  delete cartItem._id;

  try {
    const result = await cartCollection.insertOne(cartItem);
    res.send(result);
  } catch (error) {
    console.error('Error inserting cart item:', error);
    res.status(500).send({ error: 'Failed to add item to the cart' });
  }
});

// GET CART ITEM  by user---------------------------------------------------------------------------------------------
app.get('/carts', async (req, res) => {
  const email = req.query.email;
  // console.log('Received email:', email); // Debugging
  const query = { userEmail: email };
  const result = await cartCollection.find(query).toArray();
  // console.log('Cart items for email:', result); // Debugging
  res.send(result);
});
// --------------------------------------------------------------------------------------------------------------------------

// Remove an Item from Cart -------------------------------------------------------------------------

app.delete('/carts/:id', async (req, res) => {
  const id = req.params.id;
  
  // Ensure `id` is converted to ObjectId
  const query = { _id: new ObjectId(id) };
  
  try {
    const result = await cartCollection.deleteOne(query);
    if (result.deletedCount > 0) {
      res.send({ success: true, message: 'Item removed successfully' });
    } else {
      res.status(404).send({ success: false, message: 'Item not found' });
    }
  } catch (error) {
    console.error('Error deleting cart item:', error);
    res.status(500).send({ success: false, message: 'Failed to delete cart item' });
  }
});


// Increase Quantity ---------------------------------------------------------------------------------
app.put('/carts/increase/:id', async (req, res) => {
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
app.put('/carts/decrease/:id', async (req, res) => {
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





  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/',(req,res)=>{
    res.send('med for you')
})

app.listen(port,()=>{
    console.log(`medicine is wait at:${port}`)
})