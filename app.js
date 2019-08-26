const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const PRIVATE = require('./util/database.priv.js');
const feedRoutes = require('./routes/feed');

const app = express();

const MONGODB_URI = 'mongodb+srv://node:' +PRIVATE.MONGO_PASSWORD +'@online-shop-dkmzb.mongodb.net/messages?w=majority';

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/feed', feedRoutes);

mongoose.connect(MONGODB_URI)
    .then(result => {
        app.listen(8080);
    })
    .catch(err => console.log(err));