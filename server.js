require('dotenv').config();
const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static folders
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.static('public'));

// Multer storage for images/videos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'images') cb(null, 'public/uploads/images');
    else if (file.fieldname === 'videos') cb(null, 'public/uploads/videos');
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage: storage });

// Admin upload route
app.post('/admin/upload-property', upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]), (req, res) => {
  try {
    const {
      title, price, location, bedrooms, bathrooms,
      description, category, carpetArea, builtupArea
    } = req.body;

    const negotiable = req.body.negotiable === 'on';

    // Map multiple images/videos paths
    const images = req.files['images'] ? req.files['images'].map(f => `/uploads/images/${f.filename}`) : [];
    const videos = req.files['videos'] ? req.files['videos'].map(f => `/uploads/videos/${f.filename}`) : [];

    const property = {
      id: Date.now(),
      title,
      price,
      negotiable,
      location,
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      description,
      category,
      carpetArea,
      builtupArea,
      images,
      videos
    };

    const dataFile = 'data/properties.json';
    let properties = [];
    if (fs.existsSync(dataFile)) {
      const fileContent = fs.readFileSync(dataFile, 'utf-8');
      if (fileContent) properties = JSON.parse(fileContent);
    }

    properties.push(property);
    fs.writeFileSync(dataFile, JSON.stringify(properties, null, 2));

    res.send("Property uploaded successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error uploading property.");
  }
});


// 💌 Seller Form Route (Add Here)
app.post("/submit-seller", async (req, res) => {
  const { name, phone, email, type, location, description } = req.body;
  const nodemailer = require("nodemailer");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "nirvanaestatess@gmail.com",
    subject: `New Seller/Rental Property Submission - ${type}`,
    html: `
      <h2>New Property Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Description:</strong> ${description}</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
