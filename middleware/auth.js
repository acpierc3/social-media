const jwt = require('jsonwebtoken');

const PRIVATE = require('../util/database.priv.js');

module.exports = (req, res, next) => {
    //get token from request header
    const authHeader = req.get('Authorization');
    if(!authHeader) {
        req.isAuth = false;
        return next();
    }
    const token = authHeader.split(' ')[1];
    let decodedToken;
    try {
        decodedToken = jwt.verify(token, PRIVATE.JWT_PRIVATE_KEY);
    } catch(err) {
        req.isAuth = false;
        return next();
    }
    if(!decodedToken) {
        req.isAuth = false;
        return next();
    }
    req.userId = decodedToken.userId;
    req.isAuth = true;
    next();
}