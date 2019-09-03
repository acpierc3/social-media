const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');
const multer = require('multer');

const PRIVATE = require('./util/database.priv.js');
const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

const app = express();

const MONGODB_URI = 'mongodb+srv://node:' +PRIVATE.MONGO_PASSWORD +'@online-shop-dkmzb.mongodb.net/messages?w=majority';

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'images');
    },
    filename: function(req, file, cb) {
        let extension = file.originalname.split('.').pop();
        cb(null, uuidv4() +'.' +extension)
    }
});

const fileFilter = (req, file, cb) => {
    if(file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use(multer({storage: storage, fileFilter: fileFilter}).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

app.use((error, req, res, next) => {
    console.log("ERROR HANDLER: ",error);
    const status = error.statusCode || 500;
    const data = error.data;
    res.status(status).json({
        message: error.message,
        data: data
    })
})

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useFindAndModify: false })
    .then(result => {
        app.listen(8080);
    })
    .catch(err => console.log(err));
