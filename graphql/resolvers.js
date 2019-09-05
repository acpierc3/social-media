const bcrypt = require('bcryptjs');
const validator = require('validator');

const User = require('../models/user');

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
    }
};