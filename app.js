const path = require('path');
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');
const multer = require('multer');
const graphqlHttp = require('express-graphql');

const PRIVATE = require('./util/database.priv.js');
const MONGODB_URI = 'mongodb+srv://node:' +PRIVATE.MONGO_PASSWORD +'@online-shop-dkmzb.mongodb.net/messages?w=majority';

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');

const app = express();


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
    //this code is needed because OPTIONS requests are not allowed in graphQL
    //so otherwise they would cause an error once reaching graphql middleware
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

//middleware to check every request for auth, however if user is not
//authenticated, request will not be denied, but resolver will decide whether
//or not to continue
app.use(auth);


app.put('/post-image', (req, res, next) => {
    if(!req.isAuth) {
        const error = new Error('Not authenticated!');
        error.code = 401;
        throw error;
    }
    //make sure that multer has added image to the req object
    if (!req.file) {
        return res.status(200).json({message: 'No file provided'})
    }
    if(req.body.oldPath) {
        clearImage(req.body.oldPath);
    }
    return res.status(201).json({filePath: req.file.path})
});

app.use('/graphql', graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
        if (!err.originalError) {
            return err;
        }
        const data = err.originalError.data;
        const message = err.message || 'An error occurred.';
        const code = err.originalError.code || 500;
        return {message: message, status: code, data: data}
    }
}));

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

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => {
        if(err) {
            console.log(err);
        }
    })
}