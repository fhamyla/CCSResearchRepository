import React, { useState, useEffect } from 'react';
import { paperService } from '../services/service';
import './AuthorDetailModal.css';
import { 
  FiFileText, 
  FiThumbsUp, 
  FiActivity,
  FiX,
  FiExternalLink,
  FiBookmark,
  FiCalendar,
  FiTag,
  FiMail
} from 'react-icons/fi';

const AuthorDetailModal = ({ authorName, isOpen, onClose }) => {
  const [authorData, setAuthorData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && authorName) {
      loadAuthorDetails(authorName);
    }
  }, [isOpen, authorName]);

  const loadAuthorDetails = async (name) => {
    setLoading(true);
    setError('');
    try {
      console.log('Loading author details for:', name);
      const data = await paperService.getAuthorDetails(name);
      console.log('Author data received:', data);
      setAuthorData(data);
    } catch (error) {
      setError('Failed to load author details: ' + error.message);
      console.error('Error loading author details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="author-modal-overlay" onClick={onClose}>
      <div className="author-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="author-modal-header">
          <h2>Author Profile</h2>
          <button className="author-close-button" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="author-modal-content">
          {loading ? (
            <div className="author-loading-state">Loading author details...</div>
          ) : error ? (
            <div className="author-error-state">{error}</div>
          ) : authorData ? (
            <>
              <div className="author-profile-header">
                <h1 className="author-name">{authorData.name}</h1>
                <div className="author-affiliation">{authorData.affiliation}</div>
                {authorData.email && (
                  <div className="author-email">
                    <FiMail size={16} /> {authorData.email}
                  </div>
                )}
              </div>

              <div className="author-stats">
                <div className="author-stat-item">
                  <FiFileText size={20} />
                  <span className="stat-label">Publications:</span>
                  <span className="stat-value">{authorData.publicationCount}</span>
                </div>
                <div className="author-stat-item">
                  <FiThumbsUp size={20} />
                  <span className="stat-label">Total Likes:</span>
                  <span className="stat-value">{authorData.totalLikes}</span>
                </div>
                <div className="author-stat-item">
                  <FiActivity size={20} />
                  <span className="stat-label">Activity Level:</span>
                  <span className="stat-value">{authorData.activityLevel}</span>
                </div>
              </div>

              {authorData.researchInterests && authorData.researchInterests.length > 0 && (
                <div className="author-research-interests">
                  <h3><FiTag size={18} /> Research Interests</h3>
                  <div className="interests-list">
                    {authorData.researchInterests.map((interest, index) => (
                      <span key={index} className="interest-tag">{interest}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="author-research-papers">
                <h3><FiBookmark size={18} /> Research Papers</h3>
                {authorData.papers && authorData.papers.length > 0 ? (
                  <div className="author-papers-list">
                    {authorData.papers.map((paper, index) => (
                      <div key={index} className="author-paper-item">
                        <h4 className="author-paper-title">{paper.title}</h4>
                        <div className="author-paper-meta">
                          <span><FiFileText size={14} /> {paper.journal}</span>
                          <span>• <FiCalendar size={14} /> {paper.year}</span>
                          {paper.doi && <span>• <FiExternalLink size={14} /> {paper.doi}</span>}
                        </div>
                        <div className="author-paper-stats">
                          <span><FiThumbsUp size={14} /> {paper.likes}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-papers-message">No papers available for this author.</p>
                )}
              </div>
            </>
          ) : (
            <div className="author-error-state">No data available for this author</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthorDetailModal;
