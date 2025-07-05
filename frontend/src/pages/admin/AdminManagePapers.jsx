import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiEdit, 
  FiTrash2, 
  FiDownload, 
  FiSearch, 
  FiBook, 
  FiCalendar, 
  FiUsers, 
  FiTag,
  FiExternalLink,
  FiFileText,
  FiThumbsUp,
  FiThumbsDown,
  FiMessageCircle,
  FiX,
  FiCheck,
  FiBarChart,
  FiFilter,
  FiRefreshCw
} from 'react-icons/fi';
import AdminLayout from '../../components/AdminLayout';
import { paperService } from '../../services/service';

const AdminManagePapers = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all'); // all, title, author, journal, year
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, title, journal, size
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    journal: '',
    year: '',
    publisher: '',
    authors: [],
    tags: [],
    sdgs: [],
    doi: '',
    isPublished: false,
    references: '',
    conferenceProceeding: false
  });
  const [editLoading, setEditLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // success, error, info

  // Check if user is admin or moderator
  const checkAdminAccess = () => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/signin');
      return false;
    }
    
    try {
      const userData = JSON.parse(user);
      if (!['admin', 'moderator'].includes(userData.role)) {
        navigate('/');
        return false;
      }
      return true;
    } catch (error) {
      navigate('/signin');
      return false;
    }
  };

  // Show message with auto-hide
  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  // Load all papers and statistics
  const loadData = async (showLoader = true) => {
    if (!checkAdminAccess()) return;
    
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      const [papersData, statsData] = await Promise.all([
        paperService.getAllPapers(),
        paperService.adminGetPaperStats()
      ]);
      
      setPapers(papersData || []);
      setStats(statsData || {});
      
      if (!showLoader) {
        showMessage('Data refreshed successfully', 'success');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('Error loading data: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter and sort papers
  const getFilteredAndSortedPapers = () => {
    let filtered = [...papers];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(paper => {
        const searchLower = searchTerm.toLowerCase();
        
        switch (filterBy) {
          case 'title':
            return paper.title?.toLowerCase().includes(searchLower);
          case 'author':
            return paper.authors?.some(author => 
              typeof author === 'object' 
                ? author.name?.toLowerCase().includes(searchLower)
                : String(author).toLowerCase().includes(searchLower)
            );
          case 'journal':
            return paper.journal?.toLowerCase().includes(searchLower);
          case 'year':
            return paper.year?.toString().includes(searchTerm);
          default: // 'all'
            return (
              paper.title?.toLowerCase().includes(searchLower) ||
              paper.description?.toLowerCase().includes(searchLower) ||
              paper.journal?.toLowerCase().includes(searchLower) ||
              paper.year?.toString().includes(searchTerm) ||
              paper.authors?.some(author => 
                typeof author === 'object' 
                  ? author.name?.toLowerCase().includes(searchLower)
                  : String(author).toLowerCase().includes(searchLower)
              )
            );
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.uploadDate) - new Date(b.uploadDate);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'journal':
          return (a.journal || '').localeCompare(b.journal || '');
        case 'size':
          return (b.size || 0) - (a.size || 0);
        default: // 'newest'
          return new Date(b.uploadDate) - new Date(a.uploadDate);
      }
    });

    return filtered;
  };

  // Handle delete paper - show confirmation modal
  const handleDeleteClick = (paper) => {
    setPaperToDelete(paper);
    setShowDeleteModal(true);
  };

  // Confirm delete paper
  const confirmDelete = async () => {
    if (!paperToDelete) return;

    try {
      await paperService.adminDeletePaper(paperToDelete.id);
      showMessage('Paper deleted successfully', 'success');
      setShowDeleteModal(false);
      setPaperToDelete(null);
      loadData(false); // Refresh without loading screen
    } catch (error) {
      console.error('Error deleting paper:', error);
      showMessage('Error deleting paper: ' + (error.message || 'Unknown error'), 'error');
    }
  };

  // Handle edit paper
  const handleEditClick = (paper) => {
    setSelectedPaper(paper);
    setEditForm({
      title: paper.title || '',
      description: paper.description || '',
      journal: paper.journal || '',
      year: paper.year || '',
      publisher: paper.publisher || '',
      authors: paper.authors || [],
      tags: paper.tags || [],
      sdgs: paper.sdgs || [],
      doi: paper.doi || '',
      isPublished: paper.isPublished || false,
      references: paper.references || '',
      conferenceProceeding: paper.conferenceProceeding || false
    });
    setShowEditModal(true);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!selectedPaper) return;

    setEditLoading(true);
    try {
      await paperService.adminUpdatePaper(selectedPaper.id, editForm);
      showMessage('Paper updated successfully', 'success');
      setShowEditModal(false);
      setSelectedPaper(null);
      loadData(false); // Refresh without loading screen
    } catch (error) {
      console.error('Error updating paper:', error);
      showMessage('Error updating paper: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle download paper
  const handleDownload = async (paper) => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || !user.id) {
        showMessage('Please sign in to download papers', 'error');
        return;
      }

      // Check if user is admin or moderator
      if (!['admin', 'moderator'].includes(user.role)) {
        showMessage('Admin or moderator role required to download papers', 'error');
        return;
      }

      showMessage('Starting download...', 'info');
      
      // Call the download service
      const response = await paperService.downloadPaper(paper.id, user.id);
      
      // Check if response is valid
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      // Get content type from headers
      const contentType = response.headers['content-type'] || 
                         response.headers['Content-Type'] || 
                         'application/pdf';
      
      // Create blob and download
      const blob = new Blob([response.data], { type: contentType });
      
      // Check if blob is valid
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename - prefer paper filename, fallback to title
      let filename = paper.filename;
      if (!filename) {
        const cleanTitle = paper.title ? paper.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'paper';
        const extension = contentType.includes('pdf') ? 'pdf' : 'docx';
        filename = `${cleanTitle}.${extension}`;
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showMessage('Download completed successfully', 'success');
    } catch (error) {
      console.error('Error downloading paper:', error);
      let errorMessage = 'Download failed';
      
      if (error.response) {
        // Server responded with error status
        if (error.response.status === 403) {
          errorMessage = 'Access denied. Admin privileges are required to download papers.';
        } else if (error.response.status === 404) {
          errorMessage = 'Paper file not found on server.';
        } else if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showMessage(errorMessage, 'error');
    }
  };

  // Utility functions
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return 'No authors';
    return authors.map(author => 
      typeof author === 'object' 
        ? author.name || 'Unknown Author'
        : String(author) || 'Unknown Author'
    ).join(', ');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'pending': return '#ffc107';
      case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  // Get filtered papers
  const filteredPapers = getFilteredAndSortedPapers();

  // Main content renderer
  const renderContent = () => {
    if (loading) {
      return (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading papers...</p>
        </div>
      );
    }

    return (
      <>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTop}>
            <h1 style={styles.title}>
              <FiFileText style={styles.titleIcon} />
              Manage Papers
            </h1>
            <div style={styles.headerActions}>
              <button
                onClick={() => loadData(false)}
                style={styles.refreshButton}
                disabled={refreshing}
                title="Refresh data"
              >
                <FiRefreshCw style={refreshing ? styles.spinning : {}} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>
                <FiBarChart />
              </div>
              <div style={styles.statContent}>
                <h3 style={styles.statTitle}>Total Papers</h3>
                <p style={styles.statValue}>{stats.totalPapers || 0}</p>
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>
                <FiFileText />
              </div>
              <div style={styles.statContent}>
                <h3 style={styles.statTitle}>Total Size</h3>
                <p style={styles.statValue}>{formatFileSize(stats.totalSize || 0)}</p>
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>
                <FiCalendar />
              </div>
              <div style={styles.statContent}>
                <h3 style={styles.statTitle}>Recent Uploads</h3>
                <p style={styles.statValue}>{stats.recentPapers?.length || 0}</p>
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>
                <FiThumbsUp />
              </div>
              <div style={styles.statContent}>
                <h3 style={styles.statTitle}>Total Engagement</h3>
                <p style={styles.statValue}>
                  {papers.reduce((sum, paper) => sum + (paper.likes || 0) + (paper.comments || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div style={styles.controlsContainer}>
            <div style={styles.searchContainer}>
              <FiSearch style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search papers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            
            <div style={styles.filterContainer}>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All Fields</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="journal">Journal</option>
                <option value="year">Year</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
                <option value="journal">Journal A-Z</option>
                <option value="size">Largest First</option>
              </select>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div style={{
              ...styles.messageContainer,
              ...styles[`message${messageType.charAt(0).toUpperCase() + messageType.slice(1)}`]
            }}>
              {messageType === 'success' && <FiCheck style={styles.messageIcon} />}
              {messageType === 'error' && <FiX style={styles.messageIcon} />}
              <span>{message}</span>
            </div>
          )}
        </div>

        {/* Papers List */}
        <div style={styles.papersContainer}>
          {filteredPapers.length === 0 ? (
            <div style={styles.emptyState}>
              <FiFileText style={styles.emptyIcon} />
              <h3 style={styles.emptyTitle}>
                {searchTerm ? 'No papers found' : 'No papers uploaded yet'}
              </h3>
              <p style={styles.emptyDescription}>
                {searchTerm 
                  ? 'Try adjusting your search terms or filters'
                  : 'Papers uploaded by users will appear here'
                }
              </p>
            </div>
          ) : (
            <div style={styles.papersGrid}>
              {filteredPapers.map(paper => (
                <div key={paper.id} style={styles.paperCard}>
                  <div style={styles.paperHeader}>
                    <h3 style={styles.paperTitle}>{paper.title}</h3>
                    <div style={styles.paperActions}>
                      <button
                        onClick={() => handleDownload(paper)}
                        style={styles.actionButton}
                        title="Download paper"
                      >
                        <FiDownload />
                      </button>
                      <button
                        onClick={() => handleEditClick(paper)}
                        style={styles.actionButton}
                        title="Edit paper"
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(paper)}
                        style={{...styles.actionButton, ...styles.deleteButton}}
                        title="Delete paper"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>

                  <p style={styles.paperDescription}>{paper.description}</p>

                  <div style={styles.paperMeta}>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>
                        <FiBook /> Journal:
                      </span>
                      <span style={styles.metaValue}>{paper.journal || 'N/A'}</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>
                        <FiCalendar /> Year:
                      </span>
                      <span style={styles.metaValue}>{paper.year || 'N/A'}</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>
                        <FiUsers /> Authors:
                      </span>
                      <span style={styles.metaValue}>{formatAuthors(paper.authors)}</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Size:</span>
                      <span style={styles.metaValue}>{formatFileSize(paper.size)}</span>
                    </div>
                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Uploaded:</span>
                      <span style={styles.metaValue}>{formatDate(paper.uploadDate)}</span>
                    </div>
                  </div>

                  {paper.tags && paper.tags.length > 0 && (
                    <div style={styles.tagsContainer}>
                      {paper.tags.map((tag, index) => (
                        <span key={index} style={styles.tag}>
                          <FiTag /> {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={styles.paperStats}>
                    <span style={styles.statItem}>
                      <FiThumbsUp /> {paper.likes || 0}
                    </span>
                    <span style={styles.statItem}>
                      <FiThumbsDown /> {paper.dislikes || 0}
                    </span>
                    <span style={styles.statItem}>
                      <FiMessageCircle /> {paper.comments || 0}
                    </span>
                    {paper.doi && (
                      <span style={styles.statItem}>
                        <FiExternalLink /> DOI
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  // Edit Modal
  const renderEditModal = () => {
    if (!showEditModal || !selectedPaper) return null;

    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>
              <FiEdit /> Edit Paper
            </h2>
            <button
              onClick={() => setShowEditModal(false)}
              style={styles.modalCloseButton}
            >
              <FiX />
            </button>
          </div>

          <div style={styles.modalBody}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Title *</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  style={styles.formInput}
                  placeholder="Enter paper title"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows="3"
                  style={styles.formTextarea}
                  placeholder="Enter paper description"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Journal</label>
                  <input
                    type="text"
                    value={editForm.journal}
                    onChange={(e) => setEditForm({...editForm, journal: e.target.value})}
                    style={styles.formInput}
                    placeholder="Journal name"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Year</label>
                  <input
                    type="number"
                    value={editForm.year}
                    onChange={(e) => setEditForm({...editForm, year: e.target.value})}
                    style={styles.formInput}
                    placeholder="Publication year"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Publisher</label>
                <input
                  type="text"
                  value={editForm.publisher}
                  onChange={(e) => setEditForm({...editForm, publisher: e.target.value})}
                  style={styles.formInput}
                  placeholder="Publisher name"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>DOI</label>
                <input
                  type="text"
                  value={editForm.doi}
                  onChange={(e) => setEditForm({...editForm, doi: e.target.value})}
                  style={styles.formInput}
                  placeholder="Digital Object Identifier"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Authors</label>
                <textarea
                  value={Array.isArray(editForm.authors) 
                    ? editForm.authors.map(author => 
                        typeof author === 'object' 
                          ? (author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Unknown Author')
                          : String(author)
                      ).join(', ')
                    : String(editForm.authors || '')
                  }
                  onChange={(e) => {
                    const authorsText = e.target.value;
                    const authorsArray = authorsText.split(',').map(author => author.trim()).filter(author => author);
                    setEditForm({...editForm, authors: authorsArray});
                  }}
                  rows="2"
                  style={styles.formTextarea}
                  placeholder="Enter authors separated by commas"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Tags/Keywords</label>
                <textarea
                  value={Array.isArray(editForm.tags) 
                    ? editForm.tags.map(tag => 
                        typeof tag === 'object' 
                          ? (tag.name || tag.id || String(tag))
                          : String(tag)
                      ).join(', ')
                    : String(editForm.tags || '')
                  }
                  onChange={(e) => {
                    const tagsText = e.target.value;
                    const tagsArray = tagsText.split(',').map(tag => tag.trim()).filter(tag => tag);
                    setEditForm({...editForm, tags: tagsArray});
                  }}
                  rows="2"
                  style={styles.formTextarea}
                  placeholder="Enter tags/keywords separated by commas"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>SDGs (Sustainable Development Goals)</label>
                <textarea
                  value={Array.isArray(editForm.sdgs) 
                    ? editForm.sdgs.map(sdg => 
                        typeof sdg === 'object' 
                          ? (sdg.name || sdg.id || String(sdg))
                          : String(sdg)
                      ).join(', ')
                    : String(editForm.sdgs || '')
                  }
                  onChange={(e) => {
                    const sdgsText = e.target.value;
                    const sdgsArray = sdgsText.split(',').map(sdg => sdg.trim()).filter(sdg => sdg);
                    setEditForm({...editForm, sdgs: sdgsArray});
                  }}
                  rows="2"
                  style={styles.formTextarea}
                  placeholder="Enter SDGs separated by commas"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>References</label>
                <textarea
                  value={editForm.references}
                  onChange={(e) => setEditForm({...editForm, references: e.target.value})}
                  rows="3"
                  style={styles.formTextarea}
                  placeholder="Enter references/bibliography"
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={editForm.isPublished}
                      onChange={(e) => setEditForm({...editForm, isPublished: e.target.checked})}
                      style={styles.checkbox}
                    />
                    Published
                  </label>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={editForm.conferenceProceeding}
                      onChange={(e) => setEditForm({...editForm, conferenceProceeding: e.target.checked})}
                      style={styles.checkbox}
                    />
                    Conference Proceeding
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.modalFooter}>
            <button
              onClick={() => setShowEditModal(false)}
              style={styles.cancelButton}
              disabled={editLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              style={styles.saveButton}
              disabled={editLoading || !editForm.title.trim()}
            >
              {editLoading ? (
                <>
                  <div style={styles.buttonSpinner}></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiCheck /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Delete Confirmation Modal
  const renderDeleteModal = () => {
    if (!showDeleteModal || !paperToDelete) return null;

    return (
      <div style={styles.modalOverlay}>
        <div style={styles.confirmModalContent}>
          <div style={styles.confirmModalHeader}>
            <div style={styles.dangerIcon}>
              <FiTrash2 />
            </div>
            <h2 style={styles.confirmTitle}>Delete Paper</h2>
          </div>

          <div style={styles.confirmModalBody}>
            <p style={styles.confirmMessage}>
              Are you sure you want to delete "{paperToDelete.title}"?
            </p>
            <p style={styles.confirmWarning}>
              This action cannot be undone. The paper file and all associated data will be permanently removed.
            </p>
          </div>

          <div style={styles.confirmModalFooter}>
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setPaperToDelete(null);
              }}
              style={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              style={styles.dangerButton}
            >
              <FiTrash2 /> Delete Paper
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Styles object using the royal velvet theme
  const styles = {
    // Layout styles
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      color: '#663399'
    },
    loadingSpinner: {
      width: '50px',
      height: '50px',
      border: '4px solid #e9ecef',
      borderTop: '4px solid #663399',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginBottom: '20px'
    },
    loadingText: {
      fontSize: '18px',
      fontWeight: '500'
    },
    spinning: {
      animation: 'spin 1s linear infinite'
    },

    // Header styles
    header: {
      marginBottom: '32px'
    },
    headerTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px'
    },
    title: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#2c2c54',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: 0
    },
    titleIcon: {
      color: '#663399'
    },
    headerActions: {
      display: 'flex',
      gap: '12px'
    },
    refreshButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 16px',
      backgroundColor: '#663399',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 8px rgba(102, 51, 153, 0.1)'
    },

    // Statistics styles
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '20px',
      marginBottom: '32px'
    },
    statCard: {
      display: 'flex',
      alignItems: 'center',
      padding: '24px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(102, 51, 153, 0.15)',
      border: '1px solid #e9ecef',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    },
    statIcon: {
      width: '48px',
      height: '48px',
      backgroundColor: '#f8f5ff',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#663399',
      fontSize: '20px',
      marginRight: '16px'
    },
    statContent: {
      flex: 1
    },
    statTitle: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#6c757d',
      margin: '0 0 4px 0'
    },
    statValue: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#2c2c54',
      margin: 0
    },

    // Controls styles
    controlsContainer: {
      display: 'flex',
      gap: '16px',
      marginBottom: '24px',
      flexWrap: 'wrap'
    },
    searchContainer: {
      position: 'relative',
      flex: '1',
      minWidth: '300px'
    },
    searchIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6c757d',
      fontSize: '18px'
    },
    searchInput: {
      width: '100%',
      padding: '12px 12px 12px 40px',
      fontSize: '16px',
      border: '2px solid #e9ecef',
      borderRadius: '8px',
      backgroundColor: 'white',
      transition: 'border-color 0.3s ease',
      outline: 'none'
    },
    filterContainer: {
      display: 'flex',
      gap: '12px'
    },
    filterSelect: {
      padding: '12px 16px',
      fontSize: '14px',
      border: '2px solid #e9ecef',
      borderRadius: '8px',
      backgroundColor: 'white',
      color: '#2c2c54',
      cursor: 'pointer',
      outline: 'none',
      transition: 'border-color 0.3s ease'
    },

    // Message styles
    messageContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 20px',
      borderRadius: '8px',
      marginBottom: '24px',
      fontSize: '16px',
      fontWeight: '500'
    },
    messageIcon: {
      fontSize: '18px'
    },
    messageSuccess: {
      backgroundColor: '#d4edda',
      color: '#155724',
      border: '1px solid #c3e6cb'
    },
    messageError: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      border: '1px solid #f5c6cb'
    },
    messageInfo: {
      backgroundColor: '#d1ecf1',
      color: '#0c5460',
      border: '1px solid #bee5eb'
    },

    // Papers container styles
    papersContainer: {
      minHeight: '400px'
    },
    papersGrid: {
      display: 'grid',
      gap: '24px'
    },
    paperCard: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 12px rgba(102, 51, 153, 0.15)',
      border: '1px solid #e9ecef',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    },
    paperHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '16px'
    },
    paperTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#2c2c54',
      margin: 0,
      flex: 1,
      lineHeight: '1.4'
    },
    paperActions: {
      display: 'flex',
      gap: '8px',
      marginLeft: '16px'
    },
    actionButton: {
      width: '40px',
      height: '40px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      transition: 'all 0.2s ease',
      backgroundColor: '#f8f9fa',
      color: '#6c757d'
    },
    deleteButton: {
      backgroundColor: '#fff5f5',
      color: '#dc3545'
    },
    paperDescription: {
      fontSize: '16px',
      color: '#6c757d',
      lineHeight: '1.5',
      margin: '0 0 20px 0'
    },
    paperMeta: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '12px',
      marginBottom: '16px'
    },
    metaRow: {
      display: 'flex',
      alignItems: 'center',
      fontSize: '14px'
    },
    metaLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontWeight: '500',
      color: '#495057',
      minWidth: '80px'
    },
    metaValue: {
      color: '#6c757d',
      marginLeft: '8px'
    },
    tagsContainer: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginBottom: '16px'
    },
    tag: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 8px',
      backgroundColor: '#f8f5ff',
      color: '#663399',
      fontSize: '12px',
      fontWeight: '500',
      borderRadius: '6px',
      border: '1px solid #e2d8f7'
    },
    paperStats: {
      display: 'flex',
      gap: '20px',
      fontSize: '14px',
      color: '#6c757d'
    },
    statItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },

    // Empty state styles
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: '#6c757d'
    },
    emptyIcon: {
      fontSize: '64px',
      color: '#e9ecef',
      marginBottom: '20px'
    },
    emptyTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#495057',
      margin: '0 0 12px 0'
    },
    emptyDescription: {
      fontSize: '16px',
      lineHeight: '1.5',
      maxWidth: '400px',
      margin: '0 auto'
    },

    // Modal styles
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: '12px',
      width: '100%',
      maxWidth: '600px',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '24px 24px 0 24px',
      borderBottom: '1px solid #e9ecef',
      marginBottom: '24px'
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#2c2c54',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: 0
    },
    modalCloseButton: {
      width: '40px',
      height: '40px',
      border: 'none',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa',
      color: '#6c757d',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      transition: 'all 0.2s ease'
    },
    modalBody: {
      padding: '0 24px'
    },
    modalFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      padding: '24px',
      borderTop: '1px solid #e9ecef',
      marginTop: '24px'
    },

    // Form styles
    formGrid: {
      display: 'grid',
      gap: '20px'
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column'
    },
    formLabel: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#495057',
      marginBottom: '6px'
    },
    formInput: {
      padding: '12px',
      fontSize: '16px',
      border: '2px solid #e9ecef',
      borderRadius: '8px',
      backgroundColor: 'white',
      transition: 'border-color 0.3s ease',
      outline: 'none'
    },
    formTextarea: {
      padding: '12px',
      fontSize: '16px',
      border: '2px solid #e9ecef',
      borderRadius: '8px',
      backgroundColor: 'white',
      transition: 'border-color 0.3s ease',
      outline: 'none',
      resize: 'vertical',
      minHeight: '80px'
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '16px',
      color: '#333',
      cursor: 'pointer',
      userSelect: 'none'
    },
    checkbox: {
      width: '18px',
      height: '18px',
      accentColor: '#663399',
      cursor: 'pointer'
    },

    // Button styles
    saveButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 24px',
      backgroundColor: '#663399',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500',
      transition: 'all 0.3s ease'
    },
    cancelButton: {
      padding: '12px 24px',
      backgroundColor: '#f8f9fa',
      color: '#6c757d',
      border: '2px solid #e9ecef',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500',
      transition: 'all 0.3s ease'
    },
    dangerButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 24px',
      backgroundColor: '#dc3545',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500',
      transition: 'all 0.3s ease'
    },
    buttonSpinner: {
      width: '16px',
      height: '16px',
      border: '2px solid transparent',
      borderTop: '2px solid currentColor',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },

    // Confirmation modal styles
    confirmModalContent: {
      backgroundColor: 'white',
      borderRadius: '12px',
      width: '100%',
      maxWidth: '480px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
    },
    confirmModalHeader: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px 16px 24px',
      textAlign: 'center'
    },
    dangerIcon: {
      width: '64px',
      height: '64px',
      backgroundColor: '#fff5f5',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#dc3545',
      fontSize: '24px',
      marginBottom: '16px'
    },
    confirmTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#2c2c54',
      margin: 0
    },
    confirmModalBody: {
      padding: '0 24px 16px 24px',
      textAlign: 'center'
    },
    confirmMessage: {
      fontSize: '16px',
      color: '#495057',
      margin: '0 0 12px 0',
      lineHeight: '1.5'
    },
    confirmWarning: {
      fontSize: '14px',
      color: '#dc3545',
      margin: 0,
      fontWeight: '500'
    },
    confirmModalFooter: {
      display: 'flex',
      justifyContent: 'center',
      gap: '12px',
      padding: '24px',
      borderTop: '1px solid #e9ecef'
    }
  };

  // Main component return
  return (
    <AdminLayout>
      <div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            /* Hover effects */
            .admin-manage-papers button:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(102, 51, 153, 0.2);
            }
            
            .admin-manage-papers input:focus,
            .admin-manage-papers textarea:focus,
            .admin-manage-papers select:focus {
              border-color: #663399 !important;
              box-shadow: 0 0 0 3px rgba(102, 51, 153, 0.1) !important;
            }
            
            .admin-manage-papers .paper-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 24px rgba(102, 51, 153, 0.2) !important;
            }
            
            .admin-manage-papers .action-button:hover {
              background-color: #663399 !important;
              color: white !important;
            }
            
            .admin-manage-papers .delete-button:hover {
              background-color: #dc3545 !important;
              color: white !important;
            }
          `}
        </style>
        <div className="admin-manage-papers">
          {renderContent()}
          {renderEditModal()}
          {renderDeleteModal()}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminManagePapers;
