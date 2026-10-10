import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchProjects,
  uploadProjectFile,
  deleteProjectById
} from "../api";
import ManualEntryModal from "../components/ManualEntryModal";
import AreaToPlanModal from "../components/area-to-plan/AreaToPlanModal";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";

const AI_PROMPT_TEXT = `Act as an expert Architectural & MEP Draftsman. I need a Python script using \`openpyxl\` to generate a 2D floorplan Excel file for a [INSERT YOUR REQUIREMENT HERE]. 
The Excel file MUST have exactly 3 sheets with these strict headers:
Sheet 1: 'Room Coordinates Payload'. Row 1: ['Parametric 2D CAD Building Floorplan Coordinates', None, None, None, None]. Row 2: ['Room Name', 'Fillet Radius (mm)', 'Point Index', 'X Coordinate (mm)', 'Y Coordinate (mm)']. (Define rectangular room corners in mm. Fillet radius 0).
Sheet 2: 'Doors and Windows'. Row 1: ['Architectural Openings Schedule (Doors & Windows)', None, None, None, None, None, None, None]. Row 2: ['Opening ID', 'Type (Door/Window)', 'Host Wall Room', 'Wall Side (Bottom/Top/Left/Right)', 'Offset from Corner (mm)', 'Width (mm)', 'Height (mm)', 'Swing Direction'].
Sheet 3: 'HVAC Equipment'. Row 1: ['MEP HVAC Equipment & Sizing Schedule', None, None, None, None, None, None]. Row 2: ['Unit ID', 'Room Name', 'Unit Type (Split-IDU/ODU/Cassette)', 'Cooling Capacity (TR)', 'Location X (mm)', 'Location Y (mm)', 'Status'].`;

export default function HomePage() {
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEXT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  const handleOpenNameModal = () => {
    setNewProjectName("");
    setShowNameModal(true);
  };

  const handleNameModalSubmit = (e) => {
    if (e) e.preventDefault();
    if (!newProjectName.trim()) return;
    setShowNameModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const loadProjectList = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjects();
      setProjects(data || []);
    } catch (err) {
      setError(`Failed to load projects: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectList();
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const chosenName = newProjectName.trim() || undefined;
    try {
      setUploading(true);
      setError(null);
      const solved = await uploadProjectFile(file, chosenName);
      if (solved && solved.project_id) {
        navigate(`/projects/${encodeURIComponent(solved.project_id)}/cad`);
      } else {
        await loadProjectList();
        setSuccessMsg(`Plan "${chosenName || file.name}" uploaded successfully!`);
      }
    } catch (err) {
      setError(`Upload Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenCanvas = (project, e) => {
    if (e) {
      e.stopPropagation();
    }
    const pid = project?.id || project?.project_id;
    if (!pid) {
      console.error("Cannot open project: missing project ID", project);
      setError("Cannot open project: missing project ID");
      return;
    }

    setOpeningId(pid);
    navigate(`/projects/${encodeURIComponent(pid)}/cad`);
  };

  const handleDeleteProject = async (e, projectId, projectName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${projectName}"?`)) {
      return;
    }

    try {
      setDeletingId(projectId);
      await deleteProjectById(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setSuccessMsg(`Project "${projectName}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(`Delete Failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "N/A";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoStr;
    }
  };

  const filteredProjects = projects.filter(p => 
    (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-container" style={{ ...styles.container, backgroundColor: 'var(--bg-workspace)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalNavbar />

      <main style={{ ...styles.main, maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem 3rem 1.5rem', flex: 1, width: '100%' }}>
        {/* Hidden Excel File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* Dashboard Action Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div>
            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem 0', letterSpacing: '-0.02em' }}>
              Projects Dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
              Manage saved CAD floorplans, upload spreadsheets, or create architectural layouts.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/drafting')}
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
            >
              <span>✏️</span>
              <span>AutoCAD Direct Drafter</span>
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              style={{
                backgroundColor: 'var(--bg-panel)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                padding: '9px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-panel)'}
            >
              <span>📐</span>
              <span>Create from Scratch</span>
            </button>

            <button
              onClick={() => setShowAreaModal(true)}
              style={{
                backgroundColor: 'var(--bg-panel)',
                color: 'var(--accent-blue)',
                border: '1px solid var(--accent-blue)',
                padding: '9px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(47, 128, 237, 0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-panel)'}
            >
              <span>📐</span>
              <span>Generate via Area</span>
            </button>

            <button
              onClick={() => setShowAiModal(true)}
              style={{
                backgroundColor: 'var(--bg-panel)',
                color: 'var(--accent-blue)',
                border: '1px solid var(--border-subtle)',
                padding: '9px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-panel)'}
            >
              <span>🤖</span>
              <span>AI Prompt Copilot</span>
            </button>

            <button
              onClick={handleOpenNameModal}
              disabled={uploading}
              style={{
                backgroundColor: 'var(--accent-blue)',
                color: '#FFFFFF',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: uploading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(47, 128, 237, 0.35)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-blue)'}
            >
              <span>➕</span>
              <span>{uploading ? 'Processing...' : 'Upload Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem'
        }}>
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved projects by name..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '0.88rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Showing {filteredProjects.length} of {projects.length} plans
            </span>
            <button onClick={loadProjectList} style={styles.btnRefresh}>
              🔄 Refresh List
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p>Loading saved projects from SQLite database...</p>
          </div>
        ) : (
          <div>
            <div style={styles.grid}>
              {/* Create New Project Card - Prominent First Action */}
              <div
                style={{
                  ...styles.createCard,
                  ...(uploading ? styles.createCardUploading : {})
                }}
                onClick={uploading ? undefined : handleOpenNameModal}
                className="create-project-card"
                role="button"
                tabIndex={0}
                title="Create a new CAD project and choose floorplan spreadsheet"
                onKeyDown={(e) => {
                  if (!uploading && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    handleOpenNameModal();
                  }
                }}
              >
                <div style={styles.createCardContent}>
                  <div style={styles.createIconWrapper} className="create-icon-wrapper">
                    {uploading ? (
                      <div style={styles.miniSpinner}></div>
                    ) : (
                      <span style={styles.createIcon}>➕</span>
                    )}
                  </div>
                  <h3 style={styles.createTitle}>
                    {uploading ? "Uploading & Solving..." : "Create New Project"}
                  </h3>
                  <p style={styles.createSubtitle}>
                    {uploading
                      ? "Solving CAD geometry & routing..."
                      : "Name your project and upload floorplan spreadsheet"}
                  </p>
                  <div style={styles.createActions}>
                    <div style={styles.createBadge}>
                      {uploading ? "⏳ Processing..." : "➕ Create Project"}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAiModal(true);
                      }}
                      style={styles.btnAiPrompt}
                      title="Open AI prompt instructions for ChatGPT/Claude"
                    >
                      🤖 Generate via AI
                    </button>
                  </div>
                </div>
              </div>

              {/* Manual Entry Card - Create from Scratch */}
              <div
                style={{
                  ...styles.createCard,
                  borderColor: "rgba(16, 185, 129, 0.6)",
                  background: "linear-gradient(145deg, #1E293B 0%, #064E3B 100%)"
                }}
                onClick={() => setShowManualModal(true)}
                className="create-project-card manual-entry-card"
                role="button"
                tabIndex={0}
                title="Create a new CAD project directly from scratch via web form"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowManualModal(true);
                  }
                }}
              >
                <div style={styles.createCardContent}>
                  <div
                    style={{
                      ...styles.createIconWrapper,
                      backgroundColor: "rgba(16, 185, 129, 0.2)",
                      borderColor: "#10B981"
                    }}
                    className="create-icon-wrapper"
                  >
                    <span style={{ fontSize: "1.75rem" }}>📝</span>
                  </div>
                  <h3 style={{ ...styles.createTitle, color: "#6EE7B7" }}>
                    Create from Scratch
                  </h3>
                  <p style={styles.createSubtitle}>
                    Manual entry form: add custom rooms, doors, windows & AC units directly
                  </p>
                  <div style={styles.createActions}>
                    <div
                      style={{
                        ...styles.createBadge,
                        backgroundColor: "#065F46",
                        color: "#A7F3D0"
                      }}
                    >
                      ✏️ Manual Form
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Square-Footage to Parametric CAD Card */}
              <div
                style={{
                  ...styles.createCard,
                  borderColor: "rgba(47, 128, 237, 0.6)",
                  background: "linear-gradient(145deg, #1E293B 0%, #0F284E 100%)"
                }}
                onClick={() => setShowAreaModal(true)}
                className="create-project-card area-generator-card"
                role="button"
                tabIndex={0}
                title="Generate a parametric CAD floorplan from target area and room requirements"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowAreaModal(true);
                  }
                }}
              >
                <div style={styles.createCardContent}>
                  <div
                    style={{
                      ...styles.createIconWrapper,
                      backgroundColor: "rgba(47, 128, 237, 0.2)",
                      borderColor: "#2F80ED"
                    }}
                    className="create-icon-wrapper"
                  >
                    <span style={{ fontSize: "1.75rem" }}>📐</span>
                  </div>
                  <h3 style={{ ...styles.createTitle, color: "#60A5FA" }}>
                    AI Area Generator
                  </h3>
                  <p style={styles.createSubtitle}>
                    Target area to CAD: configure square-footage, room program & auto-pack floorplan
                  </p>
                  <div style={styles.createActions}>
                    <div
                      style={{
                        ...styles.createBadge,
                        backgroundColor: "#1E3A8A",
                        color: "#93C5FD"
                      }}
                    >
                      📐 Parametric Solver
                    </div>
                  </div>
                </div>
              </div>

              {/* Saved Projects */}
              {filteredProjects.map((project) => {
                const isOpening = openingId === project.id;
                const isDeleting = deletingId === project.id;

                return (
                  <div
                    key={project.id}
                    style={styles.card}
                    onClick={() => handleOpenCanvas(project)}
                    className="project-card"
                  >
                    <div>
                      <div style={styles.cardHeader}>
                        <span style={styles.cardIcon}>🏗️</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={styles.cardBadge}>ID: {project.id.slice(0, 8)}...</div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                            disabled={isDeleting}
                            style={styles.btnDelete}
                            title="Delete project from SQLite database"
                          >
                            {isDeleting ? "..." : "🗑️"}
                          </button>
                        </div>
                      </div>
                      <h3 style={styles.cardTitle}>{project.name}</h3>
                      <div style={styles.cardMeta}>
                        <span>🕒 Created: {formatDate(project.created_at)}</span>
                      </div>
                    </div>

                    <div style={{ ...styles.cardFooter, display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          backgroundColor: 'rgba(220, 38, 38, 0.1)',
                          border: '1px solid #DC2626',
                          color: '#EF4444',
                          borderRadius: '6px',
                          padding: '7px 8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${encodeURIComponent(project.id)}/drafting`);
                        }}
                        title="Open directly in AutoCAD Drafting Studio"
                      >
                        <span>✏️</span>
                        <span>AutoCAD</span>
                      </button>

                      <button
                        type="button"
                        style={{ ...styles.btnOpen, flex: 1.5 }}
                        disabled={isOpening}
                        onClick={(e) => handleOpenCanvas(project, e)}
                        title="Open Parametric CAD Studio"
                      >
                        {isOpening ? "Loading..." : "CAD Studio →"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {projects.length === 0 && (
              <div style={styles.emptyNote}>
                💡 No existing saved projects yet. Click <strong>"Create New Project"</strong> above to upload your first floorplan, or download a 1-BHK / 2-BHK template from the top bar to get started!
              </div>
            )}
          </div>
        )}
      </main>

      {/* 🤖 Generate via AI Modal */}
      {showAiModal && (
        <div 
          style={styles.modalBackdrop}
          onClick={() => setShowAiModal(false)}
        >
          <div 
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.8rem" }}>🤖</span>
                <div>
                  <h3 style={styles.modalTitle}>How to Create Plans with AI</h3>
                  <p style={styles.modalSubtitle}>Use ChatGPT, Claude, or Gemini to generate CAD-compatible Excel spreadsheets</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAiModal(false)}
                style={styles.modalCloseBtn}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.stepsBox}>
                <div style={styles.stepItem}>
                  <span style={styles.stepNumber}>1</span>
                  <span><strong>Copy the prompt below.</strong></span>
                </div>
                <div style={styles.stepItem}>
                  <span style={styles.stepNumber}>2</span>
                  <span><strong>Paste it into ChatGPT or Claude</strong> (customize <code>[INSERT YOUR REQUIREMENT HERE]</code> with your desired rooms).</span>
                </div>
                <div style={styles.stepItem}>
                  <span style={styles.stepNumber}>3</span>
                  <span><strong>Run the generated Python code</strong> to create your perfectly formatted Excel floorplan file, then upload it here!</span>
                </div>
              </div>

              <div>
                <label style={styles.promptLabel}>Prompt Template for LLMs:</label>
                <textarea
                  readOnly
                  value={AI_PROMPT_TEXT}
                  style={styles.promptTextarea}
                  rows={9}
                  onClick={(e) => e.target.select()}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  style={{
                    ...styles.btn,
                    ...(copiedPrompt ? styles.btnSuccess : styles.btnPrimary),
                    padding: "0.65rem 1.3rem",
                    fontSize: "0.9rem"
                  }}
                >
                  {copiedPrompt ? "✅ Copied to Clipboard!" : "📋 Copy Prompt"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  style={{
                    ...styles.btn,
                    ...styles.btnSecondary,
                    padding: "0.65rem 1.3rem",
                    fontSize: "0.9rem"
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Naming Modal */}
      {showNameModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowNameModal(false)}>
          <div
            style={styles.nameModalContent}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.8rem" }}>📐</span>
                <div>
                  <h3 style={styles.modalTitle}>Create New Project</h3>
                  <p style={styles.modalSubtitle}>
                    Enter a project name before choosing your Excel floorplan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNameModal(false)}
                style={styles.modalCloseBtn}
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleNameModalSubmit} style={styles.modalBody}>
              <div>
                <label style={styles.promptLabel} htmlFor="projectNameInput">
                  Project Name:
                </label>
                <input
                  id="projectNameInput"
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Dream Villa Ground Floor, Modern 2BHK Flat"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={styles.nameInput}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowNameModal(false)}
                  style={{
                    ...styles.btn,
                    ...styles.btnSecondary,
                    padding: "0.65rem 1.2rem"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  style={{
                    ...styles.btn,
                    ...styles.btnPrimary,
                    padding: "0.65rem 1.3rem",
                    opacity: newProjectName.trim() ? 1 : 0.6,
                    cursor: newProjectName.trim() ? "pointer" : "not-allowed"
                  }}
                >
                  Next: Choose Excel File →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Entry Form Modal */}
      <ManualEntryModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onProjectCreated={(projectId) => {
          setShowManualModal(false);
          navigate(`/projects/${encodeURIComponent(projectId)}/cad`);
        }}
      />

      {/* AI Square-Footage to Parametric Floorplan Modal */}
      <AreaToPlanModal
        isOpen={showAreaModal}
        onClose={() => setShowAreaModal(false)}
      />

      <GlobalFooter />
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#0B0F19",
    color: "#F8FAFC",
    overflowY: "auto",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  },
  header: {
    backgroundColor: "#1E293B",
    borderBottom: "1px solid #334155",
    padding: "1.25rem 2rem",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
    position: "sticky",
    top: 0,
    zIndex: 20
  },
  headerContent: {
    maxWidth: "1280px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1rem"
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
    gap: "1rem"
  },
  logoIcon: {
    fontSize: "2.2rem"
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#38BDF8"
  },
  subtitle: {
    margin: 0,
    fontSize: "0.875rem",
    color: "#94A3B8"
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap"
  },
  btn: {
    padding: "0.6rem 1.1rem",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "0.875rem",
    cursor: "pointer",
    border: "none",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    transition: "all 0.2s ease"
  },
  btnPrimary: {
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.3)"
  },
  btnSecondary: {
    backgroundColor: "#334155",
    color: "#E2E8F0"
  },
  btnAccent: {
    backgroundColor: "#059669",
    color: "#FFFFFF"
  },
  btnWarning: {
    backgroundColor: "#D97706",
    color: "#FFFFFF"
  },
  main: {
    maxWidth: "1280px",
    margin: "2rem auto",
    padding: "0 1.5rem 4rem 1.5rem",
    width: "100%"
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem"
  },
  sectionTitle: {
    fontSize: "1.35rem",
    fontWeight: 700,
    margin: 0,
    color: "#F1F5F9"
  },
  btnRefresh: {
    backgroundColor: "transparent",
    border: "1px solid #475569",
    color: "#94A3B8",
    padding: "0.5rem 0.9rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#FCA5A5",
    padding: "1rem 1.25rem",
    borderRadius: "8px",
    marginBottom: "1.5rem",
    border: "1px solid #EF4444",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  successBanner: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    color: "#86EFAC",
    padding: "1rem 1.25rem",
    borderRadius: "8px",
    marginBottom: "1.5rem",
    border: "1px solid #22C55E",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "currentColor",
    cursor: "pointer",
    fontSize: "1.1rem"
  },
  loadingState: {
    textAlign: "center",
    padding: "5rem 2rem",
    color: "#94A3B8"
  },
  spinner: {
    width: "44px",
    height: "44px",
    border: "4px solid #334155",
    borderTop: "4px solid #38BDF8",
    borderRadius: "50%",
    margin: "0 auto 1.25rem auto",
    animation: "spin 0.9s linear infinite"
  },
  emptyState: {
    textAlign: "center",
    backgroundColor: "#1E293B",
    border: "2px dashed #334155",
    borderRadius: "12px",
    padding: "4rem 2rem",
    color: "#94A3B8"
  },
  emptyIcon: {
    fontSize: "3.5rem",
    marginBottom: "1rem"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: "1.5rem"
  },
  createCard: {
    backgroundColor: "rgba(30, 41, 59, 0.45)",
    border: "2px dashed #0284C7",
    borderRadius: "12px",
    padding: "1.75rem 1.5rem",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "220px",
    textAlign: "center",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.15)"
  },
  createCardUploading: {
    opacity: 0.85,
    cursor: "wait",
    borderColor: "#F59E0B"
  },
  createCardContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    width: "100%"
  },
  createIconWrapper: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "0.25rem",
    transition: "transform 0.2s ease, background-color 0.2s ease"
  },
  createIcon: {
    fontSize: "1.8rem",
    color: "#38BDF8",
    lineHeight: 1
  },
  createTitle: {
    fontSize: "1.2rem",
    fontWeight: 700,
    margin: 0,
    color: "#F8FAFC",
    letterSpacing: "-0.01em"
  },
  createSubtitle: {
    fontSize: "0.85rem",
    color: "#94A3B8",
    margin: 0,
    maxWidth: "250px",
    lineHeight: 1.4
  },
  createBadge: {
    fontSize: "0.8rem",
    fontWeight: 600,
    backgroundColor: "rgba(2, 132, 199, 0.2)",
    color: "#38BDF8",
    padding: "0.35rem 0.75rem",
    borderRadius: "20px",
    border: "1px solid rgba(56, 189, 248, 0.35)",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem"
  },
  createActions: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "0.4rem"
  },
  btnAiPrompt: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    border: "1px solid rgba(139, 92, 246, 0.45)",
    color: "#DDD6FE",
    padding: "0.35rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    transition: "all 0.15s ease"
  },
  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    backdropFilter: "blur(4px)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem"
  },
  modalContent: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "16px",
    maxWidth: "680px",
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
    padding: "2rem",
    color: "#F8FAFC"
  },
  nameModalContent: {
    backgroundColor: "#1E293B",
    border: "1px solid #38BDF8",
    borderRadius: "16px",
    maxWidth: "500px",
    width: "100%",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
    padding: "2rem",
    color: "#F8FAFC"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.25rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #334155"
  },
  modalTitle: {
    margin: 0,
    fontSize: "1.35rem",
    fontWeight: 700,
    color: "#38BDF8"
  },
  modalSubtitle: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.85rem",
    color: "#94A3B8"
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    fontSize: "1.4rem",
    cursor: "pointer",
    padding: "0.25rem 0.5rem",
    lineHeight: 1,
    borderRadius: "6px"
  },
  modalBody: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem"
  },
  stepsBox: {
    backgroundColor: "#0F172A",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "1rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem"
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    fontSize: "0.875rem",
    color: "#CBD5E1",
    lineHeight: 1.45
  },
  stepNumber: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
    fontWeight: 700,
    flexShrink: 0,
    marginTop: "1px"
  },
  promptLabel: {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#94A3B8",
    marginBottom: "0.5rem"
  },
  promptTextarea: {
    width: "100%",
    backgroundColor: "#0B0F19",
    border: "1px solid #38BDF8",
    borderRadius: "8px",
    padding: "0.85rem 1rem",
    color: "#38BDF8",
    fontFamily: "'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace",
    fontSize: "0.8rem",
    lineHeight: 1.5,
    resize: "none",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
    outline: "none"
  },
  nameInput: {
    width: "100%",
    backgroundColor: "#0B0F19",
    border: "1px solid #475569",
    borderRadius: "8px",
    padding: "0.85rem 1rem",
    color: "#FFFFFF",
    fontSize: "1rem",
    outline: "none",
    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
    boxSizing: "border-box"
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "0.5rem",
    paddingTop: "1rem",
    borderTop: "1px solid #334155"
  },
  btnSuccess: {
    backgroundColor: "#16A34A",
    color: "#FFFFFF"
  },
  miniSpinner: {
    width: "24px",
    height: "24px",
    border: "3px solid #334155",
    borderTop: "3px solid #38BDF8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite"
  },
  emptyNote: {
    marginTop: "1.75rem",
    padding: "1rem 1.25rem",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#94A3B8",
    fontSize: "0.9rem",
    textAlign: "center"
  },
  card: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "1.4rem",
    cursor: "pointer",
    transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "220px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.85rem"
  },
  cardIcon: {
    fontSize: "1.75rem"
  },
  cardBadge: {
    fontSize: "0.75rem",
    backgroundColor: "#0F172A",
    color: "#38BDF8",
    padding: "0.25rem 0.6rem",
    borderRadius: "8px",
    border: "1px solid #334155"
  },
  btnDelete: {
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#FCA5A5",
    borderRadius: "6px",
    padding: "0.25rem 0.5rem",
    cursor: "pointer",
    fontSize: "0.8rem",
    transition: "all 0.15s ease"
  },
  cardTitle: {
    fontSize: "1.15rem",
    fontWeight: 600,
    margin: "0 0 0.5rem 0",
    color: "#F8FAFC",
    lineHeight: 1.3
  },
  cardMeta: {
    fontSize: "0.825rem",
    color: "#94A3B8",
    marginBottom: "1.25rem"
  },
  cardFooter: {
    display: "flex",
    justifyContent: "flex-end"
  },
  btnOpen: {
    backgroundColor: "#0284C7",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    padding: "0.55rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  }
};
