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

// Admin upload route (Updated for YouTube Shorts only)
app.post('/admin/upload-property', upload.array('images', 10), (req, res) => {
  try {
    const {
      title, price, location, bedrooms, bathrooms,
      description, category, carpetArea, builtupArea, videos
    } = req.body;

    const negotiable = req.body.negotiable === 'on';

    // Handle image uploads
    const images = req.files ? req.files.map(f => `/uploads/images/${f.filename}`) : [];

    // ✅ Handle YouTube video URLs
    let videoLinks = [];
    if (videos) {
      videoLinks = Array.isArray(videos) ? videos : [videos];
    }

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
      videos: videoLinks, // YouTube links only
    };

    const dataFile = 'data/properties.json';
    let properties = [];

    if (fs.existsSync(dataFile)) {
      const fileContent = fs.readFileSync(dataFile, 'utf-8');
      if (fileContent) properties = JSON.parse(fileContent);
    }

    properties.push(property);
    fs.writeFileSync(dataFile, JSON.stringify(properties, null, 2));

    res.send("Property uploaded successfully (YouTube Shorts version)!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error uploading property.");
  }
});


// Delete property by ID
app.delete('/admin/delete-property/:id', (req, res) => {
  const id = req.params.id;
  const dataFile = 'data/properties.json';

  if (!fs.existsSync(dataFile)) {
    return res.status(404).json({ success: false, message: "No properties found" });
  }

  let properties = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  const propertyToDelete = properties.find(p => String(p.id) === id);

  if (!propertyToDelete) {
    return res.status(404).json({ success: false, message: "Property not found" });
  }

  // Remove uploaded images
  if (propertyToDelete.images) {
    propertyToDelete.images.forEach(imgPath => {
      const fullPath = path.join(__dirname, 'public', imgPath.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });
  }

  // Remove uploaded videos
  if (propertyToDelete.videos) {
    propertyToDelete.videos.forEach(videoPath => {
      const fullPath = path.join(__dirname, 'public', videoPath.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });
  }

  // Remove from JSON
  properties = properties.filter(p => String(p.id) !== id);
  fs.writeFileSync(dataFile, JSON.stringify(properties, null, 2));

  res.json({ success: true, message: "Property deleted successfully" });
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

// Dynamic sitemap.xml route

// Dynamic sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const baseUrls = [
    'https://nirvanaestates.co.in/',
    'https://nirvanaestates.co.in/about.html',
    'https://nirvanaestates.co.in/contact.html',
    'https://nirvanaestates.co.in/properties.html'
  ];

  const dataFile = path.join(__dirname, 'data/properties.json');
  let propertyUrls = [];

  if (fs.existsSync(dataFile)) {
    const fileContent = fs.readFileSync(dataFile, 'utf-8');
    if (fileContent) {
      const properties = JSON.parse(fileContent);
      propertyUrls = properties.map(p => `https://nirvanaestates.co.in/properties/${p.id}`);
    }
  }

  const urls = [...baseUrls, ...propertyUrls];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `
  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});


// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
