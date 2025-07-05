import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include user role in headers
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

// Authentication services
export const authService = {
  // Send OTP for email verification
  sendOTP: async (email) => {
    try {
      const response = await api.post('/auth/send-otp', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to send OTP' };
    }
  },

  // Verify OTP
  verifyOTP: async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'OTP verification failed' };
    }
  },

  // Register/Sign up
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

  // Login/Sign in
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Login failed' };
    }
  }
};

// Paper management services
export const paperService = {
  // Upload paper
  upload: async (file, userId, title, description, additionalData = {}) => {
    try {
      const formData = new FormData();
      formData.append('paper', file);
      formData.append('userId', userId);
      if (title) formData.append('title', title);
      if (description) formData.append('description', description);
      
      // Add additional fields
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
      throw error.response?.data || { message: 'Upload failed' };
    }
  },

  // Get author details
  getAuthorDetails: async (authorName) => {
    try {
      // Get all public papers to filter by author
      const papers = await api.get('/papers/public');
      
      // Extract actual author name (could be different format from what's shown in UI)
      let processedAuthorName = authorName;
      
      // Try to find the exact author object from papers to get any userId or additional info
      let authorObj = null;
      for (const paper of papers.data) {
        if (paper.authors && Array.isArray(paper.authors)) {
          const matchingAuthor = paper.authors.find(author => {
            if (typeof author === 'object') {
              // Try to match by name field if it exists
              if (author.name && author.name.toLowerCase() === authorName.toLowerCase()) {
                return true;
              }
              
              // Try first and last name fields if they exist
              if (author.firstName && author.lastName) {
                const fullName = `${author.firstName} ${author.lastName}`.toLowerCase();
                return fullName === authorName.toLowerCase();
              }
            } else if (typeof author === 'string') {
              // Direct string comparison
              return author.toLowerCase() === authorName.toLowerCase();
            }
            return false;
          });
          
          if (matchingAuthor) {
            authorObj = matchingAuthor;
            // If we found a matching author with a userId, we can use that for fetching email
            if (typeof matchingAuthor === 'object' && matchingAuthor.userId) {
              break;
            }
          }
        }
      }
      
      // Filter papers by the author name
      const authorPapers = papers.data.filter(paper => {
        return paper.authors && paper.authors.some(author => {
          if (typeof author === 'object') {
            // Try to match by name field if it exists
            if (author.name && author.name.toLowerCase() === authorName.toLowerCase()) {
              return true;
            }
            
            // Try first and last name fields if they exist
            if (author.firstName && author.lastName) {
              const fullName = `${author.firstName} ${author.lastName}`.toLowerCase();
              return fullName === authorName.toLowerCase();
            }
            
            // Try userId if we have it from authorObj
            if (authorObj && typeof authorObj === 'object' && authorObj.userId && 
                author.userId === authorObj.userId) {
              return true;
            }
          } else if (typeof author === 'string') {
            // Direct string comparison
            return author.toLowerCase() === authorName.toLowerCase();
          }
          return false;
        });
      });
      
      // Calculate author statistics
      const totalLikes = authorPapers.reduce((sum, paper) => {
        const likes = typeof paper.likes === 'object' ? 
          (paper.likes.id ? parseInt(paper.likes.id) : 0) : 
          (parseInt(paper.likes) || 0);
        return sum + likes;
      }, 0);
      
      // Extract research interests (tags) from all papers
      const allTags = new Set();
      authorPapers.forEach(paper => {
        if (paper.tags && Array.isArray(paper.tags)) {
          paper.tags.forEach(tag => {
            const tagStr = typeof tag === 'object' ? (tag.name || tag.id || '') : (tag || '');
            if (tagStr) allTags.add(tagStr);
          });
        }
      });
      
      // Determine activity level based on number of papers and recency
      let activityLevel = 'Low';
      if (authorPapers.length > 10) {
        activityLevel = 'High';
      } else if (authorPapers.length > 5) {
        activityLevel = 'Medium';
      }
      
      // Find most recent paper year to check if active recently
      const currentYear = new Date().getFullYear();
      const recentPapers = authorPapers.filter(paper => {
        const year = typeof paper.year === 'object' ? 
          (paper.year.value || 0) : 
          (parseInt(paper.year) || 0);
        return year >= currentYear - 2; // Active in last 2 years
      });
      
      if (recentPapers.length > 0) {
        // Boost activity level if recently active
        if (activityLevel === 'Low') activityLevel = 'Medium';
        else if (activityLevel === 'Medium') activityLevel = 'High';
      }
      
      // Format the papers data for display
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
      
      // Try to get author's email from the database
      let email = null;
      try {
        // If we found an author object with userId, try to get the user directly
        if (authorObj && typeof authorObj === 'object' && authorObj.userId) {
          console.log('Trying to get user details by userId:', authorObj.userId);
          const userResponse = await api.get(`/auth/user/${authorObj.userId}`);
          if (userResponse.data && userResponse.data.email) {
            email = userResponse.data.email;
            console.log('Found email by userId:', email);
          }
        }
        
        // If we still don't have an email, try by name
        if (!email) {
          console.log('Trying to get user details by name:', authorName);
          const userDetails = await paperService.getUserByName(authorName);
          if (userDetails && userDetails.length > 0) {
            // Use the first matching user's email
            email = userDetails[0].email;
            console.log('Found email by name search:', email);
          }
        }
      } catch (error) {
        console.warn('Failed to retrieve author email:', error);
      }
      
      // Fallback to generated email if we can't get it from the database
      if (!email) {
        email = `${authorName.toLowerCase().replace(/\s+/g, '.')}@university.edu`;
        console.log('Using fallback email:', email);
      }
      
      // Compile the author data
      const authorData = {
        name: authorName,
        affiliation: 'College of Computer Studies', // Default affiliation
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

  // Get user's papers
  getUserPapers: async (userId) => {
    try {
      const response = await api.get(`/papers/user/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch papers' };
    }
  },

  // Download paper
  downloadPaper: async (fileId, userId) => {
    try {
      const response = await api.get(`/papers/download/${fileId}?userId=${userId}`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error.response?.data || { message: 'Download failed' };
    }
  },

  // Delete paper
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
  // Get all papers (admin only)
  getAllPapers: async () => {
    try {
      const response = await api.get('/papers/admin/all');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch all papers' };
    }
  },
  // Get all papers for public display (homepage)
  getPublicPapers: async () => {
    try {
      const response = await api.get('/papers/public');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch papers' };
    }
  },  // Get paper details by ID
  getPaperDetails: async (paperId) => {
    try {
      const response = await api.get(`/papers/${paperId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch paper details' };
    }
  },

  // Check download permission
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

  // Request paper access
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

  // Get user's paper requests
  getUserPaperRequests: async (userId) => {
    try {
      const response = await api.get(`/paper-requests/user/${userId}/requests`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get paper requests' };
    }
  },

  // Admin: Get all paper requests
  getAdminPaperRequests: async () => {
    try {
      const response = await api.get('/paper-requests/admin/requests');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get paper requests' };
    }
  },

  // Admin: Get pending paper requests
  getAdminPendingRequests: async () => {
    try {
      const response = await api.get('/paper-requests/admin/requests/pending');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to get pending paper requests' };
    }
  },

  // Admin: Process paper request
  processPaperRequest: async (requestId, data) => {
    try {
      const response = await api.put(`/paper-requests/admin/requests/${requestId}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to process paper request' };
    }
  },

  // Like paper
  likePaper: async (paperId, userId) => {
    try {
      const response = await api.post(`/papers/${paperId}/like`, { userId });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to like paper' };
    }
  },

  // Dislike paper
  dislikePaper: async (paperId, userId) => {
    try {
      const response = await api.post(`/papers/${paperId}/dislike`, { userId });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to dislike paper' };
    }
  },

  // Add comment
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

  // Update paper (for users)
  updatePaper: async (paperId, userId, paperData) => {
    try {
      // Ensure all fields are correctly formatted
      const formattedData = {
        userId,
        title: paperData.title,
        description: paperData.abstract, // Map abstract to description for backend compatibility
        abstract: paperData.abstract,
        journal: paperData.journal || '',
        year: paperData.year || new Date().getFullYear().toString(),
        publisher: paperData.publisher || '',
        authors: paperData.authors || [],
        tags: paperData.tags || paperData.keywords || [], // Handle both naming conventions
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
  
  // Admin functions
  // Delete paper (admin only)
  adminDeletePaper: async (paperId) => {
    try {
      const response = await api.delete(`/papers/admin/papers/${paperId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete paper' };
    }
  },

  // Update paper (admin only)
  adminUpdatePaper: async (paperId, paperData) => {
    try {
      const response = await api.put(`/papers/admin/papers/${paperId}`, paperData);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update paper' };
    }
  },

  // Get paper statistics (admin only)
  adminGetPaperStats: async () => {
    try {
      const response = await api.get('/papers/admin/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch paper statistics' };
    }
  },

  // Track paper citation (increment citation count)
  trackCitation: async (paperId) => {
    try {
      const response = await api.post(`/papers/track-citation/${paperId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to track citation' };
    }
  }
};

// User management services (admin only)
export const userService = {
  // Get all users (admin only)
  getAllUsers: async () => {
    try {
      const response = await api.get('/auth/admin/users');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch users' };
    }
  },

  // Update user role (admin only)
  updateUserRole: async (userId, role) => {
    try {
      const response = await api.put(`/auth/admin/users/${userId}/role`, { role });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update user role' };
    }
  },

  // Delete user (admin only)
  deleteUser: async (userId) => {
    try {
      const response = await api.delete(`/auth/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to delete user' };
    }
  },

  // Get user statistics (admin only)
  getUserStats: async () => {
    try {
      const response = await api.get('/auth/admin/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch user statistics' };
    }
  },

  // Get pending users (admin only)
  getPendingUsers: async () => {
    try {
      const response = await api.get('/auth/admin/users/pending');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch pending users' };
    }
  },

  // Update user status (admin only)
  updateUserStatus: async (userId, status) => {
    try {
      const response = await api.put(`/auth/admin/users/${userId}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update user status' };
    }
  },

  // Get all users for co-author selection
  getAllUsersForCoAuthors: async () => {
    try {
      const response = await api.get('/papers/get-users-for-author-selection');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch users' };
    }
  },

  // Get user details by name
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

  // Get user details by ID
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

// Export the api instance for other potential uses
export default api;

