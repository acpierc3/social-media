const fs = require('fs');
const path = require('path');

const {validationResult} = require('express-validator');

const Post = require('../models/post');

exports.getPosts = (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;
  Post.find()
  .countDocuments()
  .then(count => {
    totalItems = count;
    return Post.find()
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
  })
  .then(posts => {
    res.status(200).json({posts: posts, totalItems: totalItems});
  })
  .catch(err => {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  })
  
};

exports.createPost = (req, res, next) => {
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
    creator: {name: 'Adam'}
  });
  post.save()
    .then(result => {
      console.log(result);
      res.status(201).json({
        message: 'Post created successfully!',
        post: post
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    })
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;
  Post.findById(postId)
    .then(post => {
      if(!post) {
        const error = new Error('Could not find post');
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({message: 'Post fetched', post: post})

    })
    .catch(err => {
      if(!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    })
}

exports.updatePost = (req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect');
    error.statusCode = 422;
    throw error;
  }
  let imageUrl = req.body.image;
  if(req.file) {
    console.log('NEW IMAGE DETECTED');
    imageUrl = req.file.path.replace("\\", "/");
  }
  if(!imageUrl) {
    const error = new Error('No image picked.');
    error.statusCode = 422;
    throw error;
  }
  Post.findById(req.params.postId)
    .then(post => {
      if(!post) {
        const error = new Error('Could not find post');
        error.statusCode = 404;
        throw error;
      }
      //if the new image url is different, delete the old one
      if(imageUrl !== post.imageUrl) {
        console.log('DELETING OLD IMAGE')
        clearImage(post.imageUrl);
      }
      post.title = req.body.title;
      post.imageUrl = imageUrl;
      post.content = req.body.content;
      return post.save()
    })
    .then(result => {
      res.status(200).json({post: result});
    })
    .catch(err => {
      if(!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    })
}

exports.deletePost = (req, res, next) => {
  Post.findById(req.params.postId)
    .then(post => {

      //need to check logged in user

      if(!post) {
        const error = new Error('Could not find post');
        error.statusCode = 404;
        throw error;
      }

      clearImage(post.imageUrl);
      return Post.findByIdAndRemove(req.params.postId);
    })
    .then(result => {
      res.status(200).json({message: "Post deleted"});
    })
    .catch(err => {
      if(!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    })
}

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.log(err));
}
