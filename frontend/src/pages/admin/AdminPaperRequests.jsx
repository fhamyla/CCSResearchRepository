import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { paperService } from '../../services/service';
import { 
  FiFileText, 
  FiUser, 
  FiClock, 
  FiCheckCircle, 
  FiXCircle, 
  FiRefreshCw,
  FiMail,
  FiMessageCircle,
  FiAlertCircle,
  FiInfo
} from 'react-icons/fi';
import './AdminPaperRequests.css';

const AdminPaperRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(new Set());
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminMessage, setAdminMessage] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await paperService.getAdminPaperRequests();
      setRequests(data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to load paper requests: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (requestId, status) => {
    if (processing.has(requestId)) return;

    // Get admin user from localStorage
    const adminUserJson = localStorage.getItem('user');
    if (!adminUserJson) {
      setMessage({
        type: 'error',
        text: 'Admin user information not found. Please log in again.'
      });
      return;
    }

    const adminUser = JSON.parse(adminUserJson);
    
    setProcessing(prev => new Set(prev).add(requestId));
    
    try {
      await paperService.processPaperRequest(requestId, {
        status,
        adminId: adminUser.id,
        adminMessage: adminMessage
      });
      
      // Update requests list
      setRequests(prev => prev.filter(req => req._id !== requestId));
      
      setMessage({
        type: 'success',
        text: `Paper request ${status === 'approved' ? 'approved' : 'rejected'} successfully!`
      });
      
      setSelectedRequest(null);
      setAdminMessage('');
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to process request: ${error.message}`
      });
    } finally {
      setProcessing(prev => {
        const updated = new Set(prev);
        updated.delete(requestId);
        return updated;
      });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderRequestModal = () => {
    if (!selectedRequest) return null;

    return (
      <div className="request-detail-overlay" onClick={() => setSelectedRequest(null)}>
        <div className="request-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="request-detail-header">
            <h2>Paper Request Details</h2>
            <button onClick={() => setSelectedRequest(null)}>
              <FiXCircle size={20} />
            </button>
          </div>
          
          <div className="request-detail-content">
            <div className="request-info">
              <h3>
                <FiFileText size={18} /> Paper Information
              </h3>
              <p><strong>Title:</strong> {selectedRequest.paperTitle}</p>
              <p><strong>Requested on:</strong> {formatDate(selectedRequest.createdAt)}</p>
              
              <h3>
                <FiUser size={18} /> Requester Information
              </h3>
              <p>
                <strong>Email:</strong> {selectedRequest.userId?.email || 'Unknown'}
              </p>
              <p>
                <strong>Name:</strong> {selectedRequest.userId?.firstName 
                  ? `${selectedRequest.userId.firstName} ${selectedRequest.userId.lastName || ''}`
                  : 'N/A'}
              </p>
              
              <h3>
                <FiMessageCircle size={18} /> Request Reason
              </h3>
              <div className="request-reason">
                {selectedRequest.reason}
              </div>
              
              <div className="admin-response">
                <h3>
                  <FiMail size={18} /> Your Response
                </h3>
                <textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Optional: Add a message to include in the email notification..."
                  rows={4}
                />
              </div>
            </div>
            
            <div className="request-actions">
              <button 
                className="reject-btn"
                onClick={() => handleProcess(selectedRequest._id, 'rejected')}
                disabled={processing.has(selectedRequest._id)}
              >
                <FiXCircle size={16} /> {processing.has(selectedRequest._id) ? 'Processing...' : 'Reject Request'}
              </button>
              <button 
                className="approve-btn"
                onClick={() => handleProcess(selectedRequest._id, 'approved')}
                disabled={processing.has(selectedRequest._id)}
              >
                <FiCheckCircle size={16} /> {processing.has(selectedRequest._id) ? 'Processing...' : 'Approve & Send Paper'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout activeTab="paper-requests">
      <div className="admin-paper-requests">
        <div className="page-header">
          <h1>Paper Access Requests</h1>
          <button onClick={loadRequests} className="refresh-btn">
            <FiRefreshCw size={16} /> Refresh
          </button>
        </div>
        
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.type === 'error' 
              ? <FiAlertCircle size={18} /> 
              : <FiCheckCircle size={18} />} 
            {message.text}
          </div>
        )}
        
        {loading ? (
          <div className="loading-state">Loading paper requests...</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <FiInfo size={40} />
            <h2>No Pending Requests</h2>
            <p>There are no paper access requests waiting for your approval.</p>
          </div>
        ) : (
          <div className="requests-table-container">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Requester</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request._id}>
                    <td className="paper-title">{request.paperTitle}</td>
                    <td>{request.userId?.email || 'Unknown'}</td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td>
                      <span className={`status ${request.status}`}>
                        {request.status === 'pending' ? (
                          <><FiClock size={14} /> Pending</>
                        ) : request.status === 'approved' ? (
                          <><FiCheckCircle size={14} /> Approved</>
                        ) : (
                          <><FiXCircle size={14} /> Rejected</>
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="view-btn"
                          onClick={() => setSelectedRequest(request)}
                          disabled={request.status !== 'pending'}
                        >
                          View & Process
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {renderRequestModal()}
    </AdminLayout>
  );
};

export default AdminPaperRequests;
