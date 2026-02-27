// Copyright (c) 2025 fhamyla
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { paperService, userService } from "../services/service";
import { getSDGDescription } from "../utils/sdgUtils";
import "../styles/ManagePapers.css";
import Modal from "react-modal";

const ManagePapers = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [journal, setJournal] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [publisher, setPublisher] = useState("");
  const [authorsList, setAuthorsList] = useState([]);
  const [keywordsList, setKeywordsList] = useState([]);
  const [selectedSDGs, setSelectedSDGs] = useState([]);
  const [setCurrentAuthor] = useState("");
  // eslint-disable-next-line no-empty-pattern
  const [] = useState("");
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [doi, setDoi] = useState("");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [references, setReferences] = useState("");
  const [, setConferenceProceeding] = useState(false);
  const [hasPublisher, setHasPublisher] = useState(false);
  const [hasDoi, setHasDoi] = useState(false);
  const [hasConference, setHasConference] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [authorSearchTerm, setAuthorSearchTerm] = useState("");
  const [previewPaper, setPreviewPaper] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const sdgOptions = [
    { id: 1, name: "No Poverty" },
    { id: 2, name: "Zero Hunger" },
    { id: 3, name: "Good Health and Well-being" },
    { id: 4, name: "Quality Education" },
    { id: 5, name: "Gender Equality" },
    { id: 6, name: "Clean Water and Sanitation" },
    { id: 7, name: "Affordable and Clean Energy" },
    { id: 8, name: "Decent Work and Economic Growth" },
    { id: 9, name: "Industry, Innovation and Infrastructure" },
    { id: 10, name: "Reduced Inequalities" },
    { id: 11, name: "Sustainable Cities and Communities" },
    { id: 12, name: "Responsible Consumption and Production" },
    { id: 13, name: "Climate Action" },
    { id: 14, name: "Life Below Water" },
    { id: 15, name: "Life on Land" },
    { id: 16, name: "Peace, Justice and Strong Institutions" },
    { id: 17, name: "Partnerships for the Goals" },
  ];

  const getUserId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        return userData.id || userData._id;
      } catch (error) {
        console.error("Error parsing user data from localStorage:", error);
        return null;
      }
    }
    return null;
  };

  const formatUserName = (user) => {
    if (!user) return "Unknown User";

    const firstName = (user.firstName || "").trim();
    const lastName = (user.lastName || "").trim();

    if (firstName && lastName) {
      return `${lastName}, ${firstName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else if (user.email) {
      return user.email.split("@")[0];
    } else {
      return "Unknown User";
    }
  };
  const userId = getUserId();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshUserDataIfNeeded = async () => {
    const currentUser = getUserFromLocalStorage();
    if (currentUser && (!currentUser.firstName || !currentUser.lastName)) {
      try {
        setMessage(
          "Please log out and log in again to update your profile information.",
        );
      } catch (error) {
        console.error("Error refreshing user data:", error);
      }
    }
  };

  // define loadPapers before any effect calls it
  const loadPapers = useCallback(async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    try {
      const userPapers = await paperService.getUserPapers(userId);
      setPapers(userPapers);
    } catch (error) {
      setMessage("Error loading papers: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setMessage("Please log in to access your papers.");
      navigate("/signin");
      return;
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (userId) {
      loadPapers();
    }
  }, [loadPapers, userId]);

  useEffect(() => {
    if (userId) {
      fetchUsers();
    }
  }, [userId]);

  useEffect(() => {
    refreshUserDataIfNeeded();
  }, [refreshUserDataIfNeeded]);

  const fetchUsers = async () => {
    try {
      const users = await userService.getAllUsersForCoAuthors();

      const processedUsers = users.map((user) => ({
        ...user,
        _id: user._id || user.id,
        id: user.id || user._id,
      }));

      setAllUsers(processedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      console.error("Full error details:", JSON.stringify(error, null, 2));
      setMessage(
        `Error fetching users: ${error.message || JSON.stringify(error)}`,
      );
    }
  };

  const handleFileSelect = async (file) => {
    if (file) {
      const allowedTypes = ["application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        setMessage("Only PDF files are allowed");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setMessage("File size must be less than 15MB");
        return;
      }
      setSelectedFile(file);
      setMessage("Analyzing PDF for metadata...");
      setLoading(true);
      try {
        const data = await paperService.analyzePDF(file);

        if (data.warning) {
          setMessage(
            `Warning: ${data.warning}. Please review and edit the extracted information.`,
          );
        } else {
          setMessage(
            "PDF analyzed successfully. Please review and edit the extracted information.",
          );
        }

        setTitle(data.title || "");
        setAbstract(data.abstract || "");
        setKeywordsList(Array.isArray(data.keywords) ? data.keywords : []);
        setSelectedSDGs(Array.isArray(data.sdgs) ? data.sdgs : []);
      } catch (err) {
        console.error("PDF analysis error:", err);
        let errorMessage =
          "Could not auto-extract metadata from PDF. Please fill in the details manually.";

        if (err.message.includes("password-protected")) {
          errorMessage =
            "This PDF is password-protected and cannot be analyzed. Please enter the details manually.";
        } else if (err.message.includes("not a valid PDF")) {
          errorMessage =
            "The uploaded file is not a valid PDF or is corrupted. Please try a different file.";
        } else if (err.message.includes("too large")) {
          errorMessage =
            "The PDF is too large or complex to analyze. Please enter the details manually.";
        } else if (err.message.includes("scanned document")) {
          errorMessage =
            "This appears to be a scanned document. Please enter the details manually.";
        } else if (err.message.includes("research paper")) {
          errorMessage = err.message;
        } else if (err.message.includes("insufficient text content")) {
          errorMessage =
            "This document has insufficient text content. Please upload a complete research paper.";
        } else if (err.message.includes("non-research content")) {
          errorMessage =
            "This document does not appear to be a research paper. Please upload an academic paper with proper research structure.";
        } else if (
          err.message.includes("empty document") ||
          err.message.includes("test document")
        ) {
          errorMessage =
            "Empty or test documents are not allowed. Please upload your actual research paper.";
        }

        setMessage(errorMessage);
        setTitle("");
        setAbstract("");
        setKeywordsList([]);
        setSelectedSDGs([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setTitle("");
  };

  const addAuthor = () => {
    if (selectedUserId) {
      const selectedUser = allUsers.find(
        (user) => user._id === selectedUserId || user.id === selectedUserId,
      );

      if (!selectedUser) {
        setMessage("Selected user not found");
        return;
      }

      const authorDetails = {
        userId: selectedUser._id || selectedUser.id,
        name: formatUserName(selectedUser),
        email: selectedUser.email,
        phone: selectedUser.phoneNumber || "",
      };

      const authorExists = authorsList.some(
        (author) => author.userId === authorDetails.userId,
      );

      if (!authorExists) {
        setAuthorsList([...authorsList, authorDetails]);
        setSelectedUserId("");
        setAuthorSearchTerm("");
        setMessage("");
      } else {
        setMessage("This user is already added as an author");
      }
    } else {
      setMessage("Please select a user to add as an author");
    }
  };

  const removeAuthor = (index) => {
    setAuthorsList(authorsList.filter((_, i) => i !== index));
  };

  const filteredUsers = allUsers.filter((user) => {
    if (!authorSearchTerm) return true;

    const formattedName = formatUserName(user).toLowerCase();
    const firstName = (user.firstName || "").toLowerCase();
    const lastName = (user.lastName || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const department = (user.department || "").toLowerCase();
    const searchLower = authorSearchTerm.toLowerCase();

    return (
      formattedName.includes(searchLower) ||
      firstName.includes(searchLower) ||
      lastName.includes(searchLower) ||
      email.includes(searchLower) ||
      department.includes(searchLower)
    );
  });

  const addKeyword = () => {
    if (
      currentKeyword.trim() &&
      !keywordsList.includes(currentKeyword.trim())
    ) {
      setKeywordsList([...keywordsList, currentKeyword.trim()]);
      setCurrentKeyword("");
    }
  };

  const removeKeyword = (index) => {
    setKeywordsList(keywordsList.filter((_, i) => i !== index));
  };

  const handleSDGChange = (sdgId) => {
    setSelectedSDGs((prev) =>
      prev.includes(sdgId)
        ? prev.filter((id) => id !== sdgId)
        : [...prev, sdgId],
    );
  };

  const openUploadModal = () => {
    resetForm();
    setShowUploadModal(true);
    setAuthorSearchTerm("");
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    resetForm();
    setAuthorSearchTerm("");
  };

  const openEditModal = (paper) => {
    setSelectedPaper(paper);
    setShowEditModal(true);
    setTitle(paper.title || "");
    setAbstract(paper.abstract || paper.description || "");
    setJournal(paper.journal || "");
    setYear(paper.year || new Date().getFullYear().toString());
    setPublisher(paper.publisher || "");
    setDoi(paper.doi || "");
    setReferences(paper.references || "");
    setAuthorsList(paper.authors || []);
    setKeywordsList(paper.tags || paper.keywords || []);

    let sdgs = [];
    if (paper.sdgs) {
      if (Array.isArray(paper.sdgs)) {
        if (paper.sdgs.length > 0 && typeof paper.sdgs[0] === "object") {
          sdgs = paper.sdgs.map((sdg) => sdg.id || sdg);
        } else {
          sdgs = paper.sdgs.map((sdg) =>
            typeof sdg === "string" ? parseInt(sdg, 10) || sdg : sdg,
          );
        }
      }
    }
    setSelectedSDGs(sdgs);

    setIsPublished(paper.isPublished || false);
    setConferenceProceeding(paper.conferenceProceeding || false);
    setHasPublisher(!!paper.publisher);
    setHasDoi(!!paper.doi);
    setHasConference(paper.conferenceProceeding || false);
    setAuthorSearchTerm("");

    if (paper.isOwner) {
      setMessage("You are editing this paper as the main author.");
    } else if (paper.isCoAuthor) {
      setMessage("You are editing this paper as a co-author.");
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedPaper(null);
    resetForm();
    setAuthorSearchTerm("");
  };

  const resetForm = () => {
    const currentUser = getUserFromLocalStorage();
    const currentUserId = getUserId();

    const initialAuthorsList = currentUser
      ? [
          {
            userId: currentUserId,
            name: formatUserName(currentUser),
            email: currentUser.email,
            phone: currentUser.phoneNumber || "",
          },
        ]
      : [];

    setSelectedFile(null);
    setTitle("");
    setAbstract("");
    setJournal("");
    setPublisher("");
    setYear(new Date().getFullYear().toString());
    setAuthorsList(initialAuthorsList);
    setKeywordsList([]);
    setSelectedSDGs([]);
    setCurrentAuthor("");
    setCurrentKeyword("");
    setDoi("");
    setSelectedPaper(null);
    setIsPublished(false);
    setReferences("");
    setConferenceProceeding(false);
    setHasPublisher(false);
    setHasDoi(false);
    setHasConference(false);
    setSelectedUserId("");
  };

  const getUserFromLocalStorage = () => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        userData.id = userData.id || userData._id;
        userData._id = userData._id || userData.id;
        return userData;
      } catch (error) {
        console.error("Error parsing user data from localStorage:", error);
        return null;
      }
    }
    return null;
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setMessage("Please select a file");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setMessage("Only PDF files are allowed");
      return;
    }

    if (authorsList.length === 0) {
      setMessage("Please add at least one author");
      return;
    }

    if (keywordsList.length === 0) {
      setMessage("Please add at least one keyword");
      return;
    }

    if (!abstract.trim()) {
      setMessage("Please enter an abstract");
      return;
    }

    if (isPublished && !journal.trim()) {
      setMessage("Please enter a journal name");
      return;
    }

    if (isPublished && hasPublisher && !publisher.trim()) {
      setMessage("Please enter a publisher");
      return;
    }

    if (isPublished && hasDoi && !doi.trim()) {
      setMessage("Please enter a DOI");
      return;
    }

    if (selectedSDGs.length === 0) {
      setMessage("Please select at least one SDG");
      return;
    }

    setUploading(true);
    try {
      const additionalData = {
        journal: isPublished ? journal : "",
        isPublished,
        year,
        publisher: isPublished && hasPublisher ? publisher : "",
        authors: authorsList,
        tags: keywordsList,
        sdgs: selectedSDGs.map((sdg) =>
          typeof sdg === "object" ? sdg : { id: sdg },
        ),
        doi: isPublished && hasDoi ? doi : "",
        references,
        conferenceProceeding: isPublished && hasConference,
      };

      await paperService.upload(
        selectedFile,
        userId,
        title,
        abstract,
        additionalData,
      );
      setMessage("Paper uploaded successfully!");
      closeUploadModal();
      loadPapers();
    } catch (error) {
      if (error.isDuplicate) {
        const duplicateMessage = `Duplicate paper detected: ${error.reason}. `;
        if (error.existingPaper) {
          const existingPaper = error.existingPaper;
          const authorNames =
            existingPaper.authors && existingPaper.authors.length > 0
              ? existingPaper.authors
                  .map((author) =>
                    typeof author === "object"
                      ? author.name ||
                        `${author.firstName || ""} ${author.lastName || ""}`.trim()
                      : author,
                  )
                  .join(", ")
              : "Unknown";

          setMessage(
            `${duplicateMessage}Existing paper: "${existingPaper.title}" by ${authorNames} (uploaded on ${new Date(existingPaper.uploadDate).toLocaleDateString()})`,
          );
        } else {
          setMessage(duplicateMessage);
        }
      } else if (error.isInvalidContent) {
        setMessage(`File content validation failed: ${error.reason}`);
      } else if (error.isValidationError) {
        setMessage(error.message);
      } else {
        setMessage("Upload failed: " + error.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (authorsList.length === 0) {
      setMessage("Please add at least one author");
      return;
    }

    if (keywordsList.length === 0) {
      setMessage("Please add at least one keyword");
      return;
    }

    if (!abstract.trim()) {
      setMessage("Please enter an abstract");
      return;
    }

    if (isPublished && !journal.trim()) {
      setMessage("Please enter a journal name");
      return;
    }

    if (isPublished && hasPublisher && !publisher.trim()) {
      setMessage("Please enter a publisher");
      return;
    }

    if (isPublished && hasDoi && !doi.trim()) {
      setMessage("Please enter a DOI");
      return;
    }

    if (selectedSDGs.length === 0) {
      setMessage("Please select at least one SDG");
      return;
    }

    setUploading(true);
    try {
      if (selectedPaper.isOwner) {
        setMessage("Paper updated successfully as main author!");
      } else if (selectedPaper.isCoAuthor) {
        setMessage("Paper updated successfully as a co-author!");
      } else {
        setMessage("Paper updated successfully!");
      }

      closeEditModal();
      loadPapers();
    } catch (error) {
      setMessage("Update failed: " + (error.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (paper) => {
    setPreviewPaper(paper);
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewUrl("");
    try {
      if (paper.isOwner) {
        const response = await paperService.downloadPaper(
          paper.id,
          userId,
          true,
        );
        if (!response || !response.data) throw new Error("No file data");
        const contentType =
          response.headers["content-type"] ||
          response.headers["Content-Type"] ||
          "application/pdf";
        const blob = new Blob([response.data], { type: contentType });
        if (blob.size === 0) throw new Error("File is empty");
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else {
        const permission = await paperService.checkDownloadPermission(
          paper.id,
          userId,
        );
        if (!permission.canDownload) {
          setPreviewPaper(null);
          setMessage(
            permission.reason || "You need permission to preview this paper.",
          );
          return;
        }
        const response = await paperService.downloadPaper(
          paper.id,
          userId,
          true,
        );
        if (!response || !response.data) throw new Error("No file data");
        const contentType =
          response.headers["content-type"] ||
          response.headers["Content-Type"] ||
          "application/pdf";
        const blob = new Blob([response.data], { type: contentType });
        if (blob.size === 0) throw new Error("File is empty");
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      setPreviewError("Failed to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewPaper(null);
    setPreviewUrl("");
    setPreviewError("");
  };

  const handleDelete = async (paper) => {
    if (window.confirm(`Are you sure you want to delete "${paper.title}"?`)) {
      try {
        await paperService.deletePaper(paper.id, userId);
        setMessage("Paper deleted successfully");
        loadPapers();
      } catch (error) {
        setMessage("Delete failed: " + error.message);
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderAuthorSearchUI = () => {
    return (
      <>
        <div className="search-input-container">
          <div className="search-input-wrapper">
            <i className="fas fa-search search-icon"></i>
            <input
              type="text"
              value={authorSearchTerm}
              onChange={(e) => setAuthorSearchTerm(e.target.value)}
              placeholder="Search authors by name, email, or department..."
              className="form-input search-input"
            />
            {authorSearchTerm && (
              <button
                className="clear-search-btn"
                onClick={() => setAuthorSearchTerm("")}
                title="Clear search"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>

        {}
        {authorSearchTerm.length > 0 && filteredUsers.length > 0 && (
          <div className="author-search-results">
            {filteredUsers.map((user) => {
              const isCurrentUser = (user._id || user.id) === userId;
              const isAlreadyAdded = authorsList.some(
                (author) => author.userId === (user._id || user.id),
              );
              const userFullName = formatUserName(user);

              return (
                <div
                  key={user._id || user.id}
                  className={`author-search-item ${isCurrentUser || isAlreadyAdded ? "disabled" : ""}`}
                  onClick={() => {
                    if (!isCurrentUser && !isAlreadyAdded) {
                      setSelectedUserId(user._id || user.id);
                      addAuthor();
                    }
                  }}
                  title={
                    isCurrentUser
                      ? "This is you (already added as main author)"
                      : isAlreadyAdded
                        ? "Already added as a co-author"
                        : "Click to add as co-author"
                  }
                >
                  <div className="author-info">
                    <div className="author-name">{userFullName}</div>
                    <div className="author-email">{user.email}</div>
                    {user.department && (
                      <div className="author-department">{user.department}</div>
                    )}
                  </div>
                  {!isCurrentUser && !isAlreadyAdded && (
                    <div className="add-author-icon">
                      <i className="fas fa-plus-circle"></i>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {}
        {authorSearchTerm.length > 0 && filteredUsers.length === 0 && (
          <div className="no-authors-found">
            No authors found matching "{authorSearchTerm}"
          </div>
        )}
      </>
    );
  };

  const getAlertClass = (message) => {
    if (message.includes("Duplicate paper detected")) {
      return "alert-warning";
    } else if (
      message.includes("Error") ||
      message.includes("failed") ||
      message.includes("Invalid content")
    ) {
      return "alert-error";
    } else if (message.includes("successfully")) {
      return "alert-success";
    } else if (
      message.includes("Test files are not allowed") ||
      message.includes("Empty documents are not allowed") ||
      message.includes("Placeholder or draft documents are not allowed") ||
      message.includes("does not appear to be a research paper") ||
      message.includes("lacks proper research structure") ||
      message.includes("insufficient research content") ||
      message.includes("⚠️") ||
      message.includes("📄") ||
      message.includes("📁")
    ) {
      return "alert-error";
    }
    return "alert-info";
  };

  return (
    <div className="manage-papers-container">
      {/* debug output */}
      <div
        style={{
          padding: "8px",
          background: "#fee",
          color: "#900",
          fontWeight: "bold",
        }}
      ></div>
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
        <h1 className="page-title">My Submissions</h1>
      </div>

      {!userId ? (
        <div className="alert alert-warning">
          <p>Please log in to access your papers.</p>
          <button
            onClick={() => navigate("/signin")}
            className="upload-button"
            style={{ marginTop: "12px" }}
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <>
          {message && (
            <div className={`alert ${getAlertClass(message)}`}>{message}</div>
          )}

          {}
          <div className="papers-table-section">
            {" "}
            <div className="section-header">
              <h2 className="section-title">My Research Submissions</h2>
              <button onClick={openUploadModal} className="upload-button">
                <i className="fas fa-cloud-upload-alt"></i> Upload New Paper
              </button>
            </div>
            {loading ? (
              <div className="loading">Loading your papers...</div>
            ) : papers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No papers uploaded yet</div>
                <div className="empty-state-text">
                  Share your research with the academic community by uploading
                  your first paper
                </div>
              </div>
            ) : (
              <div className="papers-table-container">
                <table className="papers-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Journal / Year</th>
                      <th>Authors</th>
                      <th>File Details</th>
                      <th>Upload Date</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {papers.map((paper, index) => (
                      <tr
                        key={index}
                        className={paper.isCoAuthor ? "co-author-row" : ""}
                      >
                        <td>
                          <div className="paper-title">{paper.title}</div>
                          <div className="paper-tags">
                            {paper.tags && paper.tags.length > 0 ? (
                              paper.tags.map((tag, i) => (
                                <span key={i} className="tag">
                                  {tag}
                                </span>
                              ))
                            ) : paper.keywords && paper.keywords.length > 0 ? (
                              paper.keywords.map((keyword, i) => (
                                <span key={i} className="tag">
                                  {keyword}
                                </span>
                              ))
                            ) : (
                              <span className="no-tags">No keywords</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {paper.journal || "N/A"}
                          <br />
                          {paper.year || "N/A"}
                        </td>
                        <td>
                          {paper.authors && paper.authors.length > 0 ? (
                            <div>
                              {paper.authors.map((author, i) => (
                                <div key={i}>
                                  {typeof author === "object"
                                    ? author.name || "Unknown Author"
                                    : String(author) || "Unknown Author"}
                                </div>
                              ))}
                            </div>
                          ) : (
                            "No authors listed"
                          )}
                        </td>
                        <td>
                          <div>{paper.filename}</div>
                          <div className="file-size">
                            {formatFileSize(paper.size)}
                          </div>
                        </td>
                        <td>{formatDate(paper.uploadDate)}</td>
                        <td>
                          {paper.isOwner ? (
                            <span className="badge badge-primary">
                              Main Author
                            </span>
                          ) : paper.isCoAuthor ? (
                            <span className="badge badge-secondary">
                              Co-author
                            </span>
                          ) : (
                            <span className="badge badge-light">
                              Contributor
                            </span>
                          )}
                        </td>
                        <td className="actions-cell">
                          <button
                            onClick={() => handlePreview(paper)}
                            className="action-button preview-button"
                            title="Preview Paper"
                            style={{
                              background: "#800000",
                              color: "white",
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "none",
                              marginRight: "6px",
                            }}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          {}
                          {(paper.isOwner || paper.isCoAuthor) && (
                            <button
                              onClick={() => openEditModal(paper)}
                              className="action-button edit-button"
                              title={
                                paper.isOwner
                                  ? "Edit Paper"
                                  : "Edit as Co-author"
                              }
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                          )}
                          {paper.isOwner && (
                            <button
                              onClick={() => handleDelete(paper)}
                              className="action-button delete-button"
                              title="Delete Paper"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {}
          <Modal
            isOpen={!!previewPaper}
            onRequestClose={closePreview}
            contentLabel="Preview Research Paper"
            style={{
              overlay: { zIndex: 1000, background: "rgba(0,0,0,0.5)" },
              content: {
                maxWidth: "900px",
                margin: "auto",
                height: "90vh",
                padding: "0",
                borderRadius: "12px",
                overflow: "hidden",
              },
            }}
            ariaHideApp={false}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  background: "#800000",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: "bold", fontSize: "18px" }}>
                  Preview: {previewPaper?.title}
                </span>
                <button
                  onClick={closePreview}
                  style={{
                    background: "none",
                    border: "none",
                    color: "white",
                    fontSize: "22px",
                    cursor: "pointer",
                  }}
                >
                  &times;
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "#222",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {previewLoading ? (
                  <span style={{ color: "white" }}>Loading preview...</span>
                ) : previewError ? (
                  <span style={{ color: "red" }}>{previewError}</span>
                ) : previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="Research Paper Preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      background: "white",
                    }}
                  />
                ) : null}
              </div>
            </div>
          </Modal>

          {}
          {showUploadModal && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>Upload New Research Paper</h2>
                  <button className="close-button" onClick={closeUploadModal}>
                    ×
                  </button>
                </div>

                <form onSubmit={handleUpload} className="upload-form">
                  {}
                  <div className="form-group">
                    <label className="form-label">
                      Title <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="form-input"
                      placeholder="Enter paper title"
                      required
                    />
                  </div>

                  {}
                  <div className="form-group">
                    <label className="form-label">
                      Abstract <span className="required">*</span>
                    </label>
                    <textarea
                      value={abstract}
                      onChange={(e) => setAbstract(e.target.value)}
                      className="form-textarea"
                      placeholder="Enter paper abstract"
                      rows={4}
                      required
                    />
                  </div>

                  {}
                  <div className="dynamic-input-group">
                    <label className="form-label">
                      Keywords <span className="required">*</span>
                    </label>
                    <div className="input-with-button">
                      <input
                        type="text"
                        value={currentKeyword}
                        onChange={(e) => setCurrentKeyword(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addKeyword())
                        }
                        className="form-input"
                        placeholder="Keyword"
                      />
                      <button
                        type="button"
                        onClick={addKeyword}
                        className="add-button"
                      >
                        + Add Keyword
                      </button>
                    </div>
                    <div className="tag-list">
                      {keywordsList.map((keyword, index) => (
                        <div key={index} className="tag-item">
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(index)}
                            className="remove-tag"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {}
                  <div className="sdg-section">
                    <label className="form-label">
                      Sustainable Development Goals (SDGs){" "}
                      <span className="required">*</span>
                    </label>
                    <div
                      className="form-label"
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        fontWeight: "normal",
                      }}
                    >
                      Hold Ctrl (Windows) or Command (Mac) to select multiple
                      SDGs
                    </div>
                    <div className="sdg-grid">
                      {sdgOptions.map((sdg) => (
                        <div
                          key={sdg.id}
                          className={`sdg-item ${selectedSDGs.includes(sdg.id) ? "selected" : ""}`}
                          onClick={() => handleSDGChange(sdg.id)}
                          title={getSDGDescription(sdg.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSDGs.includes(sdg.id)}
                            onChange={() => {}}
                            className="sdg-checkbox"
                          />
                          <span className="sdg-text">
                            {sdg.id}: {sdg.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {}
                  <div className="dynamic-input-group">
                    <label className="form-label">
                      Authors <span className="required">*</span>
                    </label>
                    <div className="author-input-container">
                      {renderAuthorSearchUI()}
                    </div>
                    <div className="authors-table-container">
                      {authorsList.length > 0 && (
                        <table className="authors-table">
                          <thead>
                            <tr>
                              <th>Author Name</th>
                              <th>Email</th>
                              <th>Contact Number</th>
                              <th>Role</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {authorsList.map((author, index) => (
                              <tr key={index}>
                                <td>{author.name}</td>
                                <td>{author.email}</td>
                                <td>{author.phone}</td>
                                <td>
                                  {author.userId === userId
                                    ? "Main Author"
                                    : "Co-author"}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => removeAuthor(index)}
                                    className="remove-tag"
                                    disabled={author.userId === userId}
                                    title={
                                      author.userId === userId
                                        ? "Cannot remove yourself as author"
                                        : "Remove co-author"
                                    }
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {}
                  <div className="multi-input-section">
                    <div className="form-group">
                      <label className="form-label">Journal</label>
                      <div>
                        <div className="radio-group">
                          <p>
                            Is the paper already published?{" "}
                            <span className="required">*</span>
                          </p>
                          <label className="radio-label">
                            <input
                              type="radio"
                              name="isPublished"
                              value="yes"
                              checked={isPublished === true}
                              onChange={() => setIsPublished(true)}
                              required
                            />
                            Yes
                          </label>
                          <label className="radio-label">
                            <input
                              type="radio"
                              name="isPublished"
                              value="no"
                              checked={isPublished === false}
                              onChange={() => setIsPublished(false)}
                              required
                            />
                            No
                          </label>
                        </div>
                      </div>
                      {isPublished && (
                        <>
                          <input
                            type="text"
                            value={journal}
                            onChange={(e) => setJournal(e.target.value)}
                            className="form-input"
                            placeholder="e.g., IEEE Transactions on Neural Networks"
                            required={isPublished}
                          />

                          {}
                          <div
                            className="form-group"
                            style={{ marginTop: "15px" }}
                          >
                            <div className="radio-group">
                              <p>
                                Does the paper have a publisher?{" "}
                                <span className="required">*</span>
                              </p>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasPublisher"
                                  value="yes"
                                  checked={hasPublisher === true}
                                  onChange={() => setHasPublisher(true)}
                                  required
                                />
                                Yes
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasPublisher"
                                  value="no"
                                  checked={hasPublisher === false}
                                  onChange={() => setHasPublisher(false)}
                                  required
                                />
                                No
                              </label>
                            </div>

                            {hasPublisher && (
                              <div style={{ marginTop: "10px" }}>
                                <label className="form-label">Publisher</label>
                                <input
                                  type="text"
                                  value={publisher}
                                  onChange={(e) => setPublisher(e.target.value)}
                                  className="form-input"
                                  placeholder="e.g., IEEE, ACM, Springer"
                                  required={hasPublisher}
                                />
                              </div>
                            )}
                          </div>

                          {}
                          <div
                            className="form-group"
                            style={{ marginTop: "15px" }}
                          >
                            <div className="radio-group">
                              <p>
                                Does the paper have a DOI?{" "}
                                <span className="required">*</span>
                              </p>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasDoi"
                                  value="yes"
                                  checked={hasDoi === true}
                                  onChange={() => setHasDoi(true)}
                                  required
                                />
                                Yes
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasDoi"
                                  value="no"
                                  checked={hasDoi === false}
                                  onChange={() => setHasDoi(false)}
                                  required
                                />
                                No
                              </label>
                            </div>

                            {hasDoi && (
                              <div style={{ marginTop: "10px" }}>
                                <label className="form-label">DOI</label>
                                <input
                                  type="text"
                                  value={doi}
                                  onChange={(e) => setDoi(e.target.value)}
                                  className="form-input"
                                  placeholder="e.g., 10.1000/182 (leave blank to auto-generate)"
                                  required={hasDoi}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="multi-input-section">
                    <div className="form-group">
                      <label className="form-label">
                        Year <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="form-input"
                        placeholder="2025"
                        required
                      />
                    </div>

                    {!isPublished && (
                      <div className="form-group">
                        <label className="form-label">Publisher</label>
                        <input
                          type="text"
                          value={publisher}
                          onChange={(e) => setPublisher(e.target.value)}
                          className="form-input"
                          placeholder="e.g., IEEE, ACM, Springer"
                        />
                      </div>
                    )}
                  </div>

                  {}
                  {isPublished && (
                    <div className="form-group">
                      <div className="radio-group">
                        <p>
                          Is this paper from a conference proceeding?{" "}
                          <span className="required">*</span>
                        </p>
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="hasConference"
                            value="yes"
                            checked={hasConference === true}
                            onChange={() => {
                              setHasConference(true);
                              setConferenceProceeding(true);
                            }}
                            required
                          />
                          Yes
                        </label>
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="hasConference"
                            value="no"
                            checked={hasConference === false}
                            onChange={() => {
                              setHasConference(false);
                              setConferenceProceeding(false);
                            }}
                            required
                          />
                          No
                        </label>
                      </div>
                    </div>
                  )}

                  {}
                  <div className="form-group">
                    <label className="form-label">References</label>
                    <textarea
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      className="form-textarea"
                      placeholder="Enter paper references"
                      rows={4}
                    />
                  </div>

                  {}
                  <div className="file-upload-section">
                    <label className="form-label">
                      Paper File (PDF only) <span className="required">*</span>
                    </label>
                    <div
                      className={`file-drop-zone ${dragOver ? "drag-over" : ""}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() =>
                        document.getElementById("fileInput").click()
                      }
                    >
                      <div className="upload-icon">
                        <i className="fas fa-cloud-upload-alt"></i>
                      </div>
                      <div className="upload-text">
                        Upload your research paper
                      </div>
                      <div className="upload-subtext">
                        or drag and drop your file here
                      </div>
                      <div className="file-types">
                        PDF files only, up to 15MB
                      </div>
                    </div>
                    <input
                      id="fileInput"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileInputChange}
                      className="hidden-file-input"
                    />

                    {selectedFile && (
                      <div className="selected-file">
                        <div className="file-icon">
                          <i className="fas fa-file-alt"></i>
                        </div>
                        <div className="file-info">
                          <div className="file-name">{selectedFile.name}</div>
                          <div className="file-size">
                            {formatFileSize(selectedFile.size)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeSelectedFile}
                          className="remove-file"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {}
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={closeUploadModal}
                      className="cancel-button"
                    >
                      Cancel
                    </button>{" "}
                    <button
                      type="submit"
                      disabled={
                        uploading ||
                        !selectedFile ||
                        !title ||
                        !abstract ||
                        (isPublished && !journal) ||
                        (isPublished && hasPublisher && !publisher) ||
                        (isPublished && hasDoi && !doi) ||
                        authorsList.length === 0 ||
                        keywordsList.length === 0 ||
                        selectedSDGs.length === 0
                      }
                      className="upload-button"
                    >
                      {uploading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>{" "}
                          Uploading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-cloud-upload-alt"></i> Upload
                          Paper
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {}
          {showEditModal && selectedPaper && (
            <div className="modal-overlay">
              <div className="modal-container">
                <div className="modal-header">
                  <h2>
                    {selectedPaper.isOwner
                      ? "Edit Research Paper"
                      : "Edit Research Paper as Co-author"}
                    {selectedPaper.isCoAuthor && (
                      <span
                        className="badge badge-secondary"
                        style={{ marginLeft: "10px", fontSize: "0.7em" }}
                      >
                        Co-author Mode
                      </span>
                    )}
                  </h2>
                  <button className="close-button" onClick={closeEditModal}>
                    ×
                  </button>
                </div>

                <form onSubmit={handleUpdate} className="upload-form">
                  {}
                  <div className="form-group">
                    <label className="form-label">
                      Title <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="form-input"
                      placeholder="Enter paper title"
                      required
                    />
                  </div>

                  {}
                  <div className="form-group">
                    <label className="form-label">
                      Abstract <span className="required">*</span>
                    </label>
                    <textarea
                      value={abstract}
                      onChange={(e) => setAbstract(e.target.value)}
                      className="form-textarea"
                      placeholder="Enter paper abstract"
                      rows={4}
                      required
                    />
                  </div>

                  {}
                  <div className="dynamic-input-group">
                    <label className="form-label">
                      Keywords <span className="required">*</span>
                    </label>
                    <div className="input-with-button">
                      <input
                        type="text"
                        value={currentKeyword}
                        onChange={(e) => setCurrentKeyword(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addKeyword())
                        }
                        className="form-input"
                        placeholder="Keyword"
                      />
                      <button
                        type="button"
                        onClick={addKeyword}
                        className="add-button"
                      >
                        + Add Keyword
                      </button>
                    </div>
                    <div className="tag-list">
                      {keywordsList.map((keyword, index) => (
                        <div key={index} className="tag-item">
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(index)}
                            className="remove-tag"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {}
                  <div className="sdg-section">
                    <label className="form-label">
                      Sustainable Development Goals (SDGs){" "}
                      <span className="required">*</span>
                    </label>
                    <div
                      className="form-label"
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        fontWeight: "normal",
                      }}
                    >
                      Hold Ctrl (Windows) or Command (Mac) to select multiple
                      SDGs
                    </div>
                    <div className="sdg-grid">
                      {sdgOptions.map((sdg) => (
                        <div
                          key={sdg.id}
                          className={`sdg-item ${selectedSDGs.includes(sdg.id) ? "selected" : ""}`}
                          onClick={() => handleSDGChange(sdg.id)}
                          title={getSDGDescription(sdg.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSDGs.includes(sdg.id)}
                            onChange={() => {}}
                            className="sdg-checkbox"
                          />
                          <span className="sdg-text">
                            {sdg.id}: {sdg.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {}
                  <div className="dynamic-input-group">
                    <label className="form-label">
                      Authors <span className="required">*</span>
                    </label>
                    <div className="author-input-container">
                      {renderAuthorSearchUI()}
                    </div>
                    <div className="authors-table-container">
                      {authorsList.length > 0 && (
                        <table className="authors-table">
                          <thead>
                            <tr>
                              <th>Author Name</th>
                              <th>Email</th>
                              <th>Contact Number</th>
                              <th>Role</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {authorsList.map((author, index) => (
                              <tr key={index}>
                                <td>{author.name}</td>
                                <td>{author.email}</td>
                                <td>{author.phone}</td>
                                <td>
                                  {author.userId === userId
                                    ? "Main Author"
                                    : "Co-author"}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => removeAuthor(index)}
                                    className="remove-tag"
                                    disabled={author.userId === userId}
                                    title={
                                      author.userId === userId
                                        ? "Cannot remove yourself as author"
                                        : "Remove co-author"
                                    }
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {}
                  <div className="multi-input-section">
                    <div className="form-group">
                      <label className="form-label">Journal</label>
                      <div>
                        <div className="radio-group">
                          <p>
                            Is the paper already published?{" "}
                            <span className="required">*</span>
                          </p>
                          <label className="radio-label">
                            <input
                              type="radio"
                              name="isPublished"
                              value="yes"
                              checked={isPublished === true}
                              onChange={() => setIsPublished(true)}
                              required
                            />
                            Yes
                          </label>
                          <label className="radio-label">
                            <input
                              type="radio"
                              name="isPublished"
                              value="no"
                              checked={isPublished === false}
                              onChange={() => setIsPublished(false)}
                              required
                            />
                            No
                          </label>
                        </div>
                      </div>
                      {isPublished && (
                        <>
                          <input
                            type="text"
                            value={journal}
                            onChange={(e) => setJournal(e.target.value)}
                            className="form-input"
                            placeholder="e.g., IEEE Transactions on Neural Networks"
                            required={isPublished}
                          />

                          {}
                          <div
                            className="form-group"
                            style={{ marginTop: "15px" }}
                          >
                            <div className="radio-group">
                              <p>
                                Does the paper have a publisher?{" "}
                                <span className="required">*</span>
                              </p>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasPublisher"
                                  value="yes"
                                  checked={hasPublisher === true}
                                  onChange={() => setHasPublisher(true)}
                                  required
                                />
                                Yes
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasPublisher"
                                  value="no"
                                  checked={hasPublisher === false}
                                  onChange={() => setHasPublisher(false)}
                                  required
                                />
                                No
                              </label>
                            </div>

                            {hasPublisher && (
                              <div style={{ marginTop: "10px" }}>
                                <label className="form-label">Publisher</label>
                                <input
                                  type="text"
                                  value={publisher}
                                  onChange={(e) => setPublisher(e.target.value)}
                                  className="form-input"
                                  placeholder="e.g., IEEE, ACM, Springer"
                                  required={hasPublisher}
                                />
                              </div>
                            )}
                          </div>

                          {}
                          <div
                            className="form-group"
                            style={{ marginTop: "15px" }}
                          >
                            <div className="radio-group">
                              <p>
                                Does the paper have a DOI?{" "}
                                <span className="required">*</span>
                              </p>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasDoi"
                                  value="yes"
                                  checked={hasDoi === true}
                                  onChange={() => setHasDoi(true)}
                                  required
                                />
                                Yes
                              </label>
                              <label className="radio-label">
                                <input
                                  type="radio"
                                  name="hasDoi"
                                  value="no"
                                  checked={hasDoi === false}
                                  onChange={() => setHasDoi(false)}
                                  required
                                />
                                No
                              </label>
                            </div>

                            {hasDoi && (
                              <div style={{ marginTop: "10px" }}>
                                <label className="form-label">DOI</label>
                                <input
                                  type="text"
                                  value={doi}
                                  onChange={(e) => setDoi(e.target.value)}
                                  className="form-input"
                                  placeholder="e.g., 10.1000/182 (leave blank to auto-generate)"
                                  required={hasDoi}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="multi-input-section">
                    <div className="form-group">
                      <label className="form-label">
                        Year <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="form-input"
                        placeholder="2025"
                        required
                      />
                    </div>

                    {!isPublished && (
                      <div className="form-group">
                        <label className="form-label">Publisher</label>
                        <input
                          type="text"
                          value={publisher}
                          onChange={(e) => setPublisher(e.target.value)}
                          className="form-input"
                          placeholder="e.g., IEEE, ACM, Springer"
                        />
                      </div>
                    )}
                  </div>

                  {}
                  {isPublished && (
                    <div className="form-group">
                      <div className="radio-group">
                        <p>
                          Is this paper from a conference proceeding?{" "}
                          <span className="required">*</span>
                        </p>
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="hasConference"
                            value="yes"
                            checked={hasConference === true}
                            onChange={() => {
                              setHasConference(true);
                              setConferenceProceeding(true);
                            }}
                            required
                          />
                          Yes
                        </label>
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="hasConference"
                            value="no"
                            checked={hasConference === false}
                            onChange={() => {
                              setHasConference(false);
                              setConferenceProceeding(false);
                            }}
                            required
                          />
                          No
                        </label>
                      </div>
                    </div>
                  )}

                  {}
                  <div className="form-group">
                    <label className="form-label">References</label>
                    <textarea
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      className="form-textarea"
                      placeholder="Enter paper references"
                      rows={4}
                    />
                  </div>

                  {}
                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        uploading ||
                        !title ||
                        !abstract ||
                        (isPublished && !journal) ||
                        authorsList.length === 0 ||
                        keywordsList.length === 0 ||
                        selectedSDGs.length === 0
                      }
                      className="upload-button"
                    >
                      {uploading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> Saving...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save"></i> Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManagePapers;
