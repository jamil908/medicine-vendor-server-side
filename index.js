const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port =process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');


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
    const medicineCollection = client.db('medicinePortal').collection('medicines');
    // users
    const usersCollection = client.db('medicinePortal').collection('users');

    app.get('/category',async(req,res)=>{
        const cursor = categoryCollection.find();
        const result = await cursor.toArray()
        res.send(result)
    })
// get medicine by category wise

app.get('/medicines/:categoryName', async (req, res) => {
  const categoryName = req.params.categoryName;
  const query = { categoryName: categoryName }; // Match categoryName with the request parameter
  const medicines = await medicineCollection.find(query).toArray();
  res.send(medicines);
});
app.get('/medicines', async (req, res) => {
  const cursor = medicineCollection.find();
        const result = await cursor.toArray()
        res.send(result)
});
// post users data
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