import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { userService } from '../../services/service';
import { 
  FiUsers, 
  FiClock, 
  FiCheckCircle, 
  FiAward,
  FiRefreshCw,
  FiUser,
  FiTrash2,
  FiInfo
} from 'react-icons/fi';

const AdminManageUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);

  // Check if current user is admin (only admins can access this page)
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/signin');
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'admin') {
        navigate('/admin/dashboard'); // Redirect moderators to dashboard
        return;
      }
      setCurrentUser(parsedUser);
    } catch (error) {
      navigate('/signin');
    }
  }, [navigate]);

  // Load all users and statistics
  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        userService.getAllUsers(),
        userService.getUserStats()
      ]);
      
      setUsers(usersData);
      setStats(statsData);
    } catch (error) {
      setMessage('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter users based on search term and status
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'pending' && user.status === 'pending') ||
                         (filterStatus === 'approved' && user.status === 'approved') ||
                         (filterStatus === 'rejected' && user.status === 'rejected') ||
                         (filterStatus === 'admin' && user.role === 'admin') ||
                         (filterStatus === 'moderator' && user.role === 'moderator');
    
    return matchesSearch && matchesStatus;
  });

  // Handle role change
  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    try {
      await userService.updateUserRole(userId, newRole);
      setMessage('User role updated successfully');
      loadData(); // Reload data
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error updating user role: ' + error.message);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Handle status change
  const handleStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Are you sure you want to change this user's status to ${newStatus}?`)) {
      return;
    }

    try {
      await userService.updateUserStatus(userId, newStatus);
      setMessage(`User ${newStatus} successfully`);
      loadData(); // Reload data
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error updating user status: ' + error.message);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Handle delete user
  const handleDeleteUser = async (userId, userEmail) => {
    // Prevent admin from deleting themselves
    if (currentUser.id === userId) {
      setMessage('Error: You cannot delete your own account');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      return;
    }

    try {
      await userService.deleteUser(userId);
      setMessage('User deleted successfully');
      loadData(); // Reload data
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error deleting user: ' + error.message);
      setTimeout(() => setMessage(''), 5000);
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
      <div className="admin-manage-users">
        <div className="admin-card-header">
          <h1 className="admin-card-title">
            <FiUsers size={24} />
            Manage Users
          </h1>
        </div>

        {message && (
          <div className={`admin-alert ${message.includes('Error') ? 'admin-alert-error' : 'admin-alert-success'}`}>
            {message}
          </div>
        )}

        {/* Statistics */}
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
            <div className="stat-label">Pending Users</div>
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
              <FiAward size={28} />
            </div>
            <div className="stat-number">{stats.adminUsers || 0}</div>
            <div className="stat-label">Administrators</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FiUsers size={28} />
            </div>
            <div className="stat-number">{stats.moderatorUsers || 0}</div>
            <div className="stat-label">Moderators</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="admin-card">
          <div className="filters-section">
            <div className="admin-form-group">
              <label className="admin-form-label">Search Users</label>
              <input
                type="text"
                className="admin-form-input"
                placeholder="Search by email or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Filter by Status</label>
              <select
                className="admin-form-input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="admin">Administrators</option>
                <option value="moderator">Moderators</option>
              </select>
            </div>
            <div className="admin-form-group">
              <button className="admin-btn admin-btn-primary" onClick={loadData} disabled={loading}>
                <FiRefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              Users List ({filteredUsers.length})
            </h2>
          </div>

          {loading ? (
            <div className="admin-loading">
              <div className="admin-loading-spinner"></div>
              <p>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="admin-alert admin-alert-info">
              <p>{searchTerm || filterStatus !== 'all' ? 'No users found matching your filters.' : 'No users found in the system.'}</p>
            </div>
          ) : (
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    const isCurrentUser = currentUser.id === user._id;
                    const isFirstAdmin = user.role === 'admin' && user.createdAt === stats.recentUsers?.find(u => u.role === 'admin')?.createdAt;
                    
                    return (
                      <tr key={user._id}>
                        <td>
                          <div className="user-cell">
                            <div className="user-avatar">
                              <FiUser size={16} />
                            </div>
                            <div>
                              <div className="user-email">{user.email}</div>
                              {isCurrentUser && <span className="current-user-badge">You</span>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            className="status-select"
                            value={user.status || 'pending'}
                            onChange={(e) => handleStatusChange(user._id, e.target.value)}
                            disabled={isCurrentUser || ['admin', 'moderator'].includes(user.role)}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="role-select"
                            value={user.role}
                            onChange={(e) => handleRoleChange(user._id, e.target.value)}
                            disabled={isCurrentUser}
                          >
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            {/* Show admin option only if user is already admin (for display purposes) */}
                            {user.role === 'admin' && <option value="admin">Admin</option>}
                          </select>
                        </td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>
                          <button
                            className="admin-btn admin-btn-danger"
                            onClick={() => handleDeleteUser(user._id, user.email)}
                            disabled={isCurrentUser}
                            title={isCurrentUser ? 'Cannot delete your own account' : 'Delete user'}
                          >
                            <FiTrash2 size={16} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help Information */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <FiInfo size={20} />
              User Management Guide
            </h2>
          </div>
          <div className="help-content">
            <div className="help-section">
              <h4>User Statuses</h4>
              <ul>
                <li><strong>Pending:</strong> User registered but awaiting admin approval</li>
                <li><strong>Approved:</strong> User can log in and access the system</li>
                <li><strong>Rejected:</strong> User registration was declined</li>
              </ul>
            </div>
            <div className="help-section">
              <h4>User Roles</h4>
              <ul>
                <li><strong>User:</strong> Can upload and manage their own papers, view public papers</li>
                <li><strong>Admin:</strong> Can manage all papers and users, has full system access</li>
              </ul>
            </div>
            <div className="help-section">
              <h4>Important Notes</h4>
              <ul>
                <li>You cannot delete your own admin account or change your own role</li>
                <li>Role and status changes take effect immediately</li>
                <li>Users receive email notifications when their status changes</li>
                <li>Deleting a user permanently removes their account and associated data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-manage-users {
          max-width: 1400px;
        }

        .filters-section {
          display: grid;
          grid-template-columns: 1fr 200px 120px;
          gap: 20px;
          align-items: end;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 35px;
          height: 35px;
          background: var(--royal-velvet-bg);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: var(--royal-velvet);
        }

        .user-email {
          font-weight: 500;
          color: var(--text-dark);
        }

        .current-user-badge {
          background: var(--royal-velvet);
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-select, .role-select {
          padding: 6px 12px;
          border: 2px solid var(--medium-gray);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .status-select:focus, .role-select:focus {
          outline: none;
          border-color: var(--royal-velvet);
        }

        .status-select[value="pending"] {
          background: rgba(255, 193, 7, 0.1);
          color: #856404;
        }

        .status-select[value="approved"] {
          background: rgba(40, 167, 69, 0.1);
          color: #155724;
        }

        .status-select[value="rejected"] {
          background: rgba(220, 53, 69, 0.1);
          color: #721c24;
        }

        .role-select[value="user"] {
          background: rgba(102, 51, 153, 0.1);
          color: var(--royal-velvet);
        }

        .role-select[value="admin"] {
          background: rgba(220, 53, 69, 0.1);
          color: #721c24;
        }

        .help-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 25px;
        }

        .help-section h4 {
          margin: 0 0 10px 0;
          color: var(--royal-velvet);
          font-size: 16px;
        }

        .help-section ul {
          margin: 0;
          padding-left: 20px;
        }

        .help-section li {
          margin-bottom: 8px;
          color: var(--text-dark);
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .filters-section {
            grid-template-columns: 1fr;
          }
          
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .help-content {
            grid-template-columns: 1fr;
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

export default AdminManageUsers;
