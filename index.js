const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hf3bhoa.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {

        await client.connect();

        const usersCollection = client.db('DoctorsDB').collection('users');
        const docsCollection = client.db('DoctorsDB').collection('docServices');
        const blogsCollection = client.db('DoctorsDB').collection('blogs');
        const shopCollection = client.db('DoctorsDB').collection('shop');
        const cartsCollection = client.db('DoctorsDB').collection('carts');



        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            const isUserExists = await usersCollection.findOne(query)
            if (isUserExists) {
                return res.status(403).send({ messages: "User ALready exists", error: "User ALready exists" })
            }
            console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: "Admin"
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result);
        })

        app.delete('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })

        //doctor 
        app.get('/doctors', async (req, res) => {
            const query = await docsCollection.find().limit(4).toArray();
            res.send(query);
        })

        //allDoctor
        app.get('/alldoctors', async (req, res) => {
            const { page, itemsPerPage, search, gender, speciality, fees } = req.query;

            const filters = [];
            const query = {};

            if (search) {
                filters.push({ country: { $regex: search, $options: 'i' } });
            }

            if (gender) {
                filters.push({ gender })
            }

            if (speciality) {
                filters.push({ speciality })
            }

            if (fees) {
                const [minFee, maxFee] = fees.split('-').map(Number);

                if (!isNaN(minFee)) {
                    filters.push({ fees: { $gte: minFee } });
                }

                if (!isNaN(maxFee)) {
                    filters.push({ fees: { $lte: maxFee } });
                }
            }

            const skip = (page - 1) * itemsPerPage;
            if (filters.length === 0) {
                const result = await docsCollection
                    .find()
                    .skip(parseInt(skip))
                    .limit(parseInt(itemsPerPage))
                    .toArray();

                res.send(result);
                return;
            }

            query.$and = filters;

            const result = await docsCollection
                .find(query)
                .skip(parseInt(skip))
                .limit(parseInt(itemsPerPage))
                .toArray();

            res.send(result);
        })

        // blog section
        app.get('/blogs', async (req, res) => {
            const result = await blogsCollection.find().toArray();
            res.send(result)
        })

        app.get('/blogs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await blogsCollection.findOne(query);
            res.send(result)
        })

        app.get('/shop', async (req, res) => {
            const result = await shopCollection.find().toArray();
            res.send(result);
        })

        app.get('/carts', async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.send([])
            }

            const query = { email: email }
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query)
            res.send(result);
        })


        app.post('/carts', async (req, res) => {
            const data = req.body;
            delete data._id;

            const query = { email: data.email, name: data.name }
            const alreadyExists = await cartsCollection.findOne(query)

            if (alreadyExists) {
                return res.status(400).send({ error: "Product Already Added" })
            }

            const result = await cartsCollection.insertOne(data);
            res.send(result);
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Patient died before the Doctor came')
})

app.listen(port, () => {
    console.log(`Doctor is checking on port ${port}`);
})