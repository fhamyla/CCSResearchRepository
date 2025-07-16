/*
MIT License

Copyright (c) 2025 fhamyla

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { userService, paperService } from '../../services/service';
import { 
  FiBarChart2, 
  FiUsers, 
  FiClock, 
  FiCheckCircle, 
  FiAward,
  FiZap,
  FiPlus,
  FiFileText,
  FiActivity,
  FiServer,
  FiMail,
  FiDatabase,
  FiBook,
  FiDownload,
  FiBookOpen,
  FiGlobe,
  FiTrendingUp
} from 'react-icons/fi';

const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState([]);
  const [updatingFingerprints, setUpdatingFingerprints] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsData, paperStats] = await Promise.all([
        userService.getUserStats(),
        paperService.adminGetPaperStats()
      ]);
      setStats({ ...statsData, ...paperStats });
      setRecentUsers(statsData.recentUsers || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
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

  const handleUpdateContentFingerprints = async () => {
    setUpdatingFingerprints(true);
    try {
      const result = await paperService.updateContentFingerprints();
      alert(`Content fingerprint update completed!\nUpdated: ${result.updatedCount} papers\nErrors: ${result.errorCount}\nTotal: ${result.totalPapers} papers`);
    } catch (error) {
      alert('Failed to update content fingerprints: ' + error.message);
    } finally {
      setUpdatingFingerprints(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <div className="admin-card-header">
          <h1 className="admin-card-title">
            <FiBarChart2 size={24} />
            Admin Dashboard
          </h1>
        </div>

        {/* Statistics Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <FiUsers size={28} />
            </div>
            <div className="stat-number">{stats.totalUsers || 0}</div>
            <div className="stat-label">Total Users</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FiClock size={28} />
            </div>
            <div className="stat-number">{stats.pendingUsers || 0}</div>
            <div className="stat-label">Pending Approvals</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FiCheckCircle size={28} />
            </div>
            <div className="stat-number">{stats.approvedUsers || 0}</div>
            <div className="stat-label">Approved Users</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FiFileText size={28} />
            </div>
            <div className="stat-number">{stats.computerSciencePapers || 0}</div>
            <div className="stat-label">Computer Science Papers</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FiBook size={28} />
            </div>
            <div className="stat-number">{stats.informationTechnologyPapers || 0}</div>
            <div className="stat-label">Information Technology Papers</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FiBookOpen size={28} />
            </div>
            <div className="stat-number">{stats.totalCitations || 0}</div>
            <div className="stat-label">Total Citations</div>
          </div>


        </div>



        {/* Quick Actions */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <FiZap size={20} />
              Quick Actions
            </h2>
          </div>
          <div className="quick-actions">
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => window.location.href = '/admin/pending-approvals'}
            >
              <FiClock size={16} />
              Review Pending Users ({stats.pendingUsers || 0})
            </button>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => window.location.href = '/admin/manage-users'}
            >
              <FiUsers size={16} />
              Manage All Users
            </button>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => window.location.href = '/admin/manage-papers'}
            >
              <FiFileText size={16} />
              Manage Papers
            </button>
            <button 
              className="admin-btn admin-btn-secondary"
              onClick={handleUpdateContentFingerprints}
              disabled={updatingFingerprints}
            >
              <FiDatabase size={16} />
              {updatingFingerprints ? 'Updating...' : 'Update Content Fingerprints'}
            </button>
          </div>
        </div>

        {/* Recent Users */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <FiPlus size={20} />
              Recent Registrations
            </h2>
          </div>
          {recentUsers.length > 0 ? (
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user._id}>
                      <td>{user.email}</td>
                      <td>
                        <span className={`status-badge status-${user.status || 'pending'}`}>
                          {user.status || 'pending'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.role === 'admin' ? 'status-approved' : 'status-pending'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-alert admin-alert-info">
              <p>No recent user registrations found.</p>
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <FiServer size={20} />
              System Status
            </h2>
          </div>
          <div className="system-status">
            <div className="status-item">
              <span className="status-indicator status-good"></span>
              <FiActivity size={16} />
              <span>User Registration System: Active</span>
            </div>
            <div className="status-item">
              <span className="status-indicator status-good"></span>
              <FiMail size={16} />
              <span>Email Notifications: Working</span>
            </div>
            <div className="status-item">
              <span className="status-indicator status-good"></span>
              <FiDatabase size={16} />
              <span>Database Connection: Stable</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-dashboard {
          max-width: 1200px;
        }

        .quick-actions {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }

        .admin-btn {
          background: linear-gradient(135deg, #4A102A 0%, #85193C 25%, #C5172E 75%, #FCF259 100%);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .admin-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .admin-btn-secondary {
          background: linear-gradient(135deg, #4A102A 0%, #85193C 25%, #C5172E 75%, #FCF259 100%);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .admin-btn-secondary:hover {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .admin-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .system-status {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 500;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .status-good {
          background-color: #28a745;
        }

        .status-warning {
          background-color: #ffc107;
        }

        .status-error {
          background-color: #dc3545;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .quick-actions {
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AdminLayout>
  );
};

export default AdminDashboard;
