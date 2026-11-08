import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import 'dotenv/config'


const app = express();
const port = process.env.PORT || 5000;


//Middleware 
app.use(express.json());
app.use(cors());




const client = new MongoClient(`mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.nsvzy.mongodb.net:27017,cluster0-shard-00-01.nsvzy.mongodb.net:27017,cluster0-shard-00-02.nsvzy.mongodb.net:27017/?ssl=true&replicaSet=atlas-6jrxdo-shard-0&authSource=admin`);

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
const database = connectedClient.db("hireloopdb");
const users = database.collection("user");
const jobs = database.collection("jobs")




//Default server initial 
app.get('/', (req, res) => {
  res.send('Hire loop is running');
});

//User related Api 
app.get('/users', async (req, res) =>{
    const cursor = users.find({});
    const result = await cursor.toArray();
    res.send(result);

})

//Jobs related Api 
app.post('/jobs', async(req, res)=>{
   const job= req.body;
    const result = await jobs.insertOne(job);
    res.send(result)

})

//listener
app.listen(port, () => {
  console.log(`Hire loop is running on port ${port}`);
});