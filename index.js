import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
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
const jobs = database.collection("jobs");
const applications = database.collection("applications");




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

//Api for search , filter and query
app.get('/jobs', async (req, res) => {
  const query = {};
  // console.log('query', req.query);

  if (req.query) {
    if (req.query.type) {
      query.type = req.query.type;
    }

    if (req.query.isRemote) {
      query.isRemote = req.query.isRemote;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { requirements: { $regex: req.query.search, $options: 'i' } },
        { responsibilities: { $regex: req.query.search, $options: 'i' } }
      ];
    }
  }

  const cursor = jobs.find(query);
  const result = await cursor.toArray();
  res.send(result);
});

// Jobs details page API 

app.get('/jobs/:id', async(req, res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await jobs.findOne(query);
  res.send(result)
})

//Jobs related Api http://localhost:5000/jobs
app.post('/jobs', async(req, res)=>{
   const job= req.body;
    const result = await jobs.insertOne(job);
    res.send(result)

})

//delete a  job api  http://localhost:5000/jobs

app.delete('/jobs/:id', async (req, res) =>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const result = await jobs.deleteOne(query);
    res.send(result);

``
})


//Application related Api
app.get('/applications', async(req, res)=> {
  const query = {};
  const cursor = applications.find({});
    const result = await cursor.toArray()
    res.send(result)

})

app.post('/applications', async(req, res)=>{
  const application = req.body;
  const result = await applications.insertOne(application);
  res.send(result)
})

//listener
app.listen(port, () => {
  console.log(`Hire loop is running on port ${port}`);
});