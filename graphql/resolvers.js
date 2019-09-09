const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');
const {clearImage} = require('../util/file');

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
    },

    post: async function({ id }, req) {

        if(!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator', 'name');
        if(!post) {
            const error = new Error('Could not find post');
            error.statusCode = 404;
            throw error;
        }
        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        }
    },

    updatePost: async function({ id, postInput }, req) {
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
        // let imageUrl = req.body.image;
        // if(req.file) {
        //     imageUrl = req.file.path.replace("\\", "/");
        // }
        // if(!imageUrl) {
        //     const error = new Error('No image picked.');
        //     error.statusCode = 422;
        //     throw error;
        // }
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
        
        const post = await Post.findById(id).populate('creator');
        if(!post) {
            const error = new Error('Could not find post');
            error.statusCode = 404;
            throw error;
        }
        if(post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error('Not Authorized');
            error.statusCode = 403;
            throw error;
        }
        // //if the new image url is different, delete the old one
        // if(imageUrl !== post.imageUrl) {
        //     clearImage(post.imageUrl);
        // }
        post.title = postInput.title;
        if (postInput.imageUrl !== 'undefined') {
            post.imageUrl = imageUrl;
        }
        post.content = postInput.content;
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

    deletePost: async function({ id }, req) {
        if(!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id);
        if(!post) {
            const error = new Error('Could not find post');
            error.statusCode = 404;
            throw error;
        }
        if(post.creator.toString() !== req.userId.toString()) {
            const error = new Error('Not Authorized');
            error.statusCode = 403;
            throw error;
        }
        clearImage(post.imageUrl);
        await Post.findByIdAndRemove(id);
        const user = await User.findById(req.userId);
        user.posts.pull(id);
        await user.save();
        return true;
    },

    user: async function(args, req) {
        if(!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('User not found');
            error.code = 404;
            throw error;
        }
        return {
            ...user._doc,
            _id: user._id.toString()
        }
    },

    updateStatus: async function({status}, req) {
        if(!req.isAuth) {
            const error = new Error('Not authenticated!');
            error.code = 401;
            throw error;
        }
        const errors = [];

        if(validator.isEmpty(status) || !validator.isLength(status, {min: 5})) {
            errors.push({message: 'Status is invalid!'});
        }
        if(errors.length > 0) {
            const error = new Error('Invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if(!user) {
            const error = new Error('Could not find user');
            error.statusCode = 404;
            throw error;
          }
        user.status = status;
        const updatedUser = await user.save();
        return {
            ...updatedUser._doc,
            _id: updatedUser._id.toString()
        }
    }
};