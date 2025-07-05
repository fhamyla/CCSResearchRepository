import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiCopy, FiCheckCircle } from 'react-icons/fi';
import './CitationModal.css';

const CitationModal = ({ paper, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const citationRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !paper) return null;

  // Generate APA citation
  const generateAPACitation = () => {
    if (!paper) return '';

    const authors = paper.authors && paper.authors.length > 0
      ? paper.authors.map(author => {
          let authorName = typeof author === 'object' 
            ? (author.name || 'Unknown Author') 
            : (String(author) || 'Unknown Author');
          
          // Remove extra commas and trim whitespace
          authorName = authorName.replace(/,+/g, ',').trim();
          
          // Handle case where name is already in "Lastname, F." format
          if (authorName.includes(',')) {
            return authorName;
          }
          
          // Parse author name to get last name and initials
          const nameParts = authorName.split(' ').filter(part => part.trim() !== '');
          
          // If we have nothing after parsing, return the original
          if (nameParts.length === 0) {
            return authorName;
          }
          
          // Last part is assumed to be the last name
          const lastName = nameParts.pop() || '';
          
          // Get first letter of each first/middle name
          const initials = nameParts
            .map(part => part.charAt(0).toUpperCase() + '.')
            .join('');
          
          return `${lastName}, ${initials}`;
        }).join(', ')
      : 'Unknown Author';

    const title = typeof paper.title === 'object' 
      ? (paper.title.text || paper.title.content || 'Untitled Paper') 
      : (paper.title || 'Untitled Paper');

    const journal = typeof paper.journal === 'object' 
      ? (paper.journal.name || '') 
      : (paper.journal || '');

    const year = typeof paper.year === 'object' 
      ? (paper.year.value || '') 
      : (paper.year || '');

    const volume = paper.volume || '';
    const issue = paper.issue || '';
    const pages = paper.pages || '';

    // Build the APA citation
    let citation = `${authors} (${year}). ${title}`;
    
    if (journal) {
      citation += `. ${journal}`;
      
      if (volume) {
        citation += `, ${volume}`;
        
        if (issue) {
          citation += `(${issue})`;
        }
      }
      
      if (pages) {
        citation += `, ${pages}`;
      }
    }
    
    citation += '.';
    
    // DOI is now completely removed from the citation

    return citation;
  };

  const handleCopyClick = async () => {
    const citation = generateAPACitation();
    navigator.clipboard.writeText(citation);
    setCopied(true);
    
    // Track citation count
    if (paper && paper.id) {
      try {
        const { paperService } = await import('../services/service');
        await paperService.trackCitation(paper.id);
      } catch (error) {
        console.error('Failed to track citation:', error);
        // Don't show error to user as it's a background operation
      }
    }
  };

  return (
    <div className="citation-modal-overlay">
      <div className="citation-modal" ref={modalRef}>
        <div className="citation-modal-header">
          <h3>Citation</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>
        <div className="citation-modal-content">
          <div className="citation-format">
            <h4>APA Format</h4>
            <div className="citation-text" ref={citationRef}>
              {generateAPACitation()}
            </div>
          </div>
          <div className="citation-actions">
            <button 
              className="copy-btn" 
              onClick={handleCopyClick}
              disabled={copied}
            >
              {copied ? (
                <>
                  <FiCheckCircle size={16} /> Copied
                </>
              ) : (
                <>
                  <FiCopy size={16} /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitationModal;
