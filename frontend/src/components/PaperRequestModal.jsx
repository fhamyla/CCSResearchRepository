import React, { useState } from 'react';
import { FiSend, FiX } from 'react-icons/fi';
import './PaperRequestModal.css';

const PaperRequestModal = ({ isOpen, onClose, paperId, paperTitle, onSubmit }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('Please provide a reason for your request');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      await onSubmit(paperId, reason.trim());
      setSuccess(true);
      setReason('');
    } catch (error) {
      setError(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="request-modal-overlay" onClick={onClose}>
      <div className="request-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="request-modal-header">
          <h2>Request Paper Access</h2>
          <button className="close-button" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="request-modal-content">
          {success ? (
            <div className="success-message">
              <h3>Request Submitted Successfully!</h3>
              <p>Your request for "{paperTitle}" has been submitted to the administrators.</p>
              <p>You will receive an email notification once your request has been processed.</p>
              <button className="close-btn" onClick={onClose}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="paper-info">
                <p><strong>Paper:</strong> {paperTitle}</p>
              </div>
              
              <div className="form-group">
                <label htmlFor="reason">Why do you need access to this paper?</label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a brief explanation of why you need access to this paper..."
                  rows={5}
                  required
                />
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <div className="request-modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn" 
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={isSubmitting || !reason.trim()}
                >
                  {isSubmitting ? 'Submitting...' : (
                    <>
                      <FiSend size={16} /> Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperRequestModal;
