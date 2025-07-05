const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const PaperRequest = require('../models/PaperRequest');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { GridFSBucket } = require('mongodb');

// Middleware to check if user is admin or moderator
const requireAdminOrModerator = async (req, res, next) => {
  const userRole = req.headers['user-role'];
  if (!userRole || !['admin', 'moderator'].includes(userRole)) {
    return res.status(403).json({ message: 'Access denied. Admin or moderator privileges required.' });
  }
  next();
};

// Initialize GridFS
let gfs;
mongoose.connection.once('open', () => {
  gfs = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'papers'
  });
});

// Create a paper request
router.post('/request', async (req, res) => {
  try {
    const { paperId, userId, reason, paperTitle } = req.body;
    
    if (!paperId || !userId || !reason || !paperTitle) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if user has already requested this paper
    const existingRequest = await PaperRequest.findOne({ 
      paperId: new mongoose.Types.ObjectId(paperId),
      userId: new mongoose.Types.ObjectId(userId),
      status: { $in: ['pending', 'approved'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({ 
        message: existingRequest.status === 'pending' 
          ? 'You have already requested this paper. Your request is pending approval.' 
          : 'You already have access to this paper.' 
      });
    }
    
    const newRequest = new PaperRequest({
      paperId: new mongoose.Types.ObjectId(paperId),
      userId: new mongoose.Types.ObjectId(userId),
      reason,
      paperTitle
    });
    
    await newRequest.save();
    
    res.status(201).json({ 
      message: 'Paper request submitted successfully',
      requestId: newRequest._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all paper requests (admin/moderator access)
router.get('/admin/requests', requireAdminOrModerator, async (req, res) => {
  try {
    const requests = await PaperRequest.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'email firstName lastName');
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pending paper requests (admin/moderator access)
router.get('/admin/requests/pending', requireAdminOrModerator, async (req, res) => {
  try {
    const pendingRequests = await PaperRequest.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('userId', 'email firstName lastName');
    
    res.json(pendingRequests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process a paper request (admin/moderator access)
router.put('/admin/requests/:requestId', requireAdminOrModerator, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, adminId, adminMessage } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const request = await PaperRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Update request status
    request.status = status;
    request.processedDate = new Date();
    request.processedBy = adminId;
    if (adminMessage) request.adminMessage = adminMessage;
    
    await request.save();
    
    // Get user email for notifications
    const user = await User.findById(request.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Requesting user not found' });
    }
    
    // Send status notification email
    await emailService.sendRequestStatusEmail(
      user.email,
      request.paperTitle,
      status,
      adminMessage
    );
    
    // If approved, send paper via email
    if (status === 'approved') {
      // Increment download count in papers.files collection
      await mongoose.connection.db.collection('papers.files').updateOne(
        { _id: new mongoose.Types.ObjectId(request.paperId) },
        { $inc: { 'metadata.downloadCount': 1 } }
      );

      // Find the paper in GridFS
      const files = await gfs.find({ 
        _id: new mongoose.Types.ObjectId(request.paperId) 
      }).toArray();
      
      if (!files || files.length === 0) {
        return res.status(404).json({ message: 'Paper not found' });
      }
      
      const file = files[0];
      
      // Download file content from GridFS
      const chunks = [];
      const downloadStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(request.paperId));
      
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      downloadStream.on('error', (error) => {
        return res.status(500).json({ message: 'Download failed', error: error.message });
      });
      
      downloadStream.on('end', async () => {
        try {
          const paperContent = Buffer.concat(chunks);
          
          // Send email with attachment
          await emailService.sendPaperAccessEmail(
            user.email,
            {
              title: file.metadata.title,
              authors: file.metadata.authors,
              journal: file.metadata.journal,
              year: file.metadata.year,
              doi: file.metadata.doi,
              filename: file.filename,
              contentType: file.metadata.contentType
            },
            paperContent,
            adminMessage
          );
          
          res.json({ message: 'Request processed successfully' });
        } catch (error) {
          res.status(500).json({ message: 'Failed to send email', error: error.message });
        }
      });
    } else {
      res.json({ message: 'Request processed successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's paper requests
router.get('/user/:userId/requests', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const requests = await PaperRequest.find({ userId })
      .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
