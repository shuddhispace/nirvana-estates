require('dotenv').config();
const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve uploads and public files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static('public'));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// Multer storage for images/videos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if(file.fieldname === "images"){
      cb(null, 'public/uploads/images');
    } else if(file.fieldname === "videos"){
      cb(null, 'public/uploads/videos');
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Admin upload route
app.post('/admin/upload-property', upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]), (req, res) => {
    const { title, price, location, area, bedrooms, bathrooms, description, category } = req.body;
    const negotiable = req.body.negotiable === 'on';

    const images = req.files['images'] ? req.files['images'].map(f => `/uploads/images/${f.filename}`) : [];
    const videos = req.files['videos'] ? req.files['videos'].map(f => `/uploads/videos/${f.filename}`) : [];

    const property = {
      id: Date.now(),
      title,
      price,
      negotiable,
      location,
      carpetArea: Number(carpetArea),
      builtupArea: Number(builtupArea),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      description,
      category,
      images,
      videos
    };

    const dataFile = 'data/properties.json';
    let properties = [];
    if(fs.existsSync(dataFile)){
      const fileContent = fs.readFileSync(dataFile, 'utf-8');
      if(fileContent) properties = JSON.parse(fileContent);
    }

    properties.push(property);
    fs.writeFileSync(dataFile, JSON.stringify(properties, null, 2));

    res.send("Property uploaded successfully!");
});

app.listen(3000, () => console.log("Server running on port 3000"));
