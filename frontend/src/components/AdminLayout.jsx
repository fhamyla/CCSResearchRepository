// Copyright (c) 2025 fhamyla
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FiHome, 
  FiUsers, 
  FiClock, 
  FiFileText, 
  FiMenu,
  FiX,
  FiLogOut,
  FiUser,
  FiGlobe
} from 'react-icons/fi';
import './AdminLayout.css';  const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/signin');
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      if (!['admin', 'moderator'].includes(parsedUser.role)) {
        navigate('/');
        return;
      }
      setUser(parsedUser);
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      navigate('/signin');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/signin');
  };

  const navigationItems = [
    {
      path: '/admin/dashboard',
      name: 'Dashboard',
      icon: FiHome
    },
    ...(user?.role === 'admin' ? [{
      path: '/admin/manage-users',
      name: 'Manage Users',
      icon: FiUsers
    }] : []),
    {
      path: '/admin/pending-approvals',
      name: 'Pending Approvals',
      icon: FiClock
    },
    {
      path: '/admin/paper-requests',
      name: 'Paper Requests',
      icon: FiFileText
    },
    {
      path: '/admin/manage-papers',
      name: 'Manage Papers',
      icon: FiFileText
    },
    {
      path: '/admin/active-sdgs',
      name: 'Active SDGs',
      icon: FiGlobe
    }
  ];

  if (!user) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {}
      <div className="admin-sidebar open">
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            {String(user?.role || "").toLowerCase() === "admin" ? (
              <h2>CCS Admin</h2>
            ) : (
              <h2
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate("/");
                }}
                style={{ cursor: "pointer" }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate("/");
                  }
                }}
              >
                CCS Moderator
              </h2>
            )}
          </div>
        </div>

        <nav className="admin-nav">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.path}
                className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon">
                  <IconComponent size={20} />
                </span>
                <span className="nav-label">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="user-avatar">
              <FiUser size={20} />
            </div>
            <div className="user-details">
              <p className="user-email">{user.email}</p>
              <p className="user-role">{user.role === 'admin' ? 'Administrator' : 'Moderator'}</p>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <FiLogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {}
      <div className="admin-main sidebar-open">
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
