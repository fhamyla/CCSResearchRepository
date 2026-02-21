// Copyright (c) 2025 fhamyla
import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      const parsedUser = JSON.parse(user);
      if (parsedUser.role) {
        config.headers['user-role'] = parsedUser.role;
      }
    } catch (error) {
      console.error('Error parsing user data for headers:', error);
    }
  }
  return config;
});

export const authService = {
  sendOTP: async (email) => {
    try {
      const response = await api.post('/auth/send-otp', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to send OTP' };
    }
  },

  verifyOTP: async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'OTP verification failed' };
    }
  },

  register: async (email, password, firstName, lastName, phoneNumber, department, studentId) => {
    try {
      const response = await api.post('/auth/register', { 
        email, 
        password, 
        firstName, 
        lastName, 
        phoneNumber, 
        department, 
        studentId 
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Registration failed' };
    }
  },

  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Login failed' };
    }
  }
};

export const paperService = {
  upload: async (file, userId, title, description, additionalData = {}) => {
    try {
      const formData = new FormData();
      formData.append('paper', file);
      formData.append('userId', userId);
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);
      
      if (additionalData.journal) formData.append('journal', additionalData.journal);
      if (additionalData.year) formData.append('year', additionalData.year);
      if (additionalData.authors) formData.append('authors', JSON.stringify(additionalData.authors));
      if (additionalData.tags) formData.append('tags', JSON.stringify(additionalData.tags));
      if (additionalData.sdgs) formData.append('sdgs', JSON.stringify(additionalData.sdgs));
      if (additionalData.doi) formData.append('doi', additionalData.doi);

      const response = await api.post('/papers/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.error === 'DUPLICATE_PAPER') {
        throw {
          ...error.response.data,
          isDuplicate: true
        };
      }
      
      if (error.response?.status === 400 && error.response?.data?.error === 'INVALID_FILE_CONTENT') {
        throw {
          ...error.response.data,
          isInvalidContent: true
        };
      }
      
      if (error.response?.status === 400 && error.response?.data?.errorType) {
        const errorType = error.response.data.errorType;
        let enhancedMessage = error.response.data.reason || error.response.data.message;
        
        switch (errorType) {
          case 'EMPTY_OR_TEST_DOCUMENT':
            enhancedMessage = `⚠️ ${enhancedMessage}`;
            break;
          case 'NON_RESEARCH_CONTENT':
            enhancedMessage = `📄 ${enhancedMessage}`;
            break;
          case 'EMPTY_FILE':
          case 'FILE_TOO_SMALL':
            enhancedMessage = `📁 ${enhancedMessage}`;
            break;
          case 'INVALID_PDF_FORMAT':
          case 'NO_READABLE_TEXT':
          case 'INSUFFICIENT_TEXT_CONTENT':
            enhancedMessage = `📄 ${enhancedMessage}`;
            break;
          default:
            enhancedMessage = `❌ ${enhancedMessage}`;
        }
        
        throw {
          ...error.response.data,
          message: enhancedMessage,
          isValidationError: true,
          errorType: errorType
        };
      }
      
      throw error.response?.data || { message: 'Upload failed' };
    }
  },

  getAuthorDetails: async (authorName) => {
    try {
      const papers = await api.get('/papers/public');
      
      
      let authorObj = null;
      for (const paper of papers.data) {
        if (paper.authors && Array.isArray(paper.authors)) {
          const matchingAuthor = paper.authors.find(author => {
            if (typeof author === 'object') {
              if (author.name && author.name.toLowerCase() === authorName.toLowerCase()) {
                return true;
              }
              
              if (author.firstName && author.lastName) {
                const fullName = `${author.firstName} ${author.lastName}`.toLowerCase();
                return fullName === authorName.toLowerCase();
              }
            } else if (typeof author === 'string') {
              return author.toLowerCase() === authorName.toLowerCase();
            }
            return false;
          });
          
          if (matchingAuthor) {
            authorObj = matchingAuthor;
            if (typeof matchingAuthor === 'object' && matchingAuthor.userId) {
              break;
            }
          }
        }
      }
      
      const authorPapers = papers.data.filter(paper => {
        return paper.authors && paper.authors.some(author => {
          if (typeof author === 'object') {
            if (author.name && author.name.toLowerCase() === authorName.toLowerCase()) {
              return true;
            }
            
            if (author.firstName && author.lastName) {
              const fullName = `${author.firstName} ${author.lastName}`.toLowerCase();
              return fullName === authorName.toLowerCase();
            }
            
            if (authorObj && typeof authorObj === 'object' && authorObj.userId && 
                author.userId === authorObj.userId) {
              return true;
            }
          } else if (typeof author === 'string') {
            return author.toLowerCase() === authorName.toLowerCase();
          }
          return false;
        });
      });
      
      const totalLikes = authorPapers.reduce((sum, paper) => {
        const likes = typeof paper.likes === 'object' ? 
          (paper.likes.id ? parseInt(paper.likes.id) : 0) : 
          (parseInt(paper.likes) || 0);
        return sum + likes;
      }, 0);
      
      const allTags = new Set();
      authorPapers.forEach(paper => {
        if (paper.tags && Array.isArray(paper.tags)) {
          paper.tags.forEach(tag => {
            const tagStr = typeof tag === 'object' ? (tag.name || tag.id || '') : (tag || '');
            if (tagStr) allTags.add(tagStr);
          });
        }
      });
      
      let activityLevel = 'Low';
      if (authorPapers.length > 10) {
        activityLevel = 'High';
      } else if (authorPapers.length > 5) {
        activityLevel = 'Medium';
      }
      
      const currentYear = new Date().getFullYear();
      const recentPapers = authorPapers.filter(paper => {
        const year = typeof paper.year === 'object' ? 
          (paper.year.value || 0) : 
          (parseInt(paper.year) || 0);
        return year >= currentYear - 2;
      });
      
      if (recentPapers.length > 0) {
        if (activityLevel === 'Low') activityLevel = 'Medium';
        else if (activityLevel === 'Medium') activityLevel = 'High';
      }
      
      const formattedPapers = authorPapers.map(paper => ({
        id: paper.id || paper._id,
        title: typeof paper.title === 'object' ? 
          (paper.title.text || paper.title.content || 'Untitled Paper') : 
          (paper.title || 'Untitled Paper'),
        journal: typeof paper.journal === 'object' ? 
          (paper.journal.name || 'No Journal') : 
          (paper.journal || 'No Journal'),
        year: typeof paper.year === 'object' ? 
          (paper.year.value || 'No Year') : 
          (paper.year || 'No Year'),
        doi: typeof paper.doi === 'object' ? 
          (paper.doi.value || 'No DOI') : 
          (paper.doi || 'No DOI'),
        likes: typeof paper.likes === 'object' ? 
          (paper.likes.id ? paper.likes.id : 0) : 
          (paper.likes || 0)
      }));
      
      let email = null;
      try {
        if (authorObj && typeof authorObj === 'object' && authorObj.userId) {
          console.log('Trying to get user details by userId:', authorObj.userId);
          const userResponse = await api.get(`/auth/user/${authorObj.userId}`);
          if (userResponse.data && userResponse.data.email) {
            email = userResponse.data.email;
            console.log('Found email by userId:', email);
          }
        }
        
        if (!email) {
          console.log('Trying to get user details by name:', authorName);
          const userDetails = await paperService.getUserByName(authorName);
          if (userDetails && userDetails.length > 0) {
            email = userDetails[0].email;
            console.log('Found email by name search:', email);
          }
        }
      } catch (error) {
        console.warn('Failed to retrieve author email:', error);
      }
      
      if (!email) {
        email = `${authorName.toLowerCase().replace(/\s+/g, '.')}@university.edu`;
        console.log('Using fallback email:', email);
      }
      
      const authorData = {
        name: authorName,
        affiliation: 'College of Computer Studies',
        email: email,
        publicationCount: authorPapers.length,
        totalLikes: totalLikes,
        activityLevel: activityLevel,
        researchInterests: Array.from(allTags),
        papers: formattedPapers
      };
      
      return authorData;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch author details' };
    }
  },

  getUserPapers: async (userId) => {
    try {
      const response = await api.get(`/papers/user/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch papers' };
    }
  },

  downloadPaper: async (fileId, userId, preview = false) => {
    try {
      let url = `/papers/download/${fileId}`;
      const params = [];
      if (userId) params.push(`userId=${userId}`);
      if (preview) params.push('preview=true');
      if (params.length > 0) url += '?' + params.join('&');
      const response = await api.get(url, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error.response?.data || { message: 'Download failed' };
    }
  },

  deletePaper: async (fileId, userId) => {
    try {
      const response = await api.delete(`/papers/${fileId}`, {
        data: { userId }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Delete failed' };
    }
  },
  getAllPapers: async () => {
    try {
      const response = await api.get('/papers/admin/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch all papers' };
    }
  },
  getPublicPapers: async (userId = null) => {
    try {
      const params = userId ? { userId } : {};
      const response = await api.get('/papers/public', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch papers' };
    }
  },
  getPaperDetails: async (paperId) => {
    try {
      const response = await api.get(`/papers/${paperId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch paper details' };
    }
  },

  checkDownloadPermission: async (paperId, userId) => {
    try {
      const response = await api.get(`/papers/${paperId}/download-permission`, {
        params: { userId }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to check download permission' };
    }
  },

  requestPaperAccess: async (paperId, userId, reason, paperTitle) => {
    try {
      const response = await api.post('/paper-requests/request', {
        paperId,
        userId,
        reason,
        paperTitle
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to submit paper request' };
    }
  },

  getUserPaperRequests: async (userId) => {
    try {
      const response = await api.get(`/paper-requests/user/${userId}/requests`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get paper requests' };
    }
  },

  getAdminPaperRequests: async () => {
    try {
      const response = await api.get('/paper-requests/admin/requests');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get paper requests' };
    }
  },

  getAdminPendingRequests: async () => {
    try {
      const response = await api.get('/paper-requests/admin/requests/pending');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get pending paper requests' };
    }
  },

  processPaperRequest: async (requestId, data) => {
    try {
      const response = await api.put(`/paper-requests/admin/requests/${requestId}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to process paper request' };
    }
  },

  likePaper: async (paperId, userId) => {
    try {
      const response = await api.post(`/papers/${paperId}/like`, { userId });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to like paper' };
    }
  },

  dislikePaper: async (paperId, userId) => {
    try {
      const response = await api.post(`/papers/${paperId}/dislike`, { userId });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to dislike paper' };
    }
  },

  addComment: async (paperId, userId, userEmail, content, parentCommentId = null) => {
    try {
      const response = await api.post(`/papers/${paperId}/comment`, {
        userId,
        userEmail,
        content,
        parentCommentId
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to add comment' };
    }
  },

  updatePaper: async (paperId, userId, paperData) => {
    try {
      const formattedData = {
        userId,
        title: paperData.title,
        description: paperData.abstract,
        abstract: paperData.abstract,
        journal: paperData.journal || '',
        year: paperData.year || new Date().getFullYear().toString(),
        publisher: paperData.publisher || '',
        authors: paperData.authors || [],
        tags: paperData.tags || paperData.keywords || [],
        keywords: paperData.keywords || paperData.tags || [],
        sdgs: paperData.sdgs || [],
        doi: paperData.doi || '',
        isPublished: paperData.isPublished || false,
        references: paperData.references || '',
        conferenceProceeding: paperData.conferenceProceeding || false
      };

      const response = await api.put(`/papers/${paperId}`, formattedData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update paper' };
    }
  },
  
  adminDeletePaper: async (paperId) => {
    try {
      const response = await api.delete(`/papers/admin/papers/${paperId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete paper' };
    }
  },

  adminUpdatePaper: async (paperId, paperData) => {
    try {
      const response = await api.put(`/papers/admin/papers/${paperId}`, paperData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update paper' };
    }
  },

  adminGetPaperStats: async () => {
    try {
      const response = await api.get('/papers/admin/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch paper statistics' };
    }
  },

  trackCitation: async (paperId) => {
    try {
      const response = await api.post(`/papers/track-citation/${paperId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to track citation' };
    }
  },

  updateContentFingerprints: async () => {
    try {
      const response = await api.post('/papers/admin/update-content-fingerprints');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update content fingerprints' };
    }
  },

  analyzePDF: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/papers/analyze-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to analyze PDF' };
    }
  }
};

export const userService = {
  getAllUsers: async () => {
    try {
      const response = await api.get('/auth/admin/users');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch users' };
    }
  },

  updateUserRole: async (userId, role) => {
    try {
      const response = await api.put(`/auth/admin/users/${userId}/role`, { role });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update user role' };
    }
  },

  deleteUser: async (userId) => {
    try {
      const response = await api.delete(`/auth/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete user' };
    }
  },

  getUserStats: async () => {
    try {
      const response = await api.get('/auth/admin/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch user statistics' };
    }
  },

  getPendingUsers: async () => {
    try {
      const response = await api.get('/auth/admin/users/pending');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch pending users' };
    }
  },

  updateUserStatus: async (userId, status) => {
    try {
      const response = await api.put(`/auth/admin/users/${userId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update user status' };
    }
  },

  getAllUsersForCoAuthors: async () => {
    try {
      const response = await api.get('/papers/get-users-for-author-selection');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch users' };
    }
  },

  getUserByName: async (name) => {
    try {
      console.log('Fetching user details for:', name);
      const response = await api.get(`/auth/users/by-name/${encodeURIComponent(name)}`);
      console.log('User details response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching user details:', error);
      throw error.response?.data || { message: 'Failed to fetch user details' };
    }
  },

  getUserById: async (userId) => {
    try {
      console.log('Fetching user details for ID:', userId);
      const response = await api.get(`/auth/user/${userId}`);
      console.log('User details response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching user details by ID:', error);
      throw error.response?.data || { message: 'Failed to fetch user details' };
    }
  },
};

export default api;

