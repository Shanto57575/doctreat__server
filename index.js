const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

//JWT Verification

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized Access" })
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "Unauthorized Access" })
        }
        req.decoded = decoded;
        next();
    })
}

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

        const usersCollection = client.db('DoctorsDB').collection('users');
        const docsCollection = client.db('DoctorsDB').collection('docServices');
        const blogsCollection = client.db('DoctorsDB').collection('blogs');
        const shopCollection = client.db('DoctorsDB').collection('shop');
        const cartsCollection = client.db('DoctorsDB').collection('carts');
        const commentsCollection = client.db('DoctorsDB').collection('comments');
        const paymentCollection = client.db('DoctorsDB').collection('payment');
        const feedbackCollection = client.db('DoctorsDB').collection('feedback');

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            const isUserExists = await usersCollection.findOne(query)
            if (isUserExists) {
                return res.send({ messages: "User Already exists" })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // TODO
        // app.put('/users', async (req, res) => {
        //     const user = req.body;
        //     const updateDoc = {
        //         $set: {

        //         },
        //     };

        //     const result = await usersCollection.updateOne(user)
        //     res.send(result);
        // })


        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params?.email;

            if (req.decoded?.email !== email) {
                return res.send({ Admin: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { Admin: user?.role === 'Admin' }
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

        app.post('/alldoctors', async (req, res) => {
            const newSpecialist = req.body;
            const result = await docsCollection.insertOne(newSpecialist);
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

        // blog comments!
        app.post('/comments', async (req, res) => {
            const comment = req.body;
            const result = await commentsCollection.insertOne(comment);
            res.send(result);
        })

        app.get('/comments', async (req, res) => {
            const result = await commentsCollection.find().toArray();
            res.send(result);
        })

        app.get('/shop', async (req, res) => {
            const result = await shopCollection.find().toArray();
            res.send(result);
        })

        app.post('/shop', async (req, res) => {
            const newProduct = req.body;
            const result = await shopCollection.insertOne(newProduct);
            res.send(result);
        })

        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(401).send({ error: true, message: "Forbidden Access" })
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

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;

            const uniqueArray = [...new Set(payment.itemsCategory)]
            payment.itemsCategory = uniqueArray;

            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
            const deleteResult = await cartsCollection.deleteMany(query);

            res.send({ insertResult, deleteResult })
        })

        app.get('/payments/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/payments/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await paymentCollection.deleteMany(query)
            res.send(result);
        })

        app.post('/feedback', verifyJWT, async (req, res) => {
            const feedback = req.body;
            console.log(feedback);
            const feedbackResult = await feedbackCollection.insertOne(feedback);
            res.send(feedbackResult);
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