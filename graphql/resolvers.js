const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');

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
    },

    createPost: async function({ postInput }, req) {
        if(!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const errors = [];

        if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})) {
            errors.push({message: 'Title is invalid!'});
        }
        if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})) {
            errors.push({message: 'Content is invalid!'});
        }
        if(errors.length > 0) {
            const error = new Error('Invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if(!user){
            const error = new Error('Invaid user!');
            error.code = 401;
            throw error;
        }
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        });
        const createdPost = await post.save();
        user.posts.push(createdPost);
        await user.save();
        return {
            ...createdPost._doc, 
            _id: createdPost._id.toString(),
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        };
    },

    posts: async function({ page }, req) {
        if(!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const currentPage = page || 1;
        const perPage = 2;
        const totalPosts = await Post.find().countDocuments();
        const posts = await Post.find()
            //only populates name field of the creator, so password isnt included
            .populate('creator', 'name')
            .sort({createdAt: -1})
            .skip((currentPage - 1) * perPage)
            .limit(perPage);
        return{
            posts: posts.map(post => {
               return {
                    ...post._doc,
                    _id: post._id.toString(),
                    createdAt: post.createdAt.toISOString(),
                    updatedAt: post.updatedAt.toISOString()
               } 
            }), 
            totalPosts: totalPosts
        };
    }
};