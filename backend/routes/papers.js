
const express = require('express');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const router = express.Router();

let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.log('pdf-parse not installed. Content analysis will be limited.');
  pdfParse = null;
}

const requireAdminOrModerator = async (req, res, next) => {
  const userRole = req.headers['user-role'];
  if (!userRole || !['admin', 'moderator'].includes(userRole)) {
    return res.status(403).json({ message: 'Access denied. Admin or moderator privileges required.' });
  }
  next();
};

const requireAdminOnly = async (req, res, next) => {
  const userRole = req.headers['user-role'];
  if (!userRole || userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileSize: 15 * 1024 * 1024,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

let gfs;
mongoose.connection.once('open', () => {
  gfs = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'papers'
  });
});

const extractPDFText = async (fileBuffer) => {
  if (!pdfParse) {
    console.log('pdf-parse not available - content analysis disabled');
    return null;
  }
  
  try {
    console.log('Extracting PDF text...');
    const data = await pdfParse(fileBuffer);
    const text = data.text || '';
    console.log(`PDF text extracted: ${text.length} characters`);
    return text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return null;
  }
};

const generateContentFingerprint = (text) => {
  if (!text) return null;
  
  const normalizedText = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);
  
  const words = normalizedText.split(' ').filter(word => 
    word.length > 3 && !commonWords.has(word)
  );
  
  const significantWords = words.slice(0, 100).sort();
  return significantWords.join(' ');
};

const calculateContentSimilarity = (text1, text2) => {
  if (!text1 || !text2) return 0;
  
  const fingerprint1 = generateContentFingerprint(text1);
  const fingerprint2 = generateContentFingerprint(text2);
  
  if (!fingerprint1 || !fingerprint2) return 0;
  
  const words1 = new Set(fingerprint1.split(' '));
  const words2 = new Set(fingerprint2.split(' '));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

const checkForDuplicates = async (fileBuffer, title, doi, userId, filename) => {
  try {
    console.log('Starting duplicate check...');
    
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    console.log('File hash generated:', fileHash.substring(0, 10) + '...');
    
    const pdfText = await extractPDFText(fileBuffer);
    console.log('PDF text available:', !!pdfText, 'Length:', pdfText ? pdfText.length : 0);
    
    const existingFiles = await gfs.find({}).toArray();
    console.log('Checking against', existingFiles.length, 'existing papers');
    
    for (const file of existingFiles) {
      if (file.metadata.fileHash && file.metadata.fileHash === fileHash) {
        console.log('Exact file hash match found');
        return {
          isDuplicate: true,
          reason: 'Duplicate file content detected',
          existingPaper: {
            id: file._id,
            title: file.metadata.title,
            authors: file.metadata.authors,
            uploadDate: file.metadata.uploadDate
          }
        };
      }
    }
    
    if (title) {
      const titleDuplicate = await gfs.find({ 
        'metadata.userId': userId 
      }).toArray();
      
      const exactMatch = titleDuplicate.find(file => 
        file.metadata.title && 
        file.metadata.title.toLowerCase().trim() === title.toLowerCase().trim()
      );
      
      if (exactMatch) {
        return {
          isDuplicate: true,
          reason: 'You have already uploaded a paper with this title',
          existingPaper: {
            id: exactMatch._id,
            title: exactMatch.metadata.title,
            authors: exactMatch.metadata.authors,
            uploadDate: exactMatch.metadata.uploadDate
          }
        };
      }
    }
    
    if (doi && doi.trim() !== '') {
      const doiDuplicate = await gfs.find({ 'metadata.doi': doi }).toArray();
      
      if (doiDuplicate.length > 0) {
        return {
          isDuplicate: true,
          reason: 'A paper with this DOI already exists',
          existingPaper: {
            id: doiDuplicate[0]._id,
            title: doiDuplicate[0].metadata.title,
            authors: doiDuplicate[0].metadata.authors,
            doi: doiDuplicate[0].metadata.doi,
            uploadDate: doiDuplicate[0].metadata.uploadDate
          }
        };
      }
    }
    
    if (filename) {
      const filenameDuplicate = await gfs.find({ 
        'metadata.userId': userId,
        'filename': filename 
      }).toArray();
      
      if (filenameDuplicate.length > 0) {
        return {
          isDuplicate: true,
          reason: 'You have already uploaded a file with this name',
          existingPaper: {
            id: filenameDuplicate[0]._id,
            title: filenameDuplicate[0].metadata.title,
            authors: filenameDuplicate[0].metadata.authors,
            uploadDate: filenameDuplicate[0].metadata.uploadDate
          }
        };
      }
    }
    
    if (title) {
      const allPapers = await gfs.find({}).toArray();
      for (const paper of allPapers) {
        if (paper.metadata.title) {
          const similarity = calculateSimilarity(title.toLowerCase(), paper.metadata.title.toLowerCase());
          if (similarity > 0.9) {
            return {
              isDuplicate: true,
              reason: 'A very similar paper title already exists',
              existingPaper: {
                id: paper._id,
                title: paper.metadata.title,
                authors: paper.metadata.authors,
                uploadDate: paper.metadata.uploadDate
              }
            };
          }
        }
      }
    }
    
    if (pdfText && pdfText.length > 100) {
      console.log('Starting content similarity analysis...');
      const allPapers = await gfs.find({}).toArray();
      for (const paper of allPapers) {
        if (paper.metadata.userId === userId) continue;
        
        let existingContentFingerprint = paper.metadata.contentFingerprint;
        console.log(`Paper ${paper.metadata.title}: has fingerprint: ${!!existingContentFingerprint}`);
        
        if (!existingContentFingerprint && paper.metadata.contentType === 'application/pdf') {
          console.log(`Extracting content fingerprint for paper: ${paper.metadata.title}`);
          try {
            const downloadStream = gfs.openDownloadStream(paper._id);
            const chunks = [];
            
            await new Promise((resolve, reject) => {
              downloadStream.on('data', (chunk) => {
                chunks.push(chunk);
              });
              
              downloadStream.on('end', async () => {
                try {
                  const existingFileBuffer = Buffer.concat(chunks);
                  const existingPdfText = await extractPDFText(existingFileBuffer);
                  if (existingPdfText) {
                    existingContentFingerprint = generateContentFingerprint(existingPdfText);
                    console.log(`Generated fingerprint for ${paper.metadata.title}: ${existingContentFingerprint ? 'success' : 'failed'}`);
                    
                    await mongoose.connection.db.collection('papers.files').updateOne(
                      { _id: paper._id },
                      { $set: { 'metadata.contentFingerprint': existingContentFingerprint } }
                    );
                  }
                  resolve();
                } catch (error) {
                  console.error('Error processing existing paper content:', error);
                  resolve();
                }
              });
              
              downloadStream.on('error', (error) => {
                console.error('Error downloading existing paper:', error);
                resolve();
              });
            });
          } catch (error) {
            console.error('Error processing paper for content comparison:', error);
            continue;
          }
        }
        
        if (existingContentFingerprint) {
          const contentSimilarity = calculateContentSimilarity(pdfText, existingContentFingerprint);
          console.log(`Content similarity with ${paper.metadata.title}: ${contentSimilarity.toFixed(3)}`);
          if (contentSimilarity > 0.7) {
            console.log('High content similarity detected!');
            return {
              isDuplicate: true,
              reason: 'Very similar paper content detected',
              existingPaper: {
                id: paper._id,
                title: paper.metadata.title,
                authors: paper.metadata.authors,
                uploadDate: paper.metadata.uploadDate
              }
            };
          }
        }
      }
    } else {
      console.log('Skipping content analysis - insufficient text or no PDF text available');
    }
    
    console.log('Duplicate check completed - no duplicates found');
    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return { isDuplicate: false };
  }
};

const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

const validateFileContent = async (fileBuffer, filename, contentType) => {
  try {
    console.log('Validating file content...');
    
    if (!fileBuffer || fileBuffer.length === 0) {
      return {
        isValid: false,
        reason: 'The uploaded file is empty or corrupted. Please check your file and try again.',
        errorType: 'EMPTY_FILE'
      };
    }
    
    const minSize = 1024;
    if (fileBuffer.length < minSize) {
      return {
        isValid: false,
        reason: `The uploaded file is too small (${fileBuffer.length} bytes). Research papers should be at least ${minSize} bytes. Please upload a complete document.`,
        errorType: 'FILE_TOO_SMALL'
      };
    }
    
    if (contentType === 'application/pdf') {
      const pdfHeader = fileBuffer.toString('ascii', 0, 4);
      if (pdfHeader !== '%PDF') {
        return {
          isValid: false,
          reason: 'The uploaded file is not a valid PDF document. Please ensure you are uploading a properly formatted PDF file.',
          errorType: 'INVALID_PDF_FORMAT'
        };
      }
      
      const pdfText = await extractPDFText(fileBuffer);
      if (!pdfText || pdfText.trim().length === 0) {
        return {
          isValid: false,
          reason: 'The PDF file contains no readable text content. This might be a scanned document or image-only PDF. Please upload a PDF with selectable text content.',
          errorType: 'NO_READABLE_TEXT'
        };
      }
      
      const minTextLength = 100;
      if (pdfText.trim().length < minTextLength) {
        return {
          isValid: false,
          reason: `The PDF contains insufficient text content (${pdfText.trim().length} characters). Research papers should have substantial text content (at least ${minTextLength} characters). Please upload a complete research document.`,
          errorType: 'INSUFFICIENT_TEXT_CONTENT'
        };
      }
      
      const lowerText = pdfText.toLowerCase();
      const researchIndicators = [
        'abstract',
        'introduction',
        'methodology',
        'results',
        'conclusion',
        'references',
        'bibliography',
        'research',
        'study',
        'analysis',
        'data',
        'findings',
        'discussion'
      ];
      
      const foundIndicators = researchIndicators.filter(indicator => 
        lowerText.includes(indicator)
      );
      
      if (foundIndicators.length < 4) {
        const missingIndicators = researchIndicators.filter(indicator => 
          !foundIndicators.includes(indicator)
        );
        
        let specificReason = '';
        if (foundIndicators.length === 0) {
          specificReason = 'This document does not appear to be a research paper. Please upload an academic paper with proper research structure (abstract, introduction, methodology, etc.).';
        } else if (foundIndicators.length === 1) {
          specificReason = `This document lacks proper research structure. Found only: "${foundIndicators[0]}". Research papers should include sections like abstract, introduction, methodology, results, and conclusion.`;
        } else {
          specificReason = `This document has insufficient research content. Found: "${foundIndicators.join(', ')}". Research papers should include at least 4 of: abstract, introduction, methodology, results, conclusion, references, etc.`;
        }
        
        return {
          isValid: false,
          reason: specificReason,
          errorType: 'NON_RESEARCH_CONTENT',
          foundIndicators: foundIndicators,
          missingIndicators: missingIndicators
        };
      }
      
      const emptyIndicators = [
        'blank page',
        'empty document',
        'no content',
        'this page intentionally left blank',
        'test document',
        'sample file',
        'placeholder',
        'draft document'
      ];
      
      for (const indicator of emptyIndicators) {
        if (lowerText.includes(indicator)) {
          let specificReason = '';
          if (indicator === 'test document' || indicator === 'sample file') {
            specificReason = 'Test files are not allowed. Please upload your actual research paper.';
          } else if (indicator === 'blank page' || indicator === 'empty document' || indicator === 'no content') {
            specificReason = 'Empty documents are not allowed. Please upload a document with actual content.';
          } else if (indicator === 'placeholder' || indicator === 'draft document') {
            specificReason = 'Placeholder or draft documents are not allowed. Please upload your final research paper.';
          } else {
            specificReason = 'This document appears to be empty or incomplete. Please upload a complete research paper.';
          }
          
          return {
            isValid: false,
            reason: specificReason,
            errorType: 'EMPTY_OR_TEST_DOCUMENT'
          };
        }
      }
      
      console.log(`PDF validation passed: ${pdfText.length} characters of content`);
      return {
        isValid: true,
        contentLength: pdfText.length,
        preview: pdfText.substring(0, 200) + '...'
      };
    }
    
    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const zipHeader = fileBuffer.toString('hex', 0, 4);
      if (zipHeader !== '504b0304') {
        return {
          isValid: false,
          reason: 'Invalid DOCX file format'
        };
      }
      
      console.log('DOCX validation passed: valid file structure');
      return {
        isValid: true,
        contentLength: fileBuffer.length
      };
    }
    
    if (contentType === 'application/msword') {
      const docHeader = fileBuffer.toString('hex', 0, 8);
      if (!docHeader.startsWith('d0cf11e0')) {
        return {
          isValid: false,
          reason: 'Invalid DOC file format'
        };
      }
      
      console.log('DOC validation passed: valid file structure');
      return {
        isValid: true,
        contentLength: fileBuffer.length
      };
    }
    
    return {
      isValid: true,
      contentLength: fileBuffer.length
    };
    
  } catch (error) {
    console.error('Error validating file content:', error);
    return {
      isValid: false,
      reason: 'Error validating file content: ' + error.message
    };
  }
};

router.post('/upload', upload.single('paper'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { userId, title, description, journal, year, authors, tags, doi, publisher, sdgs } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    let parsedAuthors = [];
    let parsedTags = [];
    let parsedSDGs = [];
    
    try {
      if (authors) parsedAuthors = JSON.parse(authors);
      if (tags) parsedTags = JSON.parse(tags);
      if (sdgs) parsedSDGs = JSON.parse(sdgs);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid authors, tags, or sdgs format' });
    }

    const contentValidation = await validateFileContent(req.file.buffer, req.file.originalname, req.file.mimetype);
    
    if (!contentValidation.isValid) {
      return res.status(400).json({
        message: 'File content validation failed',
        reason: contentValidation.reason,
        error: 'INVALID_FILE_CONTENT'
      });
    }

    console.log('File content validation passed:', contentValidation);

    const duplicateCheck = await checkForDuplicates(req.file.buffer, title, doi, userId, req.file.originalname);
    
    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({
        message: 'Duplicate paper detected',
        reason: duplicateCheck.reason,
        existingPaper: duplicateCheck.existingPaper,
        error: 'DUPLICATE_PAPER'
      });
    }

    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    
    const pdfText = await extractPDFText(req.file.buffer);
    const contentFingerprint = pdfText ? generateContentFingerprint(pdfText) : null;

    const uploadStream = gfs.openUploadStream(req.file.originalname, {
      metadata: {
        userId: userId,
        title: title || req.file.originalname,
        description: description || '',
        journal: journal || '',
        year: year || new Date().getFullYear().toString(),
        publisher: publisher || '',
        authors: parsedAuthors,
        tags: parsedTags,
        sdgs: parsedSDGs,
        doi: doi === '' ? '' : (doi || `DOI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
        uploadDate: new Date(),
        contentType: req.file.mimetype,
        size: req.file.size,
        fileHash: fileHash,
        contentFingerprint: contentFingerprint,
        impact: 0,
        clarity: 0,
        likes: 0,
        dislikes: 0,
        comments: 0,
        citationCount: 0,
        downloadCount: 0,
        userLikes: [],
        userDislikes: [],
        paperComments: []
      }
    });

    uploadStream.on('finish', () => {
      res.status(201).json({
        message: 'File uploaded successfully',
        fileId: uploadStream.id,
        filename: req.file.originalname,
        size: req.file.size
      });
    });

    uploadStream.on('error', (error) => {
      res.status(500).json({ message: 'Upload failed', error: error.message });
    });

    uploadStream.end(req.file.buffer);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const ownedFiles = await gfs.find({ 'metadata.userId': userId }).toArray();
    
    const coauthorFiles = await gfs.find({ 'metadata.authors.userId': userId }).toArray();
    
    const allPaperFiles = [...ownedFiles];
    
    coauthorFiles.forEach(file => {
      if (!allPaperFiles.some(existingFile => existingFile._id.toString() === file._id.toString())) {
        allPaperFiles.push(file);
      }
    });
    
    const papers = allPaperFiles.map(file => {
      const isOwner = file.metadata.userId === userId;
      const isCoAuthor = file.metadata.authors && 
                        file.metadata.authors.some(author => 
                          author.userId === userId
                        );
      
      return {
        id: file._id,
        filename: file.filename,
        title: file.metadata.title,
        description: file.metadata.description,
        abstract: file.metadata.description,
        journal: file.metadata.journal,
        year: file.metadata.year,
        publisher: file.metadata.publisher || '',
        authors: file.metadata.authors || [],
        tags: file.metadata.tags || [],
        sdgs: file.metadata.sdgs || [],
        doi: file.metadata.doi,
        uploadDate: file.metadata.uploadDate,
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        impact: file.metadata.impact || 0,
        clarity: file.metadata.clarity || 0,
        likes: file.metadata.likes || 0,
        dislikes: file.metadata.dislikes || 0,
        comments: file.metadata.comments || 0,
        isOwner: isOwner,
        isCoAuthor: isCoAuthor && !isOwner
      };
    });

    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId, preview } = req.query;

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }
    const file = files[0];

    let hasPermission = false;
    let isAdmin = false;
    if (userId) {
      const user = await User.findById(userId);
      if (user && ['admin', 'moderator'].includes(user.role)) {
        hasPermission = true;
        isAdmin = true;
      } else if (file.metadata.userId === userId) {
        hasPermission = true;
      } else {
        const isCoAuthor = file.metadata.authors && 
                          file.metadata.authors.some(author => 
                            author.userId === userId
                          );
        if (isCoAuthor) {
          hasPermission = true;
        } else {
          const PaperRequest = require('../models/PaperRequest');
          const approvedRequest = await PaperRequest.findOne({
            paperId: new mongoose.Types.ObjectId(fileId),
            userId: new mongoose.Types.ObjectId(userId),
            status: 'approved'
          });
          
          if (approvedRequest) {
            hasPermission = true;
          }
        }
      }
    }
    if (preview === 'true' && userId) {
      const user = await User.findById(userId);
      if (user && ['admin', 'moderator'].includes(user.role)) {
        hasPermission = true;
        isAdmin = true;
      }
    }
    if (preview === 'true' && !userId) {
      hasPermission = true;
      isAdmin = true;
    }
    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied. You need permission to preview this paper.' });
    }

    res.set({
      'Content-Type': file.metadata.contentType,
      'Content-Disposition': preview === 'true' ? `inline; filename="${file.filename}"` : `attachment; filename="${file.filename}"`
    });

    const downloadStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    downloadStream.on('error', (error) => {
      res.status(500).json({ message: 'Download failed', error: error.message });
    });
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.body;

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];

    if (file.metadata.userId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await gfs.delete(new mongoose.Types.ObjectId(fileId));
    
    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { 
      userId, 
      title, 
      description, 
      abstract,
      journal, 
      year, 
      publisher, 
      authors, 
      tags, 
      keywords,
      sdgs, 
      doi,
      isPublished,
      references,
      conferenceProceeding
    } = req.body;

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];

    const isOwner = file.metadata.userId === userId;
    const isCoAuthor = file.metadata.authors && 
                      file.metadata.authors.some(author => 
                        author.userId === userId
                      );
    
    if (!isOwner && !isCoAuthor) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedTags = tags || keywords || file.metadata.tags;

    await mongoose.connection.db.collection('papers.files').updateOne(
      { _id: new mongoose.Types.ObjectId(fileId) },
      { 
        $set: { 
          'metadata.title': title || file.metadata.title,
          'metadata.description': description || abstract || file.metadata.description,
          'metadata.journal': journal || file.metadata.journal,
          'metadata.year': year || file.metadata.year,
          'metadata.publisher': publisher || file.metadata.publisher,
          'metadata.authors': authors || file.metadata.authors,
          'metadata.tags': updatedTags,
          'metadata.sdgs': sdgs || file.metadata.sdgs,
          'metadata.doi': doi === '' ? '' : (doi || file.metadata.doi),
          'metadata.isPublished': isPublished !== undefined ? isPublished : file.metadata.isPublished,
          'metadata.references': references || file.metadata.references,
          'metadata.conferenceProceeding': conferenceProceeding !== undefined ? conferenceProceeding : file.metadata.conferenceProceeding
        } 
      }
    );
    
    res.json({ 
      message: 'File updated successfully',
      fileId: fileId
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/public', async (req, res) => {
  try {
    const { userId } = req.query;
    const files = await gfs.find({}).toArray();
    
    const userIds = [...new Set(files.map(file => file.metadata.userId).filter(id => id))];
    const users = await User.find({ _id: { $in: userIds } }).select('_id department');
    const userDepartmentMap = {};
    users.forEach(user => {
      userDepartmentMap[user._id.toString()] = user.department;
    });

    const papers = files.map(file => {
      let isCoAuthor = false;
      if (userId && file.metadata.authors) {
        isCoAuthor = file.metadata.authors.some(author => 
          author.userId === userId
        );
      }

      return {
        id: file._id,
        title: file.metadata.title,
        journal: file.metadata.journal || 'Unknown Journal',
        year: file.metadata.year || new Date().getFullYear().toString(),
        publisher: file.metadata.publisher || '',
        doi: file.metadata.doi || 'DOI link',
        authors: file.metadata.authors || [],
        abstract: file.metadata.description || 'No abstract available.',
        tags: file.metadata.tags || [],
        sdgs: file.metadata.sdgs || [],
        impact: file.metadata.impact || (Math.random() * 2 + 3).toFixed(1),
        clarity: file.metadata.clarity || (Math.random() * 2 + 3).toFixed(1),
        likes: file.metadata.likes || 0,
        dislikes: file.metadata.dislikes || 0,
        comments: (file.metadata.paperComments || []).length,
        citationCount: file.metadata.citationCount || 0,
        downloadCount: file.metadata.downloadCount || 0,
        uploadDate: file.metadata.uploadDate,
        filename: file.filename,
        size: file.metadata.size,
        ownerDepartment: userDepartmentMap[file.metadata.userId] || 'Unknown',
        isCoAuthor: isCoAuthor
      };
    });

    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/admin/all', requireAdminOrModerator, async (req, res) => {
  try {
    const files = await gfs.find({}).toArray();      const papers = files.map(file => ({
      id: file._id,
      filename: file.filename,
      title: file.metadata.title,
      description: file.metadata.description,
      journal: file.metadata.journal,
      year: file.metadata.year,
      publisher: file.metadata.publisher || '',
      authors: file.metadata.authors || [],
      tags: file.metadata.tags || [],
      sdgs: file.metadata.sdgs || [],
      doi: file.metadata.doi,
      userId: file.metadata.userId,
      uploadDate: file.metadata.uploadDate,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      impact: file.metadata.impact || 0,
      clarity: file.metadata.clarity || 0,
      likes: file.metadata.likes || 0,
      dislikes: file.metadata.dislikes || 0,
      comments: file.metadata.comments || 0
    }));

    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/test-content-validation', upload.single('testFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded for testing'
      });
    }
    
    const validation = await validateFileContent(req.file.buffer, req.file.originalname, req.file.mimetype);
    
    res.json({
      status: validation.isValid ? 'success' : 'error',
      validation: validation,
      fileInfo: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error testing content validation',
      error: error.message
    });
  }
});

router.get('/test-pdf-parse', async (req, res) => {
  try {
    if (!pdfParse) {
      return res.json({
        status: 'error',
        message: 'pdf-parse library not installed',
        instruction: 'Run: npm install pdf-parse'
      });
    }
    
    res.json({
      status: 'success',
      message: 'pdf-parse library is available and ready for content analysis',
      version: require('pdf-parse/package.json').version
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error testing pdf-parse',
      error: error.message
    });
  }
});

router.get('/test-validation-messages', async (req, res) => {
  try {
    const testErrors = [
      {
        errorType: 'EMPTY_OR_TEST_DOCUMENT',
        reason: 'Test files are not allowed. Please upload your actual research paper.',
        message: '⚠️ Test files are not allowed. Please upload your actual research paper.'
      },
      {
        errorType: 'NON_RESEARCH_CONTENT',
        reason: 'This document does not appear to be a research paper. Please upload an academic paper with proper research structure (abstract, introduction, methodology, etc.).',
        message: '📄 This document does not appear to be a research paper. Please upload an academic paper with proper research structure (abstract, introduction, methodology, etc.).'
      },
      {
        errorType: 'EMPTY_FILE',
        reason: 'The uploaded file is empty or corrupted. Please check your file and try again.',
        message: '📁 The uploaded file is empty or corrupted. Please check your file and try again.'
      },
      {
        errorType: 'INVALID_PDF_FORMAT',
        reason: 'The uploaded file is not a valid PDF document. Please ensure you are uploading a properly formatted PDF file.',
        message: '📄 The uploaded file is not a valid PDF document. Please ensure you are uploading a properly formatted PDF file.'
      }
    ];
    
    res.json({
      success: true,
      message: 'Enhanced error messages are working',
      testErrors: testErrors
    });
  } catch (error) {
    console.error('Test validation messages error:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

router.get('/get-users-for-author-selection', async (req, res) => {
  try {
    console.log('Fetching users for co-author selection...');
    
    const users = await User.find(
      { status: 'approved' },
      '-password'
    ).lean();
    
    console.log(`Successfully retrieved ${users.length} users`);
    
    res.json(users);
  } catch (error) {
    console.error('Error in get-users-for-author-selection:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:paperId', async (req, res) => {
  try {
    const { paperId } = req.params;
    
    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(paperId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const file = files[0];    const paper = {
      id: file._id,
      filename: file.filename,
      title: file.metadata.title,
      description: file.metadata.description,
      journal: file.metadata.journal,
      year: file.metadata.year,
      publisher: file.metadata.publisher || '',
      authors: file.metadata.authors || [],
      tags: file.metadata.tags || [],
      sdgs: file.metadata.sdgs || [],
      doi: file.metadata.doi,
      userId: file.metadata.userId,
      uploadDate: file.metadata.uploadDate,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      impact: file.metadata.impact || 0,
      clarity: file.metadata.clarity || 0,
      likes: file.metadata.likes || 0,
      dislikes: file.metadata.dislikes || 0,
      userLikes: file.metadata.userLikes || [],
      userDislikes: file.metadata.userDislikes || [],
      comments: file.metadata.paperComments || []
    };

    res.json(paper);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:paperId/like', async (req, res) => {
  try {
    const { paperId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(paperId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const file = files[0];
    const userLikes = file.metadata.userLikes || [];
    const userDislikes = file.metadata.userDislikes || [];
    
    if (userLikes.includes(userId)) {
      return res.status(400).json({ message: 'You have already liked this paper' });
    }
    const updatedDislikes = userDislikes.filter(id => id !== userId);
    const updatedLikes = [...userLikes, userId];

    await mongoose.connection.db.collection('papers.files').updateOne(
      { _id: new mongoose.Types.ObjectId(paperId) },
      { 
        $set: { 
          'metadata.userLikes': updatedLikes,
          'metadata.userDislikes': updatedDislikes,
          'metadata.likes': updatedLikes.length,
          'metadata.dislikes': updatedDislikes.length
        }
      }
    );

    res.json({ 
      message: 'Paper liked successfully',
      likes: updatedLikes.length,
      dislikes: updatedDislikes.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:paperId/dislike', async (req, res) => {
  try {
    const { paperId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ message: 'User authentication required' });
    }

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(paperId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const file = files[0];
    const userLikes = file.metadata.userLikes || [];
    const userDislikes = file.metadata.userDislikes || [];
    
    if (userDislikes.includes(userId)) {
      return res.status(400).json({ message: 'You have already disliked this paper' });
    }
    const updatedLikes = userLikes.filter(id => id !== userId);
    const updatedDislikes = [...userDislikes, userId];

    await mongoose.connection.db.collection('papers.files').updateOne(
      { _id: new mongoose.Types.ObjectId(paperId) },
      { 
        $set: { 
          'metadata.userLikes': updatedLikes,
          'metadata.userDislikes': updatedDislikes,
          'metadata.likes': updatedLikes.length,
          'metadata.dislikes': updatedDislikes.length
        }
      }
    );

    res.json({ 
      message: 'Paper disliked successfully',
      likes: updatedLikes.length,
      dislikes: updatedDislikes.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:paperId/comment', async (req, res) => {
  try {
    const { paperId } = req.params;
    const { userId, userEmail, content, parentCommentId } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({ message: 'User ID and content are required' });
    }

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(paperId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const file = files[0];
    const existingComments = file.metadata.paperComments || [];
    
    const newComment = {
      id: new mongoose.Types.ObjectId().toString(),
      userId,
      userEmail,
      content,
      timestamp: new Date(),
      parentCommentId: parentCommentId || null
    };    const updatedComments = [...existingComments, newComment];

    await mongoose.connection.db.collection('papers.files').updateOne(
      { _id: new mongoose.Types.ObjectId(paperId) },
      { 
        $set: { 
          'metadata.paperComments': updatedComments,
          'metadata.comments': updatedComments.length
        }
      }
    );

    res.json({ 
      message: 'Comment added successfully',
      comment: newComment,
      totalComments: updatedComments.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:paperId/download-permission', async (req, res) => {
  try {
    const { paperId } = req.params;
    const { userId } = req.query;

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(paperId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const file = files[0];
    
    let canDownload = false;
    let reason = '';

    if (!userId) {
      reason = 'Please sign in to preview papers';
    } else {
      const user = await User.findById(userId);
      
      if (!user) {
        reason = 'User not found';
      } else if (['admin', 'moderator'].includes(user.role)) {
        canDownload = true;
        reason = user.role === 'admin' ? 'Admin access' : 'Moderator access';
      } else if (file.metadata.userId === userId) {
        canDownload = true;
        reason = 'Paper owner access';
      } else {
        const isCoAuthor = file.metadata.authors && 
                          file.metadata.authors.some(author => 
                            author.userId === userId
                          );
        
        if (isCoAuthor) {
          canDownload = true;
          reason = 'Co-author access';
        } else {
          const PaperRequest = require('../models/PaperRequest');
          const approvedRequest = await PaperRequest.findOne({
            paperId: new mongoose.Types.ObjectId(paperId),
            userId: new mongoose.Types.ObjectId(userId),
            status: 'approved'
          });
          
          if (approvedRequest) {
            canDownload = true;
            reason = 'Approved paper request';
          } else {
            reason = 'You need to request access from the administrator to preview this paper';
          }
        }
      }
    }

    res.json({ 
      canDownload,
      reason,
      paperTitle: file.metadata.title
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.delete('/admin/papers/:paperId', requireAdminOnly, async (req, res) => {
  try {
    const { paperId } = req.params;

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(paperId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    await gfs.delete(new mongoose.Types.ObjectId(paperId));

    res.json({ message: 'Paper deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/admin/papers/:paperId', requireAdminOrModerator, async (req, res) => {
  try {
    const { paperId } = req.params;
    const { title, description, journal, year, publisher, authors, tags, sdgs, doi } = req.body;

    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(paperId) }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    const file = files[0];

    const updatedMetadata = {
      ...file.metadata,
      title: title || file.metadata.title,
      description: description || file.metadata.description,
      journal: journal || file.metadata.journal,
      year: year || file.metadata.year,
      publisher: publisher || file.metadata.publisher,
      authors: authors || file.metadata.authors,
      tags: tags || file.metadata.tags,
      sdgs: sdgs || file.metadata.sdgs,
      doi: doi || file.metadata.doi,
      lastModified: new Date()
    };

    await mongoose.connection.db.collection('papers.files').updateOne(
      { _id: new mongoose.Types.ObjectId(paperId) },
      { $set: { metadata: updatedMetadata } }
    );

    res.json({ message: 'Paper updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/track-citation/:paperId', async (req, res) => {
  try {
    const { paperId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({ message: 'Invalid paper ID' });
    }

    const result = await mongoose.connection.db.collection('papers.files').updateOne(
      { _id: new mongoose.Types.ObjectId(paperId) },
      { $inc: { 'metadata.citationCount': 1 } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    res.json({ message: 'Citation tracked successfully' });
  } catch (error) {
    console.error('Error tracking citation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/admin/stats', requireAdminOrModerator, async (req, res) => {
  try {
    const papers = await mongoose.connection.db.collection('papers.files').find({}).toArray();
    
    let csCount = 0;
    let itCount = 0;
    let totalCitations = 0;
    let totalDownloads = 0;
    
    const sdgStats = {};
    const sdgMapping = {
      '1': 'SDG 1: No Poverty',
      '2': 'SDG 2: Zero Hunger',
      '3': 'SDG 3: Good Health and Well-being',
      '4': 'SDG 4: Quality Education',
      '5': 'SDG 5: Gender Equality',
      '6': 'SDG 6: Clean Water and Sanitation',
      '7': 'SDG 7: Affordable and Clean Energy',
      '8': 'SDG 8: Decent Work and Economic Growth',
      '9': 'SDG 9: Industry, Innovation and Infrastructure',
      '10': 'SDG 10: Reduced Inequality',
      '11': 'SDG 11: Sustainable Cities and Communities',
      '12': 'SDG 12: Responsible Consumption and Production',
      '13': 'SDG 13: Climate Action',
      '14': 'SDG 14: Life Below Water',
      '15': 'SDG 15: Life on Land',
      '16': 'SDG 16: Peace and Justice Strong Institutions',
      '17': 'SDG 17: Partnerships to achieve the Goal'
    };

    for (let i = 1; i <= 17; i++) {
      sdgStats[`sdg${i}`] = {
        count: 0,
        name: sdgMapping[i.toString()],
        papers: []
      };
    }

    for (const paper of papers) {
      if (paper.metadata.userId) {
        const owner = await User.findById(paper.metadata.userId);
        if (owner) {
          if (owner.department === 'Computer Science') {
            csCount++;
          } else if (owner.department === 'Information Technology') {
            itCount++;
          }
        }
      }

      totalCitations += paper.metadata.citationCount || 0;
      totalDownloads += paper.metadata.downloadCount || 0;
      
      if (paper.metadata.sdgs && Array.isArray(paper.metadata.sdgs)) {
        paper.metadata.sdgs.forEach(sdg => {
          let sdgNumber = null;
          
          if (typeof sdg === 'string') {
            const match = sdg.match(/(\d+)/);
            if (match) sdgNumber = match[1];
          } else if (typeof sdg === 'number') {
            sdgNumber = sdg.toString();
          } else if (typeof sdg === 'object' && sdg !== null) {
            const id = sdg.id || sdg.value || sdg.number;
            if (id) {
              if (typeof id === 'number') {
                sdgNumber = id.toString();
              } else {
                const match = String(id).match(/(\d+)/);
                if (match) sdgNumber = match[1];
              }
            }
          }
          
          if (sdgNumber && sdgStats[`sdg${sdgNumber}`]) {
            sdgStats[`sdg${sdgNumber}`].count++;
            sdgStats[`sdg${sdgNumber}`].papers.push({
              id: paper._id,
              title: paper.metadata.title,
              authors: paper.metadata.authors || [],
              year: paper.metadata.year,
              journal: paper.metadata.journal
            });
          }
        });
      }
    }

    res.json({
      computerSciencePapers: csCount,
      informationTechnologyPapers: itCount,
      totalCitations,
      totalDownloads,
      sdgStats
    });
  } catch (error) {
    console.error('Error getting paper stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/admin/update-content-fingerprints', requireAdminOrModerator, async (req, res) => {
  try {
    console.log('Starting content fingerprint update for existing papers...');
    
    const allPapers = await gfs.find({}).toArray();
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const paper of allPapers) {
      try {
        if (paper.metadata.contentFingerprint) {
          continue;
        }
        
        const downloadStream = gfs.openDownloadStream(paper._id);
        const chunks = [];
        
        downloadStream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        downloadStream.on('end', async () => {
          try {
            const fileBuffer = Buffer.concat(chunks);
            const pdfText = await extractPDFText(fileBuffer);
            const contentFingerprint = pdfText ? generateContentFingerprint(pdfText) : null;
            
            if (contentFingerprint) {
              await mongoose.connection.db.collection('papers.files').updateOne(
                { _id: paper._id },
                { $set: { 'metadata.contentFingerprint': contentFingerprint } }
              );
              updatedCount++;
              console.log(`Updated fingerprint for paper: ${paper.metadata.title}`);
            }
          } catch (error) {
            errorCount++;
            console.error(`Error processing paper ${paper._id}:`, error);
          }
        });
        
        downloadStream.on('error', (error) => {
          errorCount++;
          console.error(`Error downloading paper ${paper._id}:`, error);
        });
        
      } catch (error) {
        errorCount++;
        console.error(`Error processing paper ${paper._id}:`, error);
      }
    }
    
    res.json({
      message: 'Content fingerprint update completed',
      updatedCount,
      errorCount,
      totalPapers: allPapers.length
    });
    
  } catch (error) {
    console.error('Error updating content fingerprints:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const SDG_KEYWORDS = [
  { id: 1, keywords: ["poverty", "income", "poor"] },
  { id: 2, keywords: ["hunger", "food", "nutrition"] },
  { id: 3, keywords: ["health", "well-being", "disease", "medicine"] },
  { id: 4, keywords: ["education", "school", "learning", "literacy"] },
  { id: 5, keywords: ["gender", "equality", "women", "girls"] },
  { id: 6, keywords: ["water", "sanitation", "hygiene"] },
  { id: 7, keywords: ["energy", "electricity", "renewable"] },
  { id: 8, keywords: ["work", "employment", "economy", "growth"] },
  { id: 9, keywords: ["industry", "infrastructure", "innovation"] },
  { id: 10, keywords: ["inequality", "equal", "discrimination"] },
  { id: 11, keywords: ["cities", "urban", "communities"] },
  { id: 12, keywords: ["consumption", "production", "waste"] },
  { id: 13, keywords: ["climate", "carbon", "emissions"] },
  { id: 14, keywords: ["ocean", "marine", "sea", "water"] },
  { id: 15, keywords: ["land", "biodiversity", "forests", "species"] },
  { id: 16, keywords: ["peace", "justice", "institutions", "law"] },
  { id: 17, keywords: ["partnership", "cooperation", "collaboration"] },
];

function detectSDGs(text) {
  const lowerText = text.toLowerCase();
  return SDG_KEYWORDS.filter(sdg =>
    sdg.keywords.some(kw => lowerText.includes(kw))
  ).map(sdg => sdg.id);
}

function extractTitle(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const administrativeClues = [
    /^a project proposal$/i,
    /^presented to the faculty/i,
    /^in partial fulfillment/i,
    /^submitted to/i,
    /^for the degree/i,
    /^bachelor of/i,
    /^master of/i,
    /^doctor of/i,
    /^\d{4}$/,
    /^academic year/i,
    /^semester/i,
    /^trimester/i
  ];

  const institutionalPatterns = [
    /institute/i,
    /college/i,
    /department/i,
    /university/i,
    /campus/i,
    /school/i,
    /manila/i,
    /philippines/i,
    /faculty/i,
    /studies/i,
    /science/i,
    /technology/i,
    /computing/i,
    /affiliation/i,
    /eulogio/i,
    /rodriguez/i,
    /sampaloc/i
  ];

  const dedicationPatterns = [
    /dedicated to/i,
    /grateful/i,
    /thank(s| you)?/i,
    /our parents/i,
    /my parents/i,
    /their support/i,
    /his support/i,
    /her support/i,
    /our family/i,
    /my family/i,
    /friends/i,
    /guidance/i,
    /inspiration/i,
    /encouragement/i
  ];

  function isAdministrative(line) {
    return administrativeClues.some(re => re.test(line));
  }
  
  function isInstitutional(line) {
    return institutionalPatterns.some(re => re.test(line));
  }
  
  function isDedication(line) {
    return dedicationPatterns.some(re => re.test(line));
  }

  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    const line = lines[i];
    
    if (isAdministrative(line)) {
      console.log('Found administrative clue:', line);
      
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const candidate = lines[j];
        
        if (
          candidate.length > 5 &&
          candidate.length < 200 &&
          !/^abstract$/i.test(candidate) &&
          !/^introduction$/i.test(candidate) &&
          !/^keywords?:?/i.test(candidate) &&
          !/^summary$/i.test(candidate) &&
          !/^conclusion$/i.test(candidate) &&
          !/^references$/i.test(candidate) &&
          !/^bibliography$/i.test(candidate) &&
          !/^\d+$/.test(candidate) &&
          !/^page\s*\d+$/i.test(candidate) &&
          !/^doi:/i.test(candidate) &&
          !/^issn:/i.test(candidate) &&
          !/^isbn:/i.test(candidate) &&
          !isInstitutional(candidate) &&
          !isDedication(candidate) &&
          !isAdministrative(candidate)
        ) {
          console.log('Found title by administrative clue analysis:', candidate);
          return candidate;
        }
      }
    }
  }

  const contextClues = [
    /presented to the faculty/i,
    /in partial fulfillment/i,
    /department of/i,
    /academic year/i,
    /project proposal/i,
    /thesis/i,
    /capstone/i,
    /research paper/i,
    /submitted to/i,
    /college of/i,
    /school of/i
  ];

  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    const line = lines[i];
    if (contextClues.some(re => re.test(line))) {
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const candidate = lines[j];
        if (
          candidate.length > 5 &&
          candidate.length < 200 &&
          !/^abstract$/i.test(candidate) &&
          !/^introduction$/i.test(candidate) &&
          !/^keywords?:?/i.test(candidate) &&
          !/^summary$/i.test(candidate) &&
          !/^conclusion$/i.test(candidate) &&
          !/^references$/i.test(candidate) &&
          !/^bibliography$/i.test(candidate) &&
          !/^\d+$/.test(candidate) &&
          !/^page\s*\d+$/i.test(candidate) &&
          !/^doi:/i.test(candidate) &&
          !/^issn:/i.test(candidate) &&
          !/^isbn:/i.test(candidate) &&
          !isInstitutional(candidate) &&
          !isDedication(candidate) &&
          !isAdministrative(candidate)
        ) {
          console.log('Found title by context clue analysis:', candidate);
          return candidate;
        }
      }
    }
  }

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    if (
      line.length > 5 &&
      line.length < 200 &&
      !/^abstract$/i.test(line) &&
      !/^introduction$/i.test(line) &&
      !/^keywords?:?/i.test(line) &&
      !/^summary$/i.test(line) &&
      !/^conclusion$/i.test(line) &&
      !/^references$/i.test(line) &&
      !/^bibliography$/i.test(line) &&
      !/^\d+$/.test(line) &&
      !/^page\s*\d+$/i.test(line) &&
      !/^doi:/i.test(line) &&
      !/^issn:/i.test(line) &&
      !/^isbn:/i.test(line) &&
      !isInstitutional(line) &&
      !isDedication(line) &&
      !isAdministrative(line)
    ) {
      console.log('Found potential title (final fallback):', line);
      return line;
    }
  }
  
  console.log('No suitable title found');
  return '';
}

function extractAbstract(text) {
  const patterns = [
    /abstract[\s\n]*([\s\S]{0,1500}?)(?=\n\s*\w|\n\n|introduction|keywords?:?|summary|conclusion)/i,
    /summary[\s\n]*([\s\S]{0,1500}?)(?=\n\s*\w|\n\n|introduction|keywords?:?|summary|conclusion)/i,
    /résumé[\s\n]*([\s\S]{0,1500}?)(?=\n\s*\w|\n\n|introduction|keywords?:?|summary|conclusion)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const abstract = match[1].replace(/\n/g, ' ').trim();
      console.log('Found abstract with pattern:', pattern.source);
      console.log('Abstract length:', abstract.length);
      return abstract;
    }
  }
  
  console.log('No abstract found');
  return '';
}

function extractKeywords(text) {
  const patterns = [
    /keywords?:?[\s\n]*([\w\s,;\-\.]+?)(?=\n\s*\w|\n\n|introduction|abstract|summary)/i,
    /key\s+words?:?[\s\n]*([\w\s,;\-\.]+?)(?=\n\s*\w|\n\n|introduction|abstract|summary)/i,
    /index\s+terms?:?[\s\n]*([\w\s,;\-\.]+?)(?=\n\s*\w|\n\n|introduction|abstract|summary)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const keywordsText = match[1].trim();
      const keywords = keywordsText.split(/[,;\n]/).map(k => k.trim()).filter(k => k.length > 0);
      console.log('Found keywords with pattern:', pattern.source);
      console.log('Keywords found:', keywords);
      return keywords;
    }
  }
  
  console.log('No keywords found');
  return [];
}

router.post('/analyze-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (!pdfParse) {
    return res.status(500).json({ error: 'PDF parsing not available' });
  }
  
  try {
    console.log('Starting PDF analysis for file:', req.file.originalname);
    console.log('File size:', req.file.size, 'bytes');
    
    const contentValidation = await validateFileContent(req.file.buffer, req.file.originalname, req.file.mimetype);
    
    if (!contentValidation.isValid) {
      console.log('Content validation failed:', contentValidation.reason);
      return res.status(400).json({ 
        error: contentValidation.reason,
        errorType: contentValidation.errorType,
        suggestion: 'Please upload a valid research paper document.'
      });
    }
    
    console.log('Content validation passed, proceeding with metadata extraction...');
    
    const data = await pdfParse(req.file.buffer);
    const text = data.text || '';
    
    console.log('PDF text extracted successfully');
    console.log('Text length:', text.length, 'characters');
    console.log('First 200 characters:', text.substring(0, 200));
    
    if (!text || text.trim().length === 0) {
      console.log('No text extracted from PDF - likely scanned document or image-based PDF');
      return res.json({
        title: '',
        abstract: '',
        keywords: [],
        sdgs: [],
        warning: 'No text could be extracted from this PDF. It may be a scanned document or image-based PDF.'
      });
    }
    
    const title = extractTitle(text);
    const abstract = extractAbstract(text);
    const keywords = extractKeywords(text);
    const sdgs = detectSDGs(text);
    
    console.log('Extracted metadata:');
    console.log('- Title:', title);
    console.log('- Abstract length:', abstract.length);
    console.log('- Keywords count:', keywords.length);
    console.log('- SDGs detected:', sdgs);
    
    res.json({
      title,
      abstract,
      keywords,
      sdgs
    });
  } catch (err) {
    console.error('PDF analysis failed:', err);
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    
    let errorMessage = 'Failed to analyze PDF';
    if (err.message.includes('Invalid PDF')) {
      errorMessage = 'The uploaded file is not a valid PDF or is corrupted';
    } else if (err.message.includes('password')) {
      errorMessage = 'The PDF is password-protected and cannot be analyzed';
    } else if (err.message.includes('memory')) {
      errorMessage = 'The PDF is too large or complex to analyze';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: err.message,
      suggestion: 'Please manually enter the paper details or try a different PDF file.'
    });
  }
});

router.get('/get-users-for-author-selection', async (req, res) => {
  try {
    console.log('Fetching users for co-author selection...');
    
    res.json([
      {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        department: "Computer Science",
        status: "approved"
      }
    ]);
    return;
    
    const userCount = await User.countDocuments({ status: 'approved' });
    console.log(`Found ${userCount} approved users in database`);
    
    const users = await User.find(
      { status: 'approved' },
      '-password'
    ).lean();
    
    console.log(`Successfully retrieved ${users.length} users`);
    
    res.json(users);
  } catch (error) {
    console.error('Error in get-users-for-author-selection:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
