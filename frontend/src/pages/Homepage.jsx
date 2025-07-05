import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/service';
import PaperDetailModal from '../components/PaperDetailModal';
import AuthorDetailModal from '../components/AuthorDetailModal';
import CitationModal from '../components/CitationModal';
import { getAllSDGs, getSDGFullText, sdgMatches, normalizeSDG } from '../utils/sdgUtils';
import { 
  FiBarChart2, 
  FiUsers, 
  FiClock, 
  FiFileText, 
  FiSettings,
  FiLogOut,
  FiUser,
  FiThumbsUp,
  FiMessageCircle,
  FiActivity,
  FiX,
  FiBookmark,
  FiBookOpen,
  FiDownload
} from 'react-icons/fi';
import '../../styles/Homepage.css';

const Homepage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Date');
  const [user, setUser] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPaperForCitation, setSelectedPaperForCitation] = useState(null);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    sdgs: [],
    yearRange: { min: '', max: '' },
    publisher: '',
    journal: '',
    program: ''
  });
  const filtersRef = useRef(null);

  // Check if user is logged in when component mounts
  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (loggedInUser) {
      const parsedUser = JSON.parse(loggedInUser);
      setUser(parsedUser);
      
      // Redirect admin users to admin dashboard
      if (parsedUser.role === 'admin') {
        navigate('/admin/dashboard');
        return;
      }
    }
    loadPapers();
  }, [navigate]);

  // Load papers from database
  const loadPapers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await paperService.getPublicPapers();
      setPapers(data);
    } catch (error) {
      setError('Failed to load papers: ' + error.message);
      console.error('Error loading papers:', error);
    } finally {
      setLoading(false);
    }
  };
  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleSDGToggle = (sdg) => {
    setFilters(prev => ({
      ...prev,
      sdgs: prev.sdgs.includes(sdg) 
        ? prev.sdgs.filter(s => s !== sdg)
        : [...prev.sdgs, sdg]
    }));
  };

  const clearFilters = () => {
    setFilters({
      sdgs: [],
      yearRange: { min: '', max: '' },
      publisher: '',
      journal: '',
      program: ''
    });
  };
  const getAvailableSDGs = () => {
    // Use the utility function to get standardized SDG list
    return getAllSDGs();
  };

  const clearSDGFilters = () => {
    setFilters(prev => ({
      ...prev,
      sdgs: []
    }));
  };

  const getAvailablePublishers = () => {
    const publishers = new Set();
    papers.forEach(paper => {
      if (paper.publisher) {
        const publisherName = typeof paper.publisher === 'object' 
          ? (paper.publisher.name || paper.publisher.id || 'Unknown Publisher')
          : paper.publisher;
        publishers.add(publisherName);
      }
    });
    return Array.from(publishers).sort();
  };

  const getAvailableJournals = () => {
    const journals = new Set();
    papers.forEach(paper => {
      if (paper.journal) {
        const journalName = typeof paper.journal === 'object' 
          ? (paper.journal.name || paper.journal.id || 'Unknown Journal')
          : paper.journal;
        journals.add(journalName);
      }
    });
    return Array.from(journals).sort();
  };

  const getAvailablePrograms = () => {
    const programs = new Set();
    papers.forEach(paper => {
      if (paper.ownerDepartment && paper.ownerDepartment !== 'Unknown') {
        programs.add(paper.ownerDepartment);
      }
    });
    return Array.from(programs).sort();
  };

  const handlePaperTitleClick = (paperId) => {
    // Ensure paperId is a string or number, not an object
    const id = typeof paperId === 'object' && paperId !== null ? paperId.id : paperId;
    setSelectedPaperId(id);
    setIsModalOpen(true);
  };

  const handleAuthorClick = (author) => {
    const authorName = typeof author === 'object' 
      ? (author.name || 'Unknown Author') 
      : (String(author) || 'Unknown Author');
    
    setSelectedAuthor(authorName);
    setIsAuthorModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPaperId(null);
  };

  const handleCloseAuthorModal = () => {
    setIsAuthorModalOpen(false);
    setSelectedAuthor(null);
  };

  const handleCiteClick = (paper) => {
    setSelectedPaperForCitation(paper);
    setIsCitationModalOpen(true);
  };

  const handleCloseCitationModal = () => {
    setIsCitationModalOpen(false);
    setSelectedPaperForCitation(null);
  };

  const filteredPapers = papers.filter(paper => {
    // Text search
    const matchesSearch = searchQuery === '' || 
      (typeof paper.title === 'object' ? 
        (paper.title.text || paper.title.content || '').toLowerCase().includes(searchQuery.toLowerCase()) :
        (paper.title || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
      (paper.authors && paper.authors.some(author => 
        typeof author === 'object'
          ? (author.name && author.name.toLowerCase().includes(searchQuery.toLowerCase()))
          : (String(author) || '').toLowerCase().includes(searchQuery.toLowerCase())
      )) ||
      (paper.tags && paper.tags.some(tag => {
        const tagName = typeof tag === 'object' ? (tag.name || tag.id || '') : (tag || '');
        return tagName.toLowerCase().includes(searchQuery.toLowerCase());
      })) ||
      (paper.abstract && (
        typeof paper.abstract === 'object' ? 
          (paper.abstract.text || paper.abstract.content || '').toLowerCase().includes(searchQuery.toLowerCase()) :
          (paper.abstract || '').toLowerCase().includes(searchQuery.toLowerCase())
      )) ||
      (paper.description && (
        typeof paper.description === 'object' ? 
          (paper.description.text || paper.description.content || '').toLowerCase().includes(searchQuery.toLowerCase()) :
          (paper.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      ));

    if (!matchesSearch) return false;

    // SDG filter
    if (filters.sdgs.length > 0) {
      const paperSDGs = paper.sdgs || [];
      const hasMatchingSDG = filters.sdgs.some(filterSDG => {
        return paperSDGs.some(paperSDG => sdgMatches(filterSDG, paperSDG));
      });
      if (!hasMatchingSDG) return false;
    }

    // Year range filter
    const paperYear = typeof paper.year === 'object' ? 
      (paper.year.value || paper.year.id || 0) : 
      (paper.year || 0);
    
    if (filters.yearRange.min && parseInt(paperYear) < parseInt(filters.yearRange.min)) {
      return false;
    }
    if (filters.yearRange.max && parseInt(paperYear) > parseInt(filters.yearRange.max)) {
      return false;
    }

    // Publisher filter
    if (filters.publisher) {
      const paperPublisher = typeof paper.publisher === 'object' 
        ? (paper.publisher.name || paper.publisher.id || 'Unknown Publisher')
        : paper.publisher;
      if (paperPublisher !== filters.publisher) {
        return false;
      }
    }

    // Journal filter
    if (filters.journal) {
      const paperJournal = typeof paper.journal === 'object' 
        ? (paper.journal.name || paper.journal.id || 'Unknown Journal')
        : paper.journal;
      if (paperJournal !== filters.journal) {
        return false;
      }
    }

    // Program filter (based on paper owner's department)
    if (filters.program) {
      if (paper.ownerDepartment !== filters.program) {
        return false;
      }
    }

    return true;
  });

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    switch (sortBy) {
      case 'Date':
        const yearA = typeof a.year === 'object' ? (a.year.value || a.year.id || 0) : (a.year || 0);
        const yearB = typeof b.year === 'object' ? (b.year.value || b.year.id || 0) : (b.year || 0);
        return parseInt(yearB) - parseInt(yearA);
      default:
        return 0;
    }
  });

  return (
    <div className="homepage">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <h1>CCS Research Repository</h1>
          </div>
          <div className="header-actions">
            {user ? (
              <div className="nav-links">
                {user.role === 'user' ? (
                  <>
                    <button 
                      className="nav-link" 
                      onClick={() => navigate('/manage-papers')}
                    >
                      <FiFileText size={16} /> My Submissions
                    </button>
                  </>
                ) : user.role === 'moderator' ? (
                  <>
                    <button 
                      className="nav-link" 
                      onClick={() => navigate('/manage-papers')}
                    >
                      <FiFileText size={16} /> My Submissions
                    </button>
                    <button 
                      className="nav-link" 
                      onClick={() => navigate('/admin/dashboard')}
                    >
                      <FiBarChart2 size={16} /> Manage System
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className="nav-link" 
                      onClick={() => navigate('/admin/dashboard')}
                    >
                      <FiBarChart2 size={16} /> Dashboard
                    </button>
                    <button 
                      className="nav-link" 
                      onClick={() => navigate('/admin/pending-approvals')}
                    >
                      <FiClock size={16} /> Approvals
                    </button>
                    <button 
                      className="nav-link" 
                      onClick={() => navigate('/admin/manage-papers')}
                    >
                      <FiFileText size={16} /> Papers
                    </button>
                    <button 
                      className="nav-link" 
                      onClick={() => navigate('/admin/manage-users')}
                    >
                      <FiUsers size={16} /> Users
                    </button>
                  </>
                )}
                <div className="user-info-nav">
                  <span className="user-email-display"><FiUser size={16} /> {user.email}</span>
                  <button 
                    className="logout-nav-btn" 
                    onClick={handleLogout}
                  >
                    <FiLogOut size={16} /> Logout
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="sign-in-btn"
                onClick={() => navigate('/signin')}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          {/* Title and Description */}
          <div className="title-section">
            <h2><FiFileText size={24} /> Research Repository</h2>
            <p>Discover, explore, and engage with the latest computer and communication sciences research.</p>
          </div>          
          
          {/* Search and Filters */}
          <div className="search-section">
            <div className="search-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Search by title, authors, tags, abstract..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <button className="search-btn"><FiFileText size={16} /> Search</button>
              </div>              
              <div className="filters">
                <div className="filter-dropdown-container" ref={filtersRef}>
                  <button 
                    className={`filter-btn ${showFilters ? 'active' : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <FiSettings size={16} /> Filters {(filters.sdgs.length > 0 || filters.publisher || filters.journal || filters.yearRange.min || filters.yearRange.max) && <span className="filter-count">({filters.sdgs.length + (filters.publisher ? 1 : 0) + (filters.journal ? 1 : 0) + (filters.yearRange.min ? 1 : 0) + (filters.yearRange.max ? 1 : 0)})</span>}
                  </button>
                  
                  {showFilters && (
                    <div className="filter-dropdown">
                      <div className="filter-section">
                        <h4>Sustainable Development Goals (SDGs)</h4>
                        {filters.sdgs.length > 0 && (
                          <div className="sdg-selection-summary">
                            {filters.sdgs.length} SDG{filters.sdgs.length > 1 ? 's' : ''} selected
                            <button onClick={clearSDGFilters} className="sdg-clear-btn">
                              Clear SDGs
                            </button>
                          </div>
                        )}
                        <div className="sdg-scrollable-container">
                          {getAvailableSDGs().map(sdg => (
                            <label key={sdg} className="sdg-checkbox-item">
                              <input
                                type="checkbox"
                                checked={filters.sdgs.includes(sdg)}
                                onChange={() => handleSDGToggle(sdg)}
                              />
                              <span className="sdg-label">{sdg.replace('SDG ', '')}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="filter-section">
                        <h4>Year Range</h4>
                        <div className="year-range-inputs">
                          <input
                            type="number"
                            placeholder="From"
                            value={filters.yearRange.min}
                            onChange={(e) => handleFilterChange('yearRange', { ...filters.yearRange, min: e.target.value })}
                            className="year-input"
                          />
                          <span>to</span>
                          <input
                            type="number"
                            placeholder="To"
                            value={filters.yearRange.max}
                            onChange={(e) => handleFilterChange('yearRange', { ...filters.yearRange, max: e.target.value })}
                            className="year-input"
                          />
                        </div>
                      </div>

                      <div className="filter-section">
                        <h4>Publisher</h4>
                        <select
                          value={filters.publisher}
                          onChange={(e) => handleFilterChange('publisher', e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All Publishers</option>
                          {getAvailablePublishers().map(publisher => (
                            <option key={publisher} value={publisher}>{publisher}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-section">
                        <h4>Journal</h4>
                        <select
                          value={filters.journal}
                          onChange={(e) => handleFilterChange('journal', e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All Journals</option>
                          {getAvailableJournals().map(journal => (
                            <option key={journal} value={journal}>{journal}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-section">
                        <h4>Program</h4>
                        <select
                          value={filters.program}
                          onChange={(e) => handleFilterChange('program', e.target.value)}
                          className="filter-select"
                        >
                          <option value="">All Programs</option>
                          {getAvailablePrograms().map(program => (
                            <option key={program} value={program}>{program}</option>
                          ))}
                        </select>
                      </div>

                      <div className="filter-actions">
                        <button onClick={clearFilters} className="clear-filters-btn">
                          <FiX size={16} /> Clear All Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  className="filter-btn"
                  onClick={loadPapers}
                  disabled={loading}
                  style={{ marginLeft: '10px' }}
                >
                  {loading ? <FiActivity size={16} /> : <FiActivity size={16} />} Refresh
                </button>
              </div>
            </div>
            {error && (
              <div style={{ 
                color: '#d32f2f', 
                backgroundColor: '#ffebee', 
                padding: '10px', 
                borderRadius: '4px', 
                margin: '10px 0',
                border: '1px solid #ffcdd2'
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Active Filters Display */}
          {(filters.sdgs.length > 0 || filters.publisher || filters.journal || filters.program || filters.yearRange.min || filters.yearRange.max) && (
            <div className="active-filters">
              <div className="active-filters-header">
                <span>Active Filters:</span>
                <button onClick={clearFilters} className="clear-all-btn"><FiX size={14} /> Clear All</button>
              </div>
              <div className="active-filters-list">
                {filters.sdgs.map(sdg => (
                  <span key={sdg} className="active-filter">
                    {sdg}
                    <button onClick={() => handleSDGToggle(sdg)} className="remove-filter">×</button>
                  </span>
                ))}
                {filters.publisher && (
                  <span className="active-filter">
                    Publisher: {filters.publisher}
                    <button onClick={() => handleFilterChange('publisher', '')} className="remove-filter">×</button>
                  </span>
                )}
                {filters.journal && (
                  <span className="active-filter">
                    Journal: {filters.journal}
                    <button onClick={() => handleFilterChange('journal', '')} className="remove-filter">×</button>
                  </span>
                )}
                {filters.program && (
                  <span className="active-filter">
                    Program: {filters.program}
                    <button onClick={() => handleFilterChange('program', '')} className="remove-filter">×</button>
                  </span>
                )}
                {(filters.yearRange.min || filters.yearRange.max) && (
                  <span className="active-filter">
                    Year: {filters.yearRange.min || '*'} - {filters.yearRange.max || '*'}
                    <button onClick={() => handleFilterChange('yearRange', { min: '', max: '' })} className="remove-filter">×</button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Results and Sort */}
          <div className="results-header">
            <span className="results-count">{sortedPapers.length} results</span>
            <div className="sort-section">
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="Date">Date</option>
              </select>
            </div>
          </div>
          
          {/* Papers List */}
          <div className="papers-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: '#666' }}>
                Loading papers...
              </div>
            ) : sortedPapers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: '#666' }}>
                {papers.length === 0 ? 'No papers available yet.' : 'No papers match your search criteria.'}
              </div>
            ) : sortedPapers.map(paper => (
              <div key={paper.id} className="paper-card">
                <div className="paper-content">
                  <h3 
                    className="paper-title" 
                    onClick={() => handlePaperTitleClick(paper.id)}
                  >
                    {typeof paper.title === 'object' ? 
                      (paper.title.text || paper.title.content || 'Untitled Paper') : 
                      (paper.title || 'Untitled Paper')}
                  </h3>
                  
                  <div className="paper-meta">
                    <span className="journal">
                      {typeof paper.journal === 'object' ? 
                        (paper.journal.name || 'No Journal') : 
                        (paper.journal || 'No Journal')}
                    </span>
                    <span className="year">• 
                      {typeof paper.year === 'object' ? 
                        (paper.year.value || 'No Year') : 
                        (paper.year || 'No Year')}
                    </span>
                    <span className="doi">• 
                      {typeof paper.doi === 'object' ? 
                        (paper.doi.value || 'No DOI') : 
                        (paper.doi || 'No DOI')}
                    </span>
                  </div>

                  <div className="authors">
                    {paper.authors && paper.authors.map((author, index) => (
                      <span 
                        key={index} 
                        className="author"
                        onClick={() => handleAuthorClick(author)}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                      >
                        <FiUser size={14} /> {typeof author === 'object' 
                          ? (author.name || 'Unknown Author') 
                          : (String(author) || 'Unknown Author')}
                      </span>
                    ))}
                  </div>

                  <p className="abstract">
                    {typeof paper.abstract === 'object' ? 
                      (paper.abstract.text || paper.abstract.content || 'No abstract available.') : 
                      (paper.abstract || 'No abstract available.')}
                  </p>
                  
                  <div className="tags">
                    {paper.tags && paper.tags.map((tag, index) => (
                      <span key={index} className="tag">
                        {typeof tag === 'object' ? 
                          (tag.name || tag.id || 'Unknown Tag') : 
                          (tag || 'Unknown Tag')}
                      </span>
                    ))}
                  </div>

                  {paper.sdgs && paper.sdgs.length > 0 && (
                    <div className="sdgs">
                      <span className="sdgs-label">SDGs:</span>
                      {paper.sdgs.map((sdg, index) => (
                        <span key={index} className="sdg-tag">
                          {getSDGFullText(sdg)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="paper-stats">
                    <div className="stats-left">
                      <span className="likes"><FiThumbsUp size={16} /> {typeof paper.likes === 'object' ? 
                        (paper.likes.id ? String(paper.likes.id) : '0') : 
                        (paper.likes || '0')}</span>
                      <span className="comments"><FiMessageCircle size={16} /> {Array.isArray(paper.comments) ? 
                        paper.comments.length : 
                        (typeof paper.comments === 'object' ? 
                          (paper.comments.id ? String(paper.comments.id) : '0') : 
                          (paper.comments || '0'))}</span>
                      <span className="citations"><FiBookOpen size={16} /> {paper.citationCount || 0}</span>
                      <span className="downloads"><FiDownload size={16} /> {paper.downloadCount || 0}</span>
                    </div>
                    <div className="stats-right">
                      <button 
                        className="cite-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCiteClick(paper);
                        }}
                      >
                        <FiBookmark size={16} /> Cite
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Paper Detail Modal */}
      <PaperDetailModal
        paperId={selectedPaperId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        user={user}
      />

      {/* Author Detail Modal */}
      <AuthorDetailModal
        authorName={selectedAuthor}
        isOpen={isAuthorModalOpen}
        onClose={handleCloseAuthorModal}
      />

      {/* Citation Modal */}
      <CitationModal
        paper={selectedPaperForCitation}
        isOpen={isCitationModalOpen}
        onClose={handleCloseCitationModal}
      />
    </div>
  );
};

export default Homepage;
