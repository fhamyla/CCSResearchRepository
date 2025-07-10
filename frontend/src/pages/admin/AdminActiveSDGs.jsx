import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { paperService } from '../../services/service';
import { 
  FiGlobe, 
  FiTrendingUp,
  FiFileText,
  FiCalendar,
  FiUser,
  FiBarChart2
} from 'react-icons/fi';

const AdminActiveSDGs = () => {
  const [sdgStats, setSdgStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [totalPapers, setTotalPapers] = useState(0);
  const [activeSDGs, setActiveSDGs] = useState(0);

  useEffect(() => {
    loadSDGData();
  }, []);

  const loadSDGData = async () => {
    try {
      const stats = await paperService.adminGetPaperStats();
      setSdgStats(stats.sdgStats || {});
      
      // Calculate totals
      const activeSDGsCount = Object.values(stats.sdgStats || {}).filter(data => data.count > 0).length;
      const totalPapersCount = Object.values(stats.sdgStats || {}).reduce((sum, data) => sum + data.count, 0);
      
      setActiveSDGs(activeSDGsCount);
      setTotalPapers(totalPapersCount);
    } catch (error) {
      console.error('Error loading SDG data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAuthorNames = (authors) => {
    if (!authors || !Array.isArray(authors)) return 'Unknown';
    
    return authors.map(author => {
      if (typeof author === 'string') return author;
      if (typeof author === 'object') {
        if (author.name) return author.name;
        if (author.firstName && author.lastName) return `${author.firstName} ${author.lastName}`;
        return 'Unknown Author';
      }
      return 'Unknown Author';
    }).join(', ');
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-loading">
          <div className="admin-loading-spinner"></div>
          <p>Loading SDG statistics...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-active-sdgs">
        <div className="admin-card-header">
          <h1 className="admin-card-title">
            <FiGlobe size={24} />
            Active Sustainable Development Goals (SDGs)
          </h1>
        </div>

        {/* Summary Statistics */}
        <div className="sdg-summary-stats">
          <div className="sdg-summary-card">
            <div className="sdg-summary-icon">
              <FiBarChart2 size={28} />
            </div>
            <div className="sdg-summary-number">{activeSDGs}</div>
            <div className="sdg-summary-label">Active SDGs</div>
          </div>
        </div>

        {/* SDG Statistics Grid */}
        <div className="sdg-stats-grid">
          {Object.entries(sdgStats)
            .filter(([key, data]) => data.count > 0) // Only show SDGs with papers
            .sort(([,a], [,b]) => b.count - a.count) // Sort by count descending
            .map(([key, data]) => (
              <div key={key} className="sdg-stat-card">
                <div className="sdg-stat-header">
                  <div className="sdg-stat-icon">
                    <FiTrendingUp size={24} />
                  </div>
                  <div className="sdg-stat-number">{data.count}</div>
                </div>
                <div className="sdg-stat-label">{data.name}</div>
                <div className="sdg-stat-papers">
                  {data.papers.slice(0, 5).map((paper, index) => (
                    <div key={index} className="sdg-paper-item">
                      <div className="sdg-paper-info">
                        <div className="sdg-paper-title">{paper.title}</div>
                        <div className="sdg-paper-details">
                          <span className="sdg-paper-authors">
                            <FiUser size={12} />
                            {formatAuthorNames(paper.authors)}
                          </span>
                          <span className="sdg-paper-year">
                            <FiCalendar size={12} />
                            {paper.year}
                          </span>
                          {paper.journal && (
                            <span className="sdg-paper-journal">
                              <FiFileText size={12} />
                              {paper.journal}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.papers.length > 5 && (
                    <div className="sdg-paper-more">
                      +{data.papers.length - 5} more papers
                    </div>
                  )}
                </div>
              </div>
            ))}
          {activeSDGs === 0 && (
            <div className="admin-alert admin-alert-info">
              <p>No papers have been tagged with SDGs yet.</p>
            </div>
          )}
        </div>

        <style>{`
          .admin-active-sdgs {
            max-width: 1200px;
          }

          .sdg-summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }

          .sdg-summary-card {
            background: linear-gradient(135deg, #800020 0%, #8B0000 100%);
            border-radius: 12px;
            padding: 25px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
          }

          .sdg-summary-card:hover {
            transform: translateY(-2px);
          }

          .sdg-summary-icon {
            margin-bottom: 10px;
            opacity: 0.8;
          }

          .sdg-summary-number {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 5px;
          }

          .sdg-summary-label {
            font-size: 1rem;
            opacity: 0.9;
          }

          .sdg-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
          }

          .sdg-stat-card {
            background: linear-gradient(135deg, #800020 0%, #8B0000 100%);
            border-radius: 12px;
            padding: 25px;
            color: white;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }

          .sdg-stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          }

          .sdg-stat-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
          }

          .sdg-stat-icon {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .sdg-stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            color: #fff;
          }

          .sdg-stat-label {
            font-size: 1rem;
            font-weight: 500;
            margin-bottom: 20px;
            opacity: 0.9;
          }

          .sdg-stat-papers {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .sdg-paper-item {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            transition: background-color 0.2s ease;
          }

          .sdg-paper-item:hover {
            background: rgba(255, 255, 255, 0.15);
          }

          .sdg-paper-info {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .sdg-paper-title {
            font-size: 0.9rem;
            font-weight: 500;
            line-height: 1.3;
          }

          .sdg-paper-details {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 0.75rem;
            opacity: 0.8;
          }

          .sdg-paper-authors,
          .sdg-paper-year,
          .sdg-paper-journal {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .sdg-paper-more {
            text-align: center;
            font-size: 0.8rem;
            opacity: 0.7;
            font-style: italic;
            padding: 8px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
          }

          @media (max-width: 768px) {
            .sdg-summary-stats {
              grid-template-columns: repeat(2, 1fr);
            }
            
            .sdg-stats-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 480px) {
            .sdg-summary-stats {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </AdminLayout>
  );
};

export default AdminActiveSDGs; 