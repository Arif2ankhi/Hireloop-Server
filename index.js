import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'
import Stripe from 'stripe';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
const payments = database.collection("payments");




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

//Premium user related api 

app.get('/users/:id/premium', async(req, res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const result = await users.findOne(query,{ projection: { premium: 1}} );
  res.send(result)
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

    if(req.query.recruiterId){
      query.recruiterId = req.query.recruiterId;
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
  if(req.query.applicantId){
    // query.userId = req.query.applicantId
    query.applicantId = req.query.applicantId
  }
  if(req.query.jobId){
    query.jobId = req.query.jobId;
  }

  const cursor = applications.find(query);
  // const cursor = applications.find({});
    const result = await cursor.toArray()
    res.send(result)
})

//Applications count related Api 

app.get('/applications/count', async(req, res)=> {
  const query = {};
  if(req.query.applicantId){
    // query.userId = req.query.applicantId
    query.applicantId = req.query.applicantId
  }
  
  const result = await applications.countDocuments(query)
    res.send({ count: result })
})




app.post('/applications', async(req, res)=>{
  const application = req.body;
  const result = await applications.insertOne(application);
  res.send(result)
})

//Application status relatd Api PATCH method

app.patch('/applications/:id/status', async (req, res) => {
  const allowed = ['Applied', 'Review', 'Interview', 'Shortlisted', 'Rejected', 'Offered'];
  if (!allowed.includes(req.body?.status)) {
    return res.status(400).send({ message: 'Invalid status' });
  }
  const query = { _id: new ObjectId(req.params.id) };
  const updatedDoc = {
    $set: {
      status: req.body.status,
      statusUpdatedAt: new Date().toISOString(),
    }
  }
  const result = await applications.updateOne(query, updatedDoc)
  res.send(result)
})


// app.patch('/applications/:id', async (req, res)=>{
//   const id = req.params.id;
//   const query = {_id: new ObjectId(id)};
//   const updatedDoc = {
//     $set: {
//       status:req.body.status,
//     }
//   }
//   const result = await applications.updateOne(query, updatedDoc)
//   res.send(result)
// })

//Payments related Api 

app.post('/payments/checkout-verify', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.send({ success: false, message: 'sessionId is required' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Stripe status is 'complete' (not 'completed')
    if (session.status !== 'complete' || session.payment_status !== 'paid') {

      const sessionQuery = {sessionId};
      const existingPayment = await payments.findOne(sessionQuery)
      if(existingPayment){
        return res.send({success: false, message: 'Payment already verified'})
      }
      res.send({ success: false, message: 'Payment verification failed' });
      return;
    }

    const userId = session.metadata?.userId;
    if (!userId) {
      res.send({ success: false, message: 'Session has no userId metadata' });
      return;
    }

    // Record the payment — idempotent, so a page refresh doesn't duplicate it
    const existing = await payments.findOne({ sessionId });
    if (!existing) {
      await payments.insertOne({
        sessionId,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_email,
        userId,
        payment_date: new Date(),
        payment_intent: session.payment_intent,
      });
    }

    // Set premium — better-auth ids may be a string field or an ObjectId _id
    let updateResult = await users.updateOne({ id: userId }, { $set: { premium: true } });
    if (updateResult.matchedCount === 0) {
      updateResult = await users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { premium: true } }
      );
    }

    // res.send({ success: true, updateResult });
// Success page new layout backend code 
    res.send({
  success: true,
  alreadyVerified: existing ? true : undefined,
  transactionId:
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null,
  amount: (session.amount_total ?? 0) / 100,
  currency: session.currency,
  customerEmail: session.customer_email,
  paymentDate: new Date().toISOString(),
})
  } catch (err) {
    console.dir(err);
    res.send({ success: false, message: 'Verification error' });
  }
});

// app.get('/payments/checkout-verify', async(req, res)=>{
//   const {sessionId} = req.body

//     const {
//     status,
//     payment_status,
//     customer_email,
//      metadata,
//      payment_intent

//   } = await stripe.checkout.sessions.retrieve(sessionId);

//   if(status === 'completed' && payment_status === 'paid'){

//     const sessionQuery = {sessionId};
//       const existingPayment = await payments.findOne(sessionQuery)
//       if(existingPayment){
//         return res.send({success: false, message: 'Payment already verified'})
//       }
//     const  payment ={
//   sessionId,
//     status,
//     payment_status,
//     customer_email,
//      userId:metadata.userId,
//      payment_date: new Date(),
//      payment_intent

//   }
//   const result = await payments.insertOne(payment);
// //update the user table

// const query = {_id: new ObjectId(metadata.userId)};

//   const updatedDoc= {
//     $set:{
//       premium: true,
//     }
//   }

//   const updatedResult = await users.updateOne(
//     query,
//     updatedDoc
//   )
//   res.send({ success: true, result, updatedResult});
//   return

//   }

//   res.send({success:false, message: 'Payment verification failed'})

// })

//listener
app.listen(port, () => {
  console.log(`Hire loop is running on port ${port}`);
});