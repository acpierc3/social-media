const fs = require('fs');
const path = require('path');

const {validationResult} = require('express-validator');

const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  try{
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
        .populate('creator')
        .sort({createdAt: -1})
        .skip((currentPage - 1) * perPage)
        .limit(perPage);
    res.status(200).json({posts: posts, totalItems: totalItems});
  }
  catch (err) {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect');
    error.statusCode = 422;
    throw error;
  }
  if(!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path.replace("\\", "/");
  const title = req.body.title;
  const content = req.body.content;
  const post = new Post({
    title: title, 
    content: content, 
    imageUrl: imageUrl,
    creator: req.userId
  });
  try {
    await post.save();
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();
    //after we are done creating post, inform other clients about the new post via web sockets
    //emit() sends info to ALL clients, including the one who created the new post
    //so in the front end logic, i removed the original logic to add post, since post will be added by web socket logic
    //emit() automatically converts object to JSON
    io.getIO().emit('posts', {action: 'create', post: {...post._doc, creator: {_id: req.userId, name: user.name}}})
    res.status(201).json({
      message: 'Post created successfully!',
      post: post,
      creator: {_id: user._id, name: user.name}
    });
  }
  catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId.populate('creator'));
    if(!post) {
      const error = new Error('Could not find post');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({message: 'Post fetched', post: post})
  }
  catch (err) {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

exports.updatePost = async (req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect');
    error.statusCode = 422;
    throw error;
  }
  let imageUrl = req.body.image;
  if(req.file) {
    imageUrl = req.file.path.replace("\\", "/");
  }
  if(!imageUrl) {
    const error = new Error('No image picked.');
    error.statusCode = 422;
    throw error;
  }
  try {
    const post = await Post.findById(req.params.postId).populate('creator');
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
    //if the new image url is different, delete the old one
    if(imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }
    post.title = req.body.title;
    post.imageUrl = imageUrl;
    post.content = req.body.content;
    const result = await post.save();
    io.getIO().emit('posts', {action: 'update', post: result})
    res.status(200).json({post: result});
    
  } catch (err) {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
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
    await Post.findByIdAndRemove(req.params.postId);
    const user = await User.findById(req.userId);
    user.posts.pull(req.params.postId);
    await user.save();
    io.getIO().emit('posts', {action: 'delete', post: req.params.postId})
    res.status(200).json({message: "Post deleted"});
  } catch(err) {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

exports.getStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if(!user) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({message: 'Status fetched', status: user.status})
  } catch(err) {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

exports.updateStatus = async (req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect');
    error.statusCode = 422;
    throw error;
  }
  try {
    const user = await User.findById(req.userId);
    if(!user) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    user.status = req.body.status;
    await user.save();
    res.status(200).json({message: 'Status updated'})
  } catch(err) {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

