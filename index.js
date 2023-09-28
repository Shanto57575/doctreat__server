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

const verifyJWT = async (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        res.status(401).send({ error: true, message: "Unauthorized access" })
    }
    const token = authorization?.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            res.send({ error: true, message: "unauthorized access" })
        }
        req.decoded = decoded
        next()
    })
}

async function run() {
    try {

        await client.connect();

        const docsCollection = client.db('DoctorsDB').collection('docServices');
        const bookingCollection = client.db('DoctorsDB').collection('booking');
        const blogsCollection = client.db('DoctorsDB').collection('blogs');

        //jwt

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
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

            console.log(req.query);
            console.log(filters);

            console.log("filters.length=>", filters.length);

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

        app.get('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = {
                projection: {
                    name: 1,
                    speciality: 1,
                    service: 1,
                    fees: 1,
                    picture: 1,
                    country: 1, experience: 1
                }
            }
            const result = await docsCollection.findOne(query, options);
            res.send(result);
        })

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

        app.get('/bookings', verifyJWT, async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query?.email }
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/bookings', async (req, res) => {
            const data = req.body;
            const searchData = await bookingCollection.findOne({ id: data.id });

            if (searchData) {
                res.status(409).json({ message: "DATA ALREADY EXISTS" })
            }
            else {
                const result = await bookingCollection.insertOne(data);
                res.send(result);
            }
        })

        app.patch('/bookings/:id', async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedStatus = {
                $set: {
                    status: data.status
                }
            }
            const result = await bookingCollection.updateOne(query, updatedStatus);
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
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