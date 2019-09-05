const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

const PRIVATE = require('../util/database.priv.js');

module.exports = {
    //args data contains data defined in schema user input
    createUser: async function(args, req) {

        const email = args.userInput.email;
        const name = args.userInput.name;
        const password = args.userInput.password;
        const errors = [];

        if(!validator.isEmail(email)) {
            errors.push({message: 'E-mail is not valid'});
        }
        if(validator.isEmpty(password) || !validator.isLength(password, {min: 5})) {
            errors.push({message: 'Password too short'});
        }
        if(errors.length > 0) {
            const error = new Error('Invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }

        const existingUser = await User.findOne({email: email})
        if(existingUser) {
            const error = new Error('User exists already!');
            throw error;
        }
        const hash = await bcrypt.hash(password, 12)
        const user = new User({
            email: email,
            password: hash,
            name: name
        });
        const createdUser = await user.save();
        //._doc returns user object without excess metadata
        //then need to overwrite _id so it is a string, not an object
        return {...createdUser._doc, _id: createdUser._id.toString()}
    },

    //destructured email and password args for simplicity
    login: async function({ email, password }, req) {

        const user = await User.findOne({email: email})
        if(!user) {
            const error = new Error('User not found');
            error.code = 401;
            throw error;
        }
        const isEqual = await bcrypt.compare(password, user.password);
        if(!isEqual){
            const error = new Error('Incorrect password');
            error.statusCode = 401;
            throw error;
        }
        const token = jwt.sign(
            {
                email: user.email,
                userId: user._id.toString()
            }, 
            PRIVATE.JWT_PRIVATE_KEY, 
            {expiresIn: '1h'}
        );
        return {token: token, userId: user._id.toString()};
    }
};