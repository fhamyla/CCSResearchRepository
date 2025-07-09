import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperService } from '../services/service';
import Modal from 'react-modal';

const MyPaperRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [previewPaper, setPreviewPaper] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (!loggedInUser) {
      navigate('/signin');
      return;
    }
    const parsedUser = JSON.parse(loggedInUser);
    setUser(parsedUser);
    fetchRequests(parsedUser.id);
    // eslint-disable-next-line
  }, []);

  const fetchRequests = async (userId) => {
    setLoading(true);
    setError('');
    try {
      const data = await paperService.getUserPaperRequests(userId);
      setRequests(data);
    } catch (err) {
      setError('Failed to load requests: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (request) => {
    setPreviewPaper(request);
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewUrl('');
    try {
      const permission = await paperService.checkDownloadPermission(request.paperId, user.id);
      if (!permission.canDownload) {
        setPreviewError('You no longer have permission to preview this paper.');
        setPreviewLoading(false);
        return;
      }
      const response = await paperService.downloadPaper(request.paperId, user.id, true);
      if (!response || !response.data) throw new Error('No file data');
      const contentType = response.headers['content-type'] || response.headers['Content-Type'] || 'application/pdf';
      const blob = new Blob([response.data], { type: contentType });
      if (blob.size === 0) throw new Error('File is empty');
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      setPreviewError('Failed to load preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewPaper(null);
    setPreviewUrl('');
    setPreviewError('');
  };

  return (
    <div className="my-paper-requests-container" style={{ maxWidth: 800, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <h1 style={{ marginBottom: 24 }}>My Paper Access Requests</h1>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : requests.length === 0 ? (
        <div>No paper access requests found.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>Paper Title</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Requested On</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req._id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{req.paperTitle}</td>
                <td style={{ padding: 8 }}>
                  {req.status === 'approved' ? (
                    <span style={{ color: 'green', fontWeight: 500 }}>Approved</span>
                  ) : req.status === 'pending' ? (
                    <span style={{ color: '#ff9800', fontWeight: 500 }}>Pending</span>
                  ) : (
                    <span style={{ color: 'red', fontWeight: 500 }}>Rejected</span>
                  )}
                </td>
                <td style={{ padding: 8 }}>{new Date(req.requestDate).toLocaleString()}</td>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => handlePreview(req)}
                    disabled={req.status !== 'approved'}
                    style={{
                      background: req.status === 'approved' ? '#800000' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 16px',
                      cursor: req.status === 'approved' ? 'pointer' : 'not-allowed',
                      fontWeight: 500
                    }}
                  >
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Preview Modal */}
      <Modal
        isOpen={!!previewPaper}
        onRequestClose={closePreview}
        contentLabel="Preview Research Paper"
        style={{
          overlay: { zIndex: 1000, background: 'rgba(0,0,0,0.5)' },
          content: { maxWidth: '900px', margin: 'auto', height: '90vh', padding: '0', borderRadius: '12px', overflow: 'hidden' }
        }}
        ariaHideApp={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '16px', background: '#800000', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Preview: {previewPaper?.paperTitle}</span>
            <button onClick={closePreview} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer' }}>&times;</button>
          </div>
          <div style={{ flex: 1, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {previewLoading ? (
              <span style={{ color: 'white' }}>Loading preview...</span>
            ) : previewError ? (
              <span style={{ color: 'red' }}>{previewError}</span>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                title="Research Paper Preview"
                style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
              />
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyPaperRequests; 