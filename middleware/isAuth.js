const jwt = require('jsonwebtoken');

const PRIVATE = require('../util/database.priv.js');

module.exports = (req, res, next) => {
    //get token from request header
    const authHeader = req.get('Authorization');
    if(!authHeader) {
        const error = new Error('Not authenticated.');
        error.statusCode = 401;
        throw error;
    }
    const token = authHeader.split(' ')[1];
    let decodedToken;
    try {
        decodedToken = jwt.verify(token, PRIVATE.JWT_PRIVATE_KEY);
    } catch(err) {
        err.statusCode = 500;
        throw err;
    }
    if(!decodedToken) {
        const error = new Error('Not authenticated.');
        err.statusCode = 401;
        throw error;
    }
    req.userId = decodedToken.userId;
    next();
}