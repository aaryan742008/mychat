const { upload } = require('../config/cloudinary');

const uploadAvatar = upload.single('avatar');
const uploadCover = upload.single('cover');
const uploadPost = upload.single('post');
const uploadReel = upload.single('reel');
const uploadStory = upload.single('story');
const uploadMessage = upload.single('media');

module.exports = { uploadAvatar, uploadCover, uploadPost, uploadReel, uploadStory, uploadMessage };