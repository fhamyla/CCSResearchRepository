import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { userService } from '../../services/service';
import { 
  FiClock, 
  FiCheckCircle, 
  FiXCircle, 
  FiUser,
  FiRefreshCw,
  FiFileText,
  FiMail,
  FiAlertCircle
} from 'react-icons/fi';

const AdminPendingApprovals = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [processingUsers, setProcessingUsers] = useState(new Set());

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    setLoading(true);
    try {
      const users = await userService.getPendingUsers();
      setPendingUsers(users);
    } catch (error) {
      setMessage('Error loading pending users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId, action) => {
    if (processingUsers.has(userId)) return;

    setProcessingUsers(prev => new Set(prev).add(userId));
    
    try {
      await userService.updateUserStatus(userId, action);
      setMessage(`User ${action} successfully!`);
      
      // Remove user from pending list
      setPendingUsers(prev => prev.filter(user => user._id !== userId));
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`Error ${action}ing user: ` + error.message);
    } finally {
      setProcessingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
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

  return (
    <AdminLayout>
      <div className="admin-pending-approvals">
        <div className="admin-card-header">
          <h1 className="admin-card-title">
            <FiClock size={24} />
            Pending User Approvals
          </h1>
        </div>

        {message && (
          <div className={`admin-alert ${message.includes('Error') ? 'admin-alert-error' : 'admin-alert-success'}`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="admin-card">
            <div className="admin-loading">
              <div className="admin-loading-spinner"></div>
              <p>Loading pending users...</p>
            </div>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="admin-card">
            <div className="admin-alert admin-alert-info">
              <FiCheckCircle size={24} />
              <div>
                <h3>All caught up!</h3>
                <p>There are no users pending approval at the moment.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                Users Awaiting Approval ({pendingUsers.length})
              </h2>
            </div>

            <div className="pending-users-grid">
              {pendingUsers.map((user) => (
                <div key={user._id} className="pending-user-card">
                  <div className="user-info">
                    <div className="user-avatar">
                      <FiUser size={20} />
                    </div>
                    <div className="user-details">
                      <h3 className="user-email">{user.email}</h3>
                      <p className="user-registered">
                        Registered: {formatDate(user.createdAt)}
                      </p>
                      <div className="user-meta">
                        <span className="status-badge status-pending">
                          {user.status || 'pending'}
                        </span>
                        <span className="role-badge">
                          {user.role}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="user-actions">
                    <button
                      className="admin-btn admin-btn-success"
                      onClick={() => handleUserAction(user._id, 'approved')}
                      disabled={processingUsers.has(user._id)}
                    >
                      {processingUsers.has(user._id) ? <FiClock size={16} /> : <FiCheckCircle size={16} />} 
                      Approve
                    </button>
                    <button
                      className="admin-btn admin-btn-danger"
                      onClick={() => handleUserAction(user._id, 'rejected')}
                      disabled={processingUsers.has(user._id)}
                    >
                      {processingUsers.has(user._id) ? <FiClock size={16} /> : <FiXCircle size={16} />} 
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="approval-actions">
              <button
                className="admin-btn admin-btn-primary"
                onClick={loadPendingUsers}
                disabled={loading}
              >
                <FiRefreshCw size={16} />
                Refresh List
              </button>
            </div>
          </div>
        )}

        {/* Approval Guidelines */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <FiFileText size={20} />
              Approval Guidelines
            </h2>
          </div>
          <div className="guidelines">
            <div className="guideline-item">
              <span className="guideline-icon">
                <FiCheckCircle size={24} />
              </span>
              <div>
                <strong>Approve when:</strong>
                <ul>
                  <li>Email address appears to be from a legitimate academic institution</li>
                  <li>Registration information seems authentic</li>
                  <li>User has followed proper registration process</li>
                </ul>
              </div>
            </div>
            <div className="guideline-item">
              <span className="guideline-icon">
                <FiXCircle size={24} />
              </span>
              <div>
                <strong>Reject when:</strong>
                <ul>
                  <li>Email address appears suspicious or fake</li>
                  <li>Multiple suspicious accounts from same source</li>
                  <li>Obvious spam or bot registration</li>
                </ul>
              </div>
            </div>
            <div className="guideline-item">
              <span className="guideline-icon">
                <FiMail size={24} />
              </span>
              <div>
                <strong>Email Notifications:</strong>
                <p>Users will automatically receive email notifications when their account is approved or rejected.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-pending-approvals {
          max-width: 1200px;
        }

        .pending-users-grid {
          display: grid;
          gap: 20px;
          margin-bottom: 20px;
        }

        .pending-user-card {
          background: var(--white);
          border: 2px solid var(--royal-velvet-bg);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
        }

        .pending-user-card:hover {
          border-color: var(--royal-velvet);
          box-shadow: var(--shadow);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 15px;
          flex: 1;
        }

        .user-avatar {
          width: 50px;
          height: 50px;
          background: var(--royal-velvet-bg);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: var(--royal-velvet);
        }

        .user-details {
          flex: 1;
        }

        .user-email {
          margin: 0 0 5px 0;
          color: var(--royal-velvet);
          font-size: 18px;
          font-weight: 600;
        }

        .user-registered {
          margin: 0 0 10px 0;
          color: var(--dark-gray);
          font-size: 14px;
        }

        .user-meta {
          display: flex;
          gap: 10px;
        }

        .role-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(102, 51, 153, 0.1);
          color: var(--royal-velvet);
        }

        .user-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .approval-actions {
          display: flex;
          justify-content: center;
          padding-top: 20px;
          border-top: 1px solid var(--medium-gray);
        }

        .guidelines {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .guideline-item {
          display: flex;
          gap: 15px;
          align-items: flex-start;
        }

        .guideline-icon {
          font-size: 24px;
          min-width: 30px;
        }

        .guideline-item h4 {
          margin: 0 0 8px 0;
          color: var(--royal-velvet);
        }

        .guideline-item ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .guideline-item li {
          margin-bottom: 4px;
          color: var(--text-dark);
        }

        .guideline-item p {
          margin: 8px 0 0 0;
          color: var(--text-dark);
        }

        @media (max-width: 768px) {
          .pending-user-card {
            flex-direction: column;
            gap: 15px;
            align-items: stretch;
          }

          .user-info {
            flex-direction: column;
            text-align: center;
          }

          .user-actions {
            justify-content: center;
          }

          .guideline-item {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </AdminLayout>
  );
};

export default AdminPendingApprovals;
