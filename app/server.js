let express = require('express');
let path = require('path');
let fs = require('fs');
let MongoClient = require('mongodb').MongoClient;
let bodyParser = require('body-parser');
let app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get('/profile-picture', function (req, res) {
    let img = fs.readFileSync(path.join(__dirname, "images/profile-1.jpg"));
    res.writeHead(200, { 'Content-Type': 'image/jpg' });
    res.end(img, 'binary');
});

let mongoUrlLocal = "mongodb://admin:password@127.0.0.1:27017/?authSource=admin";
let mongoUrl = process.env.MONGO_URL || mongoUrlLocal;
let mongoClientOptions = { serverSelectionTimeoutMS: 5000 };
let databaseName = "my-db";
let mongoClient;

async function getDb() {
    if (!mongoClient) {
        // Reuse one Mongo client instead of connecting for every request.
        mongoClient = new MongoClient(mongoUrl, mongoClientOptions);
        await mongoClient.connect();
    }

    return mongoClient.db(databaseName);
}

app.post('/update-profile', async function (req, res) {
    let userObj = req.body;

    try {
        let db = await getDb();
        userObj['userid'] = 1;
        let myquery = { userid: 1 };
        let newvalues = { $set: userObj };

        await db.collection("users").updateOne(myquery, newvalues, { upsert: true });
        res.send(userObj);
    } catch (err) {
        console.error('update-profile failed:', err.message);
        res.status(500).send({ error: 'Failed to update profile' });
    }
});

app.get('/get-profile', async function (req, res) {
    try {
        let db = await getDb();
        let myquery = { userid: 1 };
        let result = await db.collection("users").findOne(myquery);
        res.send(result ? result : {});
    } catch (err) {
        console.error('get-profile failed:', err.message);
        res.status(500).send({ error: 'Failed to load profile' });
    }
});

process.on('SIGINT', async function () {
    if (mongoClient) {
        await mongoClient.close();
    }

    process.exit(0);
});

app.listen(3000, function () {
    console.log("app listening on port 3000!");
});