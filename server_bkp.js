// server.js (replace your current file with this)
require('dotenv').config();
const express = require('express');
const app = express();

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// Basic middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname)); // serve static files from project root

// Paths / files
const propertiesFile = path.join(__dirname, 'properties.json');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Nodemailer (unchanged from yours)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Sellers data dir (unchanged)
const sellersDataDir = path.join(__dirname, 'sellers_data');
if (!fs.existsSync(sellersDataDir)) fs.mkdirSync(sellersDataDir);

// Multer storage — preserves original file extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB per file; adjust if needed
});

// Utility: read/write properties.json
function readProperties() {
  if (!fs.existsSync(propertiesFile)) {
    fs.writeFileSync(propertiesFile, '[]', 'utf8');
    return [];
  }
  try {
    const raw = fs.readFileSync(propertiesFile, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading properties.json:', err);
    return [];
  }
}
function saveProperties(properties) {
  fs.writeFileSync(propertiesFile, JSON.stringify(properties, null, 2), 'utf8');
}

// Migration: convert old single "image" to images array and ensure arrays exist
function migratePropertiesIfNeeded() {
  let props = readProperties();
  let changed = false;

  props = props.map(p => {
    if (!p.images && p.image) {
      p.images = [p.image];
      delete p.image;
      changed = true;
    }
    if (!Array.isArray(p.images)) p.images = p.images ? [p.images] : [];
    if (!Array.isArray(p.videos)) p.videos = p.videos ? [p.videos] : [];
    if (!p.type) {
      p.type = 'buyers';
      changed = true;
    }
    return p;
  });

  if (changed) {
    console.log('Migration: updating properties.json to new format...');
    saveProperties(props);
  } else {
    console.log('Migration: no changes required.');
  }
}
migratePropertiesIfNeeded();

/* ---------------------- Routes ---------------------- */

// Simple sellers form endpoint (kept from your code)
app.post('/api/sellers/submit', async (req, res) => {
  try {
    console.log('Received form data:', req.body);
    const formData = req.body;
    if (!formData.name || !formData.phone || !formData.address) {
      return res.status(400).json({ error: 'Name, phone, and address are required' });
    }
    const filename = `${Date.now()}_${formData.name.replace(/\s+/g, '_')}.json`;
    fs.writeFileSync(path.join(sellersDataDir, filename), JSON.stringify(formData, null, 2), 'utf8');

    // send notification email (best-effort)
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'nirvanaestatess@gmail.com',
      subject: `New Property Submission from ${formData.name}`,
      text: `New property submission details:\n\nName: ${formData.name}\nPhone: ${formData.phone}\nAddress: ${formData.address}\nDescription: ${formData.description || 'N/A'}`
    };
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);
    } catch (err) {
      console.warn('Email send failed:', err);
    }

    res.json({ success: true, message: 'Form submitted successfully' });
  } catch (err) {
    console.error('/api/sellers/submit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: return all properties (admin UI uses this)
app.get('/admin/uploads', (req, res) => {
  try {
    res.json(readProperties());
  } catch (err) {
    console.error('GET /admin/upload error', err);
    res.status(500).json([]);
  }
});

// Serve admin upload HTML (password-protected by query param)
app.get('/admin/property-upload', (req, res) => {
  if (req.query.pass !== process.env.ADMIN_PASS) return res.status(403).send('Unauthorized');
  res.sendFile(path.join(__dirname, 'admin', 'property-upload.html'));
});

// Create property — accepts multiple images/videos
app.post('/admin/uploads', upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'videos', maxCount: 10 }
]), (req, res) => {
  try {
    const files = req.files || {};
    const imageFiles = files.images || [];
    const videoFiles = files.videos || [];

    console.log('Upload called. images:', imageFiles.length, 'videos:', videoFiles.length);

    const imagePaths = imageFiles.map(f => `/uploads/${f.filename}`);
    const videoPaths = videoFiles.map(f => `/uploads/${f.filename}`);

    if (imagePaths.length === 0 && videoPaths.length === 0) {
      return res.status(400).json({ error: 'At least one image or video is required' });
    }

    const props = readProperties();
    const id = uuidv4();
    const newProp = {
      id,
      title: req.body.title || '',
      description: req.body.description || '',
      type: req.body.type || 'buyers',
      images: imagePaths,
      videos: videoPaths
    };
    props.push(newProp);
    saveProperties(props);

    console.log('Saved new property id:', id);
    res.json({ success: true, id });
  } catch (err) {
    console.error('/admin/uploads error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get properties by type (buyers/sellers/rentals)
app.get('/properties/:type', (req, res) => {
  try {
    const all = readProperties();
    const filtered = all.filter(p => p.type === req.params.type);
    res.json(filtered);
  } catch (err) {
    console.error('GET /properties/:type error', err);
    res.status(500).json([]);
  }
});

// Get single property by id
app.get('/admin/uploads/:id', (req, res) => {
  try {
    const props = readProperties();
    const property = props.find(p => p.id === req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(property);
  } catch (err) {
    console.error('GET /admin/uploads/:id error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update property: append new images/videos or update metadata; optionally remove media
app.put('/admin/uploads/:id', upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'videos', maxCount: 10 }
]), (req, res) => {
  try {
    const props = readProperties();
    const index = props.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Property not found' });

    // Update text fields if provided
    if (req.body.title !== undefined) props[index].title = req.body.title;
    if (req.body.description !== undefined) props[index].description = req.body.description;
    if (req.body.type !== undefined) props[index].type = req.body.type;

    // Append newly uploaded files
    const files = req.files || {};
    if (files.images) {
      const newImgs = files.images.map(f => `/uploads/${f.filename}`);
      props[index].images = (props[index].images || []).concat(newImgs);
    }
    if (files.videos) {
      const newVids = files.videos.map(f => `/uploads/${f.filename}`);
      props[index].videos = (props[index].videos || []).concat(newVids);
    }

    // Support removing images/videos via body.removeImages/removeVideos (array or comma string)
    if (req.body.removeImages) {
      let removeList = req.body.removeImages;
      if (typeof removeList === 'string') {
        try { removeList = JSON.parse(removeList); } catch (e) {
          removeList = removeList.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      if (Array.isArray(removeList)) {
        props[index].images = (props[index].images || []).filter(i => !removeList.includes(i));
        // optional: delete files from disk (careful)
        removeList.forEach(rel => {
          const fp = path.join(__dirname, rel.replace(/^\//, ''));
          if (fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch (e) { console.warn('Failed to delete', fp, e); }
          }
        });
      }
    }
    if (req.body.removeVideos) {
      let removeList = req.body.removeVideos;
      if (typeof removeList === 'string') {
        try { removeList = JSON.parse(removeList); } catch (e) {
          removeList = removeList.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      if (Array.isArray(removeList)) {
        props[index].videos = (props[index].videos || []).filter(v => !removeList.includes(v));
        removeList.forEach(rel => {
          const fp = path.join(__dirname, rel.replace(/^\//, ''));
          if (fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch (e) { console.warn('Failed to delete', fp, e); }
          }
        });
      }
    }

    saveProperties(props);
    res.json({ success: true, property: props[index] });
  } catch (err) {
    console.error('PUT /admin/uploads/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete property by id (and optionally remove media files)
app.delete('/admin/delete/:id', (req, res) => {
  try {
    let props = readProperties();
    const index = props.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Property not found' });

    // Optionally delete media files from disk
    (props[index].images || []).forEach(rel => {
      const fp = path.join(__dirname, rel.replace(/^\//, ''));
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (e) { console.warn('Failed to delete', fp, e); }
      }
    });
    (props[index].videos || []).forEach(rel => {
      const fp = path.join(__dirname, rel.replace(/^\//, ''));
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (e) { console.warn('Failed to delete', fp, e); }
      }
    });

    props = props.filter(p => p.id !== req.params.id);
    saveProperties(props);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/delete/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Start server (single listen)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
