const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'mychat/general';
    let resource_type = 'image';

    if (file.mimetype.startsWith('video')) {
      folder = 'mychat/videos';
      resource_type = 'video';
    } else if (file.fieldname === 'avatar') {
      folder = 'mychat/avatars';
    } else if (file.fieldname === 'cover') {
      folder = 'mychat/covers';
    } else if (file.fieldname === 'story') {
      folder = 'mychat/stories';
    } else if (file.fieldname === 'reel') {
      folder = 'mychat/reels';
      resource_type = 'video';
    } else if (file.fieldname === 'post') {
      folder = 'mychat/posts';
    }

    return {
      folder,
      resource_type,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'webm', 'ogg', 'mp3'],
      transformation: resource_type === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : [],
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  },
});

const deleteMedia = async (publicId, resourceType = 'image') => {
  return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = { cloudinary, upload, deleteMedia };