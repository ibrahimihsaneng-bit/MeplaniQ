import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchProjects,
  uploadProjectFile,
  deleteProjectById,
  renameProject,
  duplicateProject,
  batchDeleteProjects,
  downloadProjectDxf,
  downloadProjectJson,
  downloadProjectBoqPdf,
  getExcelTemplateUrl,
  get2BhkExcelTemplateUrl,
  getCustomPlanTemplateUrl,
} from "../api";
import ManualEntryModal from "../components/ManualEntryModal";
import AreaToPlanModal from "../components/area-to-plan/AreaToPlanModal";
import GlobalNavbar from "../components/GlobalNavbar";
import GlobalFooter from "../components/GlobalFooter";
import ProjectThumbnail from "../components/ProjectThumbnail";

const AI_PROMPT_TEXT = `Act as an expert Architectural & MEP Draftsman. I need a Python script using \`openpyxl\` to generate a 2D floorplan Excel file for a [INSERT YOUR REQUIREMENT HERE]. 
The Excel file MUST have exactly 3 sheets with these strict headers:
Sheet 1: 'Room Coordinates Payload'. Row 1: ['Parametric 2D CAD Building Floorplan Coordinates', None, None, None, None]. Row 2: ['Room Name', 'Fillet Radius (mm)', 'Point Index', 'X Coordinate (mm)', 'Y Coordinate (mm)']. (Define rectangular room corners in mm. Fillet radius 0).
Sheet 2: 'Doors and Windows'. Row 1: ['Architectural Openings Schedule (Doors & Windows)', None, None, None, None, None, None, None]. Row 2: ['Opening ID', 'Type (Door/Window)', 'Host Wall Room', 'Wall Side (Bottom/Top/Left/Right)', 'Offset from Corner (mm)', 'Width (mm)', 'Height (mm)', 'Swing Direction'].
Sheet 3: 'HVAC Equipment'. Row 1: ['MEP HVAC Equipment & Sizing Schedule', None, None, None, None, None, None]. Row 2: ['Unit ID', 'Room Name', 'Unit Type (Split-IDU/ODU/Cassette)', 'Cooling Capacity (TR)', 'Location X (mm)', 'Location Y (mm)', 'Status'].`;

export default function HomePage() {
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Selection & Batch Mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [showAiModal, setShowAiModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);

  // Rename modal
  const [renameTarget, setRenameTarget] = useState(null); // { id, name }
  const [renameInput, setRenameInput] = useState("");

  // Duplicate modal
  const [duplicateTarget, setDuplicateTarget] = useState(null); // { id, name }
  const [duplicateInput, setDuplicateInput] = useState("");

  // Export modal
  const [exportTarget, setExportTarget] = useState(null); // project obj
  const [exportingType, setExportingType] = useState(null);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Load project summaries
  const loadProjectList = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(`Failed to load projects: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectList();
  }, []);

  // Notifications helper
  const notifySuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Upload handler
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
        notifySuccess(`Plan "${chosenName || file.name}" uploaded successfully!`);
      }
    } catch (err) {
      setError(`Upload Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Launch CAD Canvas
  const handleOpenCanvas = (project, e) => {
    if (e) e.stopPropagation();
    const pid = project?.id || project?.project_id;
    if (!pid) {
      setError("Cannot open project: missing project ID");
      return;
    }
    setOpeningId(pid);
    navigate(`/projects/${encodeURIComponent(pid)}/cad`);
  };

  // Single Delete
  const handleDeleteProject = async (e, projectId, projectName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(projectId);
      await deleteProjectById(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setSelectedIds((prev) => prev.filter((id) => id !== projectId));
      notifySuccess(`Project "${projectName}" deleted successfully.`);
    } catch (err) {
      setError(`Delete Failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Rename Flow
  const handleOpenRename = (e, project) => {
    e.stopPropagation();
    setRenameTarget(project);
    setRenameInput(project.name || "");
  };

  const handleExecuteRename = async (e) => {
    if (e) e.preventDefault();
    if (!renameTarget || !renameInput.trim()) return;
    try {
      setActionInProgress(true);
      await renameProject(renameTarget.id, renameInput.trim());
      setProjects((prev) =>
        prev.map((p) => (p.id === renameTarget.id ? { ...p, name: renameInput.trim() } : p))
      );
      notifySuccess(`Plan renamed to "${renameInput.trim()}".`);
      setRenameTarget(null);
    } catch (err) {
      setError(`Rename failed: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Duplicate Flow
  const handleOpenDuplicate = (e, project) => {
    e.stopPropagation();
    setDuplicateTarget(project);
    setDuplicateInput(`${project.name || "Floorplan"} (Copy)`);
  };

  const handleExecuteDuplicate = async (e) => {
    if (e) e.preventDefault();
    if (!duplicateTarget) return;
    try {
      setActionInProgress(true);
      const res = await duplicateProject(duplicateTarget.id, duplicateInput.trim() || undefined);
      await loadProjectList();
      notifySuccess(`Duplicated as "${duplicateInput.trim() || res.name}".`);
      setDuplicateTarget(null);
    } catch (err) {
      setError(`Duplicate failed: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Batch Selection & Batch Delete
  const toggleSelectProject = (e, id) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProjects.map((p) => p.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} selected project(s)? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      setActionInProgress(true);
      await batchDeleteProjects(selectedIds);
      setProjects((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      notifySuccess(`Successfully deleted ${selectedIds.length} project(s).`);
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (err) {
      setError(`Batch delete failed: ${err.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Single Direct Exports
  const handleDirectDxfExport = async (e, project) => {
    if (e) e.stopPropagation();
    try {
      setExportingType("dxf");
      await downloadProjectDxf(project.id, project.name);
      notifySuccess(`Exported "${project.name}" DXF successfully.`);
    } catch (err) {
      setError(`DXF Export failed: ${err.message}`);
    } finally {
      setExportingType(null);
    }
  };

  const handleDirectJsonExport = async (e, project) => {
    if (e) e.stopPropagation();
    try {
      setExportingType("json");
      await downloadProjectJson(project.id, project.name);
      notifySuccess(`Exported "${project.name}" JSON specification.`);
    } catch (err) {
      setError(`JSON Export failed: ${err.message}`);
    } finally {
      setExportingType(null);
    }
  };

  const handleDirectBoqPdfExport = async (e, project) => {
    if (e) e.stopPropagation();
    try {
      setExportingType("boq");
      await downloadProjectBoqPdf(project.id, "medium", project.name);
      notifySuccess(`Generated BOQ Cost Estimate PDF for "${project.name}".`);
    } catch (err) {
      setError(`BOQ PDF Export failed: ${err.message}`);
    } finally {
      setExportingType(null);
    }
  };

  // Copy AI Prompt
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEXT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  // Aggregate Telemetry Stats
  const stats = useMemo(() => {
    const totalPlans = projects.length;
    let totalRooms = 0;
    let totalAreaSqm = 0;
    let hvacCount = 0;
    let plumbCount = 0;
    let elecCount = 0;

    projects.forEach((p) => {
      totalRooms += Number(p.room_count || 0);
      totalAreaSqm += Number(p.total_area_sqm || 0);
      if (p.disciplines?.includes("HVAC")) hvacCount++;
      if (p.disciplines?.includes("Plumbing")) plumbCount++;
      if (p.disciplines?.includes("Electrical")) elecCount++;
    });

    return {
      totalPlans,
      totalRooms,
      totalAreaSqm: Math.round(totalAreaSqm * 10) / 10,
      hvacCount,
      plumbCount,
      elecCount,
    };
  }, [projects]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.id && p.id.toLowerCase().includes(q)) ||
          (p.disciplines && p.disciplines.some((d) => d.toLowerCase().includes(q)))
      );
    }

    // Discipline filter
    if (disciplineFilter !== "all") {
      result = result.filter(
        (p) => p.disciplines && p.disciplines.includes(disciplineFilter)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === "alpha") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "area") {
        return (b.total_area_sqm || 0) - (a.total_area_sqm || 0);
      }
      return 0;
    });

    return result;
  }, [projects, searchQuery, disciplineFilter, sortBy]);

  const formatDate = (isoStr) => {
    if (!isoStr) return "N/A";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={styles.page}>
      <GlobalNavbar activeSection="projects" />

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.xlsm"
        style={{ display: "none" }}
      />

      <main style={styles.main}>
        {/* EXECUTIVE DASHBOARD HEADER */}
        <section style={styles.headerSection}>
          <div style={styles.headerTextGroup}>
            <div style={styles.badgeLabel}>
              <span style={styles.badgePulse} />
              <span>MEPLAN-IQ ENGINEERING OS</span>
            </div>
            <h1 style={styles.pageTitle}>Commercial CAD Projects Dashboard</h1>
            <p style={styles.pageSubtitle}>
              Parametric 2D building floorplans, multi-discipline BIM coordination (HVAC, Plumbing, Electrical), and instant AutoCAD R2018 DXF export.
            </p>
          </div>

          {/* TELEMETRY STATS BAR */}
          <div style={styles.telemetryBar}>
            <div style={styles.statTile}>
              <span style={styles.statLabel}>Active Floorplans</span>
              <span style={styles.statValue}>{stats.totalPlans}</span>
              <span style={styles.statSub}>SQLite Managed</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statTile}>
              <span style={styles.statLabel}>Managed CAD Footprint</span>
              <span style={{ ...styles.statValue, color: "#38BDF8" }}>
                {stats.totalAreaSqm.toLocaleString()} <span style={{ fontSize: "0.85rem" }}>m²</span>
              </span>
              <span style={styles.statSub}>Architectural Area</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statTile}>
              <span style={styles.statLabel}>Total Rooms</span>
              <span style={styles.statValue}>{stats.totalRooms}</span>
              <span style={styles.statSub}>Polygon Enclosures</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statTile}>
              <span style={styles.statLabel}>MEP BIM Integration</span>
              <div style={styles.disciplineMiniGroup}>
                <span style={{ ...styles.miniBadge, borderColor: "#38BDF8", color: "#38BDF8" }}>
                  HVAC: {stats.hvacCount}
                </span>
                <span style={{ ...styles.miniBadge, borderColor: "#10B981", color: "#10B981" }}>
                  PLUMB: {stats.plumbCount}
                </span>
                <span style={{ ...styles.miniBadge, borderColor: "#F59E0B", color: "#F59E0B" }}>
                  ELEC: {stats.elecCount}
                </span>
              </div>
              <span style={styles.statSub}>Layered Disciplines</span>
            </div>
          </div>
        </section>

        {/* NOTIFICATIONS */}
        {error && (
          <div style={styles.alertError}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.1rem" }}>⚠️</span>
              <span>{error}</span>
            </div>
            <button style={styles.alertCloseBtn} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {successMsg && (
          <div style={styles.alertSuccess}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.1rem" }}>✅</span>
              <span>{successMsg}</span>
            </div>
            <button style={styles.alertCloseBtn} onClick={() => setSuccessMsg(null)}>✕</button>
          </div>
        )}

        {/* QUICK COMMAND STRIP */}
        <section style={styles.commandStripSection}>
          <div style={styles.commandStripHeader}>
            <span style={styles.sectionHeading}>CREATION &amp; INGESTION SUITE</span>
            <div style={styles.templatesGroup}>
              <span style={{ fontSize: "0.8rem", color: "#94A3B8", marginRight: "0.4rem" }}>
                CAD Templates:
              </span>
              <a href={getExcelTemplateUrl()} download style={styles.templateLink}>
                📥 Commercial Office .xlsx
              </a>
              <a href={get2BhkExcelTemplateUrl()} download style={styles.templateLink}>
                📥 2-BHK Residential .xlsx
              </a>
              <a href={getCustomPlanTemplateUrl()} download style={styles.templateLink}>
                📥 3-BHK Custom .xlsx
              </a>
            </div>
          </div>

          <div style={styles.actionGrid}>
            {/* Action 1: Upload Excel */}
            <div
              style={styles.actionCard}
              onClick={handleOpenNameModal}
              role="button"
              tabIndex={0}
            >
              <div style={{ ...styles.actionCardIcon, background: "rgba(56, 189, 248, 0.15)", color: "#38BDF8" }}>
                📊
              </div>
              <div style={styles.actionCardBody}>
                <h3 style={styles.actionCardTitle}>Upload Excel Specification</h3>
                <p style={styles.actionCardDesc}>
                  Import multi-sheet Excel with room coordinates, doors, windows, and HVAC sizing payloads.
                </p>
                <div style={styles.actionCardFooter}>
                  <span style={styles.actionCardBtn}>
                    {uploading ? "Ingesting..." : "Select File & Launch →"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action 2: Manual Scratch Entry */}
            <div
              style={styles.actionCard}
              onClick={() => setShowManualModal(true)}
              role="button"
              tabIndex={0}
            >
              <div style={{ ...styles.actionCardIcon, background: "rgba(16, 185, 129, 0.15)", color: "#10B981" }}>
                ✍️
              </div>
              <div style={styles.actionCardBody}>
                <h3 style={styles.actionCardTitle}>Manual Scratch Form</h3>
                <p style={styles.actionCardDesc}>
                  Draft rooms from scratch, specify corner coordinates, opening schedules, and equipment parameters.
                </p>
                <div style={styles.actionCardFooter}>
                  <span style={{ ...styles.actionCardBtn, color: "#10B981" }}>
                    Open Scratch Drafter →
                  </span>
                </div>
              </div>
            </div>

            {/* Action 3: AI Area-to-Plan */}
            <div
              style={styles.actionCard}
              onClick={() => setShowAreaModal(true)}
              role="button"
              tabIndex={0}
            >
              <div style={{ ...styles.actionCardIcon, background: "rgba(139, 92, 246, 0.15)", color: "#A78BFA" }}>
                ✨
              </div>
              <div style={styles.actionCardBody}>
                <h3 style={styles.actionCardTitle}>AI Area-to-Plan Generator</h3>
                <p style={styles.actionCardDesc}>
                  Convert overall plot dimensions and room area budgets into an optimized CAD layout instantly.
                </p>
                <div style={styles.actionCardFooter}>
                  <span style={{ ...styles.actionCardBtn, color: "#A78BFA" }}>
                    Generate Floorplan →
                  </span>
                </div>
              </div>
            </div>

            {/* Action 4: AI Prompt Copilot */}
            <div
              style={styles.actionCard}
              onClick={() => setShowAiModal(true)}
              role="button"
              tabIndex={0}
            >
              <div style={{ ...styles.actionCardIcon, background: "rgba(245, 158, 11, 0.15)", color: "#FBBF24" }}>
                🤖
              </div>
              <div style={styles.actionCardBody}>
                <h3 style={styles.actionCardTitle}>AutoCAD Drafter Copilot</h3>
                <p style={styles.actionCardDesc}>
                  Copy standardized engineering prompts for ChatGPT/Claude to produce exact MeplaniQ-compliant Excel files.
                </p>
                <div style={styles.actionCardFooter}>
                  <span style={{ ...styles.actionCardBtn, color: "#FBBF24" }}>
                    View System Prompt →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTROLS, SEARCH, FILTERS & VIEW MODE */}
        <section style={styles.controlsSection}>
          <div style={styles.controlsRow}>
            {/* Search Input */}
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search plans by name, room type, or discipline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              {searchQuery && (
                <button
                  style={styles.searchClearBtn}
                  onClick={() => setSearchQuery("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Discipline Filter Pills */}
            <div style={styles.filterPillsGroup}>
              {[
                { id: "all", label: "All Disciplines" },
                { id: "Architecture", label: "Architecture" },
                { id: "HVAC", label: "HVAC" },
                { id: "Plumbing", label: "Plumbing" },
                { id: "Electrical", label: "Electrical" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setDisciplineFilter(pill.id)}
                  style={{
                    ...styles.filterPill,
                    ...(disciplineFilter === pill.id ? styles.filterPillActive : {}),
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div style={styles.sortWrapper}>
              <span style={styles.sortLabel}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={styles.sortSelect}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">Alphabetical (A-Z)</option>
                <option value="area">Area (Largest First)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div style={styles.viewToggleGroup}>
              <button
                onClick={() => setViewMode("grid")}
                title="Grid Card View"
                style={{
                  ...styles.viewToggleBtn,
                  ...(viewMode === "grid" ? styles.viewToggleBtnActive : {}),
                }}
              >
                🔲 Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                title="Table List View"
                style={{
                  ...styles.viewToggleBtn,
                  ...(viewMode === "table" ? styles.viewToggleBtnActive : {}),
                }}
              >
                ☰ List
              </button>
            </div>

            {/* Batch Select Toggle */}
            <button
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedIds([]);
              }}
              style={{
                ...styles.batchToggleBtn,
                ...(isSelectMode ? styles.batchToggleBtnActive : {}),
              }}
            >
              {isSelectMode ? "Cancel Select" : "☑️ Select Plans"}
            </button>
          </div>

          {/* FLOATING BATCH ACTION BAR (if plans selected) */}
          {isSelectMode && (
            <div style={styles.batchActionBar}>
              <div style={styles.batchActionInfo}>
                <input
                  type="checkbox"
                  checked={
                    filteredProjects.length > 0 &&
                    selectedIds.length === filteredProjects.length
                  }
                  onChange={toggleSelectAll}
                  style={styles.checkboxInput}
                />
                <span style={styles.batchCountText}>
                  {selectedIds.length} of {filteredProjects.length} plans selected
                </span>
              </div>
              <div style={styles.batchButtonsGroup}>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedIds.length === 0 || actionInProgress}
                  style={{
                    ...styles.batchDeleteBtn,
                    opacity: selectedIds.length === 0 ? 0.5 : 1,
                  }}
                >
                  🗑️ Batch Delete ({selectedIds.length})
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  style={styles.batchClearBtn}
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}
        </section>

        {/* PROJECTS SECTION */}
        <section style={styles.projectsSection}>
          <div style={styles.sectionHeaderRow}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h2 style={styles.sectionTitle}>Commercial Plan Registry</h2>
              <span style={styles.registryCountBadge}>
                {filteredProjects.length} {filteredProjects.length === 1 ? "Plan" : "Plans"}
              </span>
            </div>
            {loading && <span style={styles.loadingPulse}>Refreshing registry...</span>}
          </div>

          {loading && projects.length === 0 ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner} />
              <p style={{ color: "#94A3B8", marginTop: "1rem" }}>
                Connecting to CAD Database &amp; Building Floorplan Index...
              </p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={styles.emptyContainer}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📐</div>
              <h3 style={{ color: "#F8FAFC", marginBottom: "0.5rem" }}>
                {searchQuery || disciplineFilter !== "all"
                  ? "No plans match your filter criteria"
                  : "No CAD Floorplans Available"}
              </h3>
              <p style={{ color: "#94A3B8", maxWidth: "450px", marginBottom: "1.5rem" }}>
                {searchQuery || disciplineFilter !== "all"
                  ? "Try adjusting your search query or discipline filter pill."
                  : "Upload an Excel specification above, create a plan from scratch, or generate one with the AI Area-to-Plan engine."}
              </p>
              {(searchQuery || disciplineFilter !== "all") && (
                <button
                  style={styles.btnResetFilters}
                  onClick={() => {
                    setSearchQuery("");
                    setDisciplineFilter("all");
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ================= GRID VIEW ================= */
            <div style={styles.projectsGrid}>
              {filteredProjects.map((project) => {
                const isSelected = selectedIds.includes(project.id);
                const isOpening = openingId === project.id;
                const isDeleting = deletingId === project.id;

                return (
                  <div
                    key={project.id}
                    style={{
                      ...styles.projectCard,
                      ...(isSelected ? styles.projectCardSelected : {}),
                    }}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleSelectProject({ stopPropagation: () => {} }, project.id);
                      } else {
                        handleOpenCanvas(project);
                      }
                    }}
                  >
                    {/* Card Top Strip */}
                    <div style={styles.cardTopStrip}>
                      {isSelectMode ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectProject(e, project.id)}
                          style={styles.checkboxInput}
                        />
                      ) : (
                        <span style={styles.planIdPill}>ID: {project.id.slice(0, 8)}</span>
                      )}

                      <div style={styles.cardHeaderActions}>
                        <button
                          style={styles.iconActionBtn}
                          onClick={(e) => handleOpenDuplicate(e, project)}
                          title="Duplicate Plan"
                        >
                          📋
                        </button>
                        <button
                          style={styles.iconActionBtn}
                          onClick={(e) => handleOpenRename(e, project)}
                          title="Rename Plan"
                        >
                          ✏️
                        </button>
                        <button
                          style={{ ...styles.iconActionBtn, color: "#EF4444" }}
                          onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                          disabled={isDeleting}
                          title="Delete Plan"
                        >
                          {isDeleting ? "..." : "🗑️"}
                        </button>
                      </div>
                    </div>

                    {/* 2D Plan Visual Mini-CAD Thumbnail */}
                    <div style={styles.thumbnailContainer}>
                      <ProjectThumbnail
                        previewRooms={project.preview_rooms || []}
                        disciplines={project.disciplines || []}
                      />
                    </div>

                    {/* Card Title & Telemetry */}
                    <div style={styles.cardContent}>
                      <h3 style={styles.cardProjectTitle} title={project.name}>
                        {project.name || "Untitled CAD Floorplan"}
                      </h3>

                      <div style={styles.cardMetricsRow}>
                        <div style={styles.metricPill}>
                          <span style={styles.metricIcon}>🚪</span>
                          <span>{project.room_count || 0} Rooms</span>
                        </div>
                        <div style={styles.metricPill}>
                          <span style={styles.metricIcon}>📐</span>
                          <span>{project.total_area_sqm || 0} m²</span>
                        </div>
                        <div style={styles.metricPill}>
                          <span style={styles.metricIcon}>📅</span>
                          <span>{formatDate(project.created_at)}</span>
                        </div>
                      </div>

                      {/* Discipline Badges */}
                      <div style={styles.cardDisciplinesRow}>
                        {(project.disciplines && project.disciplines.length > 0
                          ? project.disciplines
                          : ["Architecture"]
                        ).map((d) => (
                          <span
                            key={d}
                            style={{
                              ...styles.disciplineBadge,
                              ...(d === "HVAC"
                                ? styles.badgeHvac
                                : d === "Plumbing"
                                ? styles.badgePlumb
                                : d === "Electrical"
                                ? styles.badgeElec
                                : styles.badgeArch),
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div style={styles.cardFooterBar} onClick={(e) => e.stopPropagation()}>
                      <button
                        style={styles.btnCardExport}
                        onClick={() => setExportTarget(project)}
                        title="1-Click Direct Export Options"
                      >
                        ⚡ Export...
                      </button>

                      <button
                        style={styles.btnCardOpen}
                        onClick={(e) => handleOpenCanvas(project, e)}
                        disabled={isOpening}
                      >
                        {isOpening ? "Loading..." : "Open 2D Canvas →"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= TABLE LIST VIEW ================= */
            <div style={styles.tableCardContainer}>
              <table style={styles.projectsTable}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    {isSelectMode && (
                      <th style={{ ...styles.thCell, width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredProjects.length > 0 &&
                            selectedIds.length === filteredProjects.length
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    <th style={{ ...styles.thCell, width: "120px" }}>Preview</th>
                    <th style={styles.thCell}>Plan Name &amp; ID</th>
                    <th style={styles.thCell}>Rooms</th>
                    <th style={styles.thCell}>Area (m²)</th>
                    <th style={styles.thCell}>Disciplines</th>
                    <th style={styles.thCell}>Created</th>
                    <th style={{ ...styles.thCell, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const isSelected = selectedIds.includes(project.id);
                    return (
                      <tr
                        key={project.id}
                        style={{
                          ...styles.tableRow,
                          ...(isSelected ? styles.tableRowSelected : {}),
                        }}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleSelectProject({ stopPropagation: () => {} }, project.id);
                          } else {
                            handleOpenCanvas(project);
                          }
                        }}
                      >
                        {isSelectMode && (
                          <td style={styles.tdCell} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectProject(e, project.id)}
                            />
                          </td>
                        )}
                        <td style={styles.tdCell}>
                          <div style={{ width: "90px", height: "65px", borderRadius: "4px", overflow: "hidden" }}>
                            <ProjectThumbnail
                              previewRooms={project.preview_rooms || []}
                              disciplines={[]}
                            />
                          </div>
                        </td>
                        <td style={styles.tdCell}>
                          <div style={styles.tableNamePrimary}>{project.name}</div>
                          <div style={styles.tableNameSub}>{project.id}</div>
                        </td>
                        <td style={styles.tdCell}>
                          <span style={styles.tableMetricText}>{project.room_count || 0}</span>
                        </td>
                        <td style={styles.tdCell}>
                          <span style={{ ...styles.tableMetricText, color: "#38BDF8" }}>
                            {project.total_area_sqm || 0} m²
                          </span>
                        </td>
                        <td style={styles.tdCell}>
                          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                            {(project.disciplines || ["Architecture"]).map((d) => (
                              <span
                                key={d}
                                style={{
                                  ...styles.disciplineBadge,
                                  fontSize: "0.68rem",
                                  padding: "0.15rem 0.4rem",
                                }}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={styles.tdCell}>
                          <span style={styles.tableDateText}>{formatDate(project.created_at)}</span>
                        </td>
                        <td style={{ ...styles.tdCell, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={styles.tableActionBtnGroup}>
                            <button
                              style={styles.tableBtnExport}
                              onClick={() => setExportTarget(project)}
                              title="Export DXF / BOQ / JSON"
                            >
                              ⚡ Export
                            </button>
                            <button
                              style={styles.tableBtnOpen}
                              onClick={(e) => handleOpenCanvas(project, e)}
                            >
                              Open CAD →
                            </button>
                            <button
                              style={styles.iconActionBtn}
                              onClick={(e) => handleOpenDuplicate(e, project)}
                              title="Duplicate"
                            >
                              📋
                            </button>
                            <button
                              style={styles.iconActionBtn}
                              onClick={(e) => handleOpenRename(e, project)}
                              title="Rename"
                            >
                              ✏️
                            </button>
                            <button
                              style={{ ...styles.iconActionBtn, color: "#EF4444" }}
                              onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ================= MODALS ================= */}

      {/* 1. NAME BEFORE UPLOAD MODAL */}
      {showNameModal && (
        <div style={styles.modalOverlay} onClick={() => setShowNameModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Name Your Floorplan</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowNameModal(false)}>✕</button>
            </div>
            <form onSubmit={handleNameModalSubmit}>
              <p style={styles.modalDesc}>
                Assign a recognizable project or building title before selecting the Excel specification.
              </p>
              <input
                type="text"
                autoFocus
                placeholder="e.g., TechPark Commercial Level 04, Skyline Penthouse"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                style={styles.modalInput}
              />
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => setShowNameModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  style={{
                    ...styles.btnPrimary,
                    opacity: !newProjectName.trim() ? 0.6 : 1,
                  }}
                >
                  Browse File &amp; Ingest →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. RENAME PROJECT MODAL */}
      {renameTarget && (
        <div style={styles.modalOverlay} onClick={() => setRenameTarget(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Rename Floorplan</h3>
              <button style={styles.modalCloseBtn} onClick={() => setRenameTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleExecuteRename}>
              <p style={styles.modalDesc}>
                Update the official plan name in the engineering registry.
              </p>
              <input
                type="text"
                autoFocus
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                style={styles.modalInput}
              />
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => setRenameTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim() || actionInProgress}
                  style={styles.btnPrimary}
                >
                  {actionInProgress ? "Saving..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DUPLICATE PROJECT MODAL */}
      {duplicateTarget && (
        <div style={styles.modalOverlay} onClick={() => setDuplicateTarget(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Duplicate Floorplan</h3>
              <button style={styles.modalCloseBtn} onClick={() => setDuplicateTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleExecuteDuplicate}>
              <p style={styles.modalDesc}>
                Create an exact parametric clone of &quot;{duplicateTarget.name}&quot; with full room geometry and MEP schedules.
              </p>
              <input
                type="text"
                autoFocus
                value={duplicateInput}
                onChange={(e) => setDuplicateInput(e.target.value)}
                placeholder="Duplicate Name"
                style={styles.modalInput}
              />
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.btnSecondary}
                  onClick={() => setDuplicateTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress}
                  style={styles.btnPrimary}
                >
                  {actionInProgress ? "Cloning..." : "Create Clone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. 1-CLICK EXPORT STUDIO MODAL */}
      {exportTarget && (
        <div style={styles.modalOverlay} onClick={() => setExportTarget(null)}>
          <div style={{ ...styles.modalCard, maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.4rem" }}>⚡</span>
                <h3 style={styles.modalTitle}>1-Click Export Studio</h3>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setExportTarget(null)}>✕</button>
            </div>

            <p style={styles.modalDesc}>
              Export &quot;<strong>{exportTarget.name}</strong>&quot; into industry-standard CAD, engineering, or BOQ procurement formats directly:
            </p>

            <div style={styles.exportOptionsList}>
              {/* Option 1: AutoCAD DXF */}
              <div style={styles.exportOptionCard}>
                <div style={styles.exportOptionIcon}>📐</div>
                <div style={styles.exportOptionInfo}>
                  <div style={styles.exportOptionTitle}>AutoCAD R2018 DXF</div>
                  <div style={styles.exportOptionDesc}>
                    Vector drawing with standard CAD layers (WALLS, DOORS, WINDOWS, HVAC). Ready for AutoCAD &amp; Revit.
                  </div>
                </div>
                <button
                  style={styles.btnExportOption}
                  onClick={(e) => handleDirectDxfExport(e, exportTarget)}
                  disabled={exportingType === "dxf"}
                >
                  {exportingType === "dxf" ? "Exporting..." : "Download DXF"}
                </button>
              </div>

              {/* Option 2: BOQ Cost Estimate PDF */}
              <div style={styles.exportOptionCard}>
                <div style={styles.exportOptionIcon}>📋</div>
                <div style={styles.exportOptionInfo}>
                  <div style={styles.exportOptionTitle}>BOQ Cost Estimate PDF</div>
                  <div style={styles.exportOptionDesc}>
                    Bill of Quantities with concrete, brickwork, plaster, flooring, and MEP cost schedules.
                  </div>
                </div>
                <button
                  style={{ ...styles.btnExportOption, borderColor: "#10B981", color: "#10B981" }}
                  onClick={(e) => handleDirectBoqPdfExport(e, exportTarget)}
                  disabled={exportingType === "boq"}
                >
                  {exportingType === "boq" ? "Generating..." : "Download PDF"}
                </button>
              </div>

              {/* Option 3: MeplaniQ CAD JSON */}
              <div style={styles.exportOptionCard}>
                <div style={styles.exportOptionIcon}>📦</div>
                <div style={styles.exportOptionInfo}>
                  <div style={styles.exportOptionTitle}>CAD Specification JSON</div>
                  <div style={styles.exportOptionDesc}>
                    Complete raw parametric schema containing all polygon vertices, openings, and HVAC equipment arrays.
                  </div>
                </div>
                <button
                  style={{ ...styles.btnExportOption, borderColor: "#A78BFA", color: "#A78BFA" }}
                  onClick={(e) => handleDirectJsonExport(e, exportTarget)}
                  disabled={exportingType === "json"}
                >
                  {exportingType === "json" ? "Packaging..." : "Download JSON"}
                </button>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => setExportTarget(null)}
              >
                Close Studio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. AI PROMPT COPILOT MODAL */}
      {showAiModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAiModal(false)}>
          <div style={{ ...styles.modalCard, maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.4rem" }}>🤖</span>
                <h3 style={styles.modalTitle}>AutoCAD Drafter System Prompt</h3>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setShowAiModal(false)}>✕</button>
            </div>
            <p style={styles.modalDesc}>
              Paste this prompt into Claude, ChatGPT, or Gemini. Replace <code>[INSERT YOUR REQUIREMENT HERE]</code> with your building requirements (e.g., &quot;A 1200 sq.ft 3-BHK flat with master bedroom, attached toilet, and living room&quot;).
            </p>
            <div style={styles.promptCodeBlock}>
              <pre style={styles.promptPre}>{AI_PROMPT_TEXT}</pre>
            </div>
            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => setShowAiModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={handleCopyPrompt}
              >
                {copiedPrompt ? "✅ Copied to Clipboard!" : "📋 Copy Prompt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MANUAL SCRATCH MODAL */}
      {showManualModal && (
        <ManualEntryModal
          isOpen={showManualModal}
          onClose={() => setShowManualModal(false)}
          onSuccess={(newProject) => {
            setShowManualModal(false);
            if (newProject && newProject.project_id) {
              navigate(`/projects/${encodeURIComponent(newProject.project_id)}/cad`);
            } else {
              loadProjectList();
              notifySuccess("New manual project created successfully!");
            }
          }}
        />
      )}

      {/* 7. AREA-TO-PLAN MODAL */}
      {showAreaModal && (
        <AreaToPlanModal
          isOpen={showAreaModal}
          onClose={() => setShowAreaModal(false)}
          onSuccess={(created) => {
            setShowAreaModal(false);
            if (created && created.project_id) {
              navigate(`/projects/${encodeURIComponent(created.project_id)}/cad`);
            } else {
              loadProjectList();
              notifySuccess("Floorplan generated from area budget successfully!");
            }
          }}
        />
      )}

      <GlobalFooter />
    </div>
  );
}

/* ================= STYLES ================= */
const styles = {
  page: {
    backgroundColor: "#0B1120",
    color: "#E2E8F0",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  main: {
    flex: 1,
    maxWidth: "1440px",
    width: "100%",
    margin: "0 auto",
    padding: "2rem 1.5rem",
    boxSizing: "border-box",
  },
  headerSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    marginBottom: "2rem",
  },
  headerTextGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  badgeLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    color: "#38BDF8",
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    padding: "0.3rem 0.75rem",
    borderRadius: "20px",
    width: "fit-content",
  },
  badgePulse: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#38BDF8",
    boxShadow: "0 0 8px #38BDF8",
  },
  pageTitle: {
    fontSize: "2.25rem",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#F8FAFC",
    margin: 0,
  },
  pageSubtitle: {
    fontSize: "1rem",
    color: "#94A3B8",
    margin: 0,
    maxWidth: "800px",
    lineHeight: 1.5,
  },
  telemetryBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    backgroundColor: "#131C31",
    border: "1px solid #1E293B",
    borderRadius: "12px",
    padding: "1rem 1.5rem",
    gap: "1.5rem",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
  },
  statTile: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    minWidth: "140px",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: "0.05em",
  },
  statValue: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#F8FAFC",
    lineHeight: 1.1,
  },
  statSub: {
    fontSize: "0.75rem",
    color: "#94A3B8",
  },
  statDivider: {
    width: "1px",
    height: "40px",
    backgroundColor: "#1E293B",
  },
  disciplineMiniGroup: {
    display: "flex",
    gap: "0.4rem",
    marginTop: "0.25rem",
  },
  miniBadge: {
    fontSize: "0.68rem",
    padding: "0.15rem 0.4rem",
    borderRadius: "4px",
    border: "1px solid",
    fontWeight: 600,
  },
  alertError: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#FCA5A5",
    padding: "0.75rem 1.25rem",
    borderRadius: "8px",
    marginBottom: "1.5rem",
  },
  alertSuccess: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    color: "#6EE7B7",
    padding: "0.75rem 1.25rem",
    borderRadius: "8px",
    marginBottom: "1.5rem",
  },
  alertCloseBtn: {
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: "1rem",
  },
  commandStripSection: {
    marginBottom: "2rem",
  },
  commandStripHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.85rem",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  sectionHeading: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#64748B",
  },
  templatesGroup: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    flexWrap: "wrap",
  },
  templateLink: {
    fontSize: "0.78rem",
    color: "#38BDF8",
    textDecoration: "none",
    backgroundColor: "#1E293B",
    padding: "0.25rem 0.6rem",
    borderRadius: "6px",
    border: "1px solid #334155",
    transition: "all 0.15s ease",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1rem",
  },
  actionCard: {
    backgroundColor: "#131C31",
    border: "1px solid #1E293B",
    borderRadius: "12px",
    padding: "1.25rem",
    display: "flex",
    gap: "1rem",
    cursor: "pointer",
    transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
    outline: "none",
  },
  actionCardIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.5rem",
    flexShrink: 0,
  },
  actionCardBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  actionCardTitle: {
    fontSize: "1rem",
    fontWeight: 700,
    color: "#F8FAFC",
    margin: "0 0 0.35rem 0",
  },
  actionCardDesc: {
    fontSize: "0.8rem",
    color: "#94A3B8",
    margin: "0 0 0.75rem 0",
    lineHeight: 1.4,
  },
  actionCardFooter: {
    marginTop: "auto",
  },
  actionCardBtn: {
    fontSize: "0.825rem",
    fontWeight: 600,
    color: "#38BDF8",
  },
  controlsSection: {
    marginBottom: "1.75rem",
  },
  controlsRow: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
    backgroundColor: "#131C31",
    border: "1px solid #1E293B",
    borderRadius: "12px",
    padding: "0.75rem 1rem",
  },
  searchWrapper: {
    flex: 1,
    minWidth: "240px",
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: "0.75rem",
    fontSize: "0.9rem",
    color: "#64748B",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    backgroundColor: "#0B1120",
    border: "1px solid #1E293B",
    borderRadius: "8px",
    padding: "0.55rem 2rem 0.55rem 2.25rem",
    color: "#F8FAFC",
    fontSize: "0.875rem",
    outline: "none",
  },
  searchClearBtn: {
    position: "absolute",
    right: "0.6rem",
    background: "transparent",
    border: "none",
    color: "#64748B",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  filterPillsGroup: {
    display: "flex",
    gap: "0.4rem",
    flexWrap: "wrap",
  },
  filterPill: {
    backgroundColor: "#0B1120",
    border: "1px solid #1E293B",
    color: "#94A3B8",
    fontSize: "0.78rem",
    fontWeight: 600,
    padding: "0.45rem 0.8rem",
    borderRadius: "20px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  filterPillActive: {
    backgroundColor: "#0284C7",
    borderColor: "#38BDF8",
    color: "#FFFFFF",
  },
  sortWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  sortLabel: {
    fontSize: "0.78rem",
    color: "#64748B",
  },
  sortSelect: {
    backgroundColor: "#0B1120",
    border: "1px solid #1E293B",
    color: "#E2E8F0",
    borderRadius: "8px",
    padding: "0.45rem 0.75rem",
    fontSize: "0.825rem",
    outline: "none",
    cursor: "pointer",
  },
  viewToggleGroup: {
    display: "flex",
    backgroundColor: "#0B1120",
    borderRadius: "8px",
    padding: "2px",
    border: "1px solid #1E293B",
  },
  viewToggleBtn: {
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    padding: "0.4rem 0.65rem",
    fontSize: "0.78rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
  },
  viewToggleBtnActive: {
    backgroundColor: "#1E293B",
    color: "#F8FAFC",
  },
  batchToggleBtn: {
    backgroundColor: "transparent",
    border: "1px solid #334155",
    color: "#CBD5E1",
    fontSize: "0.8rem",
    fontWeight: 600,
    padding: "0.45rem 0.85rem",
    borderRadius: "8px",
    cursor: "pointer",
  },
  batchToggleBtnActive: {
    backgroundColor: "#1E293B",
    borderColor: "#38BDF8",
    color: "#38BDF8",
  },
  batchActionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    border: "1px solid #38BDF8",
    borderRadius: "10px",
    padding: "0.75rem 1.25rem",
    marginTop: "0.75rem",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  batchActionInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  checkboxInput: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
    accentColor: "#0284C7",
  },
  batchCountText: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "#F8FAFC",
  },
  batchButtonsGroup: {
    display: "flex",
    gap: "0.6rem",
  },
  batchDeleteBtn: {
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    padding: "0.45rem 0.9rem",
    fontSize: "0.825rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  batchClearBtn: {
    backgroundColor: "transparent",
    border: "1px solid #475569",
    color: "#CBD5E1",
    borderRadius: "6px",
    padding: "0.45rem 0.8rem",
    fontSize: "0.825rem",
    cursor: "pointer",
  },
  projectsSection: {
    marginBottom: "3rem",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.25rem",
  },
  sectionTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#F8FAFC",
    margin: 0,
  },
  registryCountBadge: {
    fontSize: "0.75rem",
    backgroundColor: "#1E293B",
    color: "#94A3B8",
    padding: "0.2rem 0.6rem",
    borderRadius: "12px",
    fontWeight: 600,
  },
  loadingPulse: {
    fontSize: "0.8rem",
    color: "#38BDF8",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4rem 2rem",
    backgroundColor: "#131C31",
    borderRadius: "12px",
    border: "1px solid #1E293B",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #1E293B",
    borderTopColor: "#38BDF8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  emptyContainer: {
    textAlign: "center",
    padding: "4rem 2rem",
    backgroundColor: "#131C31",
    borderRadius: "12px",
    border: "1px dashed #334155",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  btnResetFilters: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    color: "#38BDF8",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 600,
  },
  projectsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: "1.5rem",
  },
  projectCard: {
    backgroundColor: "#131C31",
    border: "1px solid #1E293B",
    borderRadius: "12px",
    padding: "1.1rem",
    display: "flex",
    flexDirection: "column",
    cursor: "pointer",
    transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
  },
  projectCardSelected: {
    borderColor: "#0284C7",
    boxShadow: "0 0 0 2px rgba(2, 132, 199, 0.4)",
  },
  cardTopStrip: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  planIdPill: {
    fontSize: "0.7rem",
    fontFamily: "monospace",
    color: "#64748B",
    backgroundColor: "#0B1120",
    padding: "0.15rem 0.5rem",
    borderRadius: "4px",
    border: "1px solid #1E293B",
  },
  cardHeaderActions: {
    display: "flex",
    gap: "0.3rem",
  },
  iconActionBtn: {
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    cursor: "pointer",
    fontSize: "0.85rem",
    padding: "0.2rem 0.35rem",
    borderRadius: "4px",
    transition: "background-color 0.12s ease",
  },
  thumbnailContainer: {
    marginBottom: "0.85rem",
  },
  cardContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    marginBottom: "1rem",
  },
  cardProjectTitle: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "#F8FAFC",
    margin: 0,
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardMetricsRow: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  metricPill: {
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    backgroundColor: "#0B1120",
    padding: "0.25rem 0.55rem",
    borderRadius: "6px",
    fontSize: "0.75rem",
    color: "#94A3B8",
    border: "1px solid #1E293B",
  },
  metricIcon: {
    fontSize: "0.8rem",
  },
  cardDisciplinesRow: {
    display: "flex",
    gap: "0.4rem",
    flexWrap: "wrap",
    marginTop: "0.2rem",
  },
  disciplineBadge: {
    fontSize: "0.7rem",
    fontWeight: 700,
    padding: "0.15rem 0.5rem",
    borderRadius: "4px",
    border: "1px solid",
  },
  badgeArch: {
    backgroundColor: "rgba(100, 116, 139, 0.15)",
    borderColor: "#475569",
    color: "#94A3B8",
  },
  badgeHvac: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.4)",
    color: "#38BDF8",
  },
  badgePlumb: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    color: "#10B981",
  },
  badgeElec: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    color: "#F59E0B",
  },
  cardFooterBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.5rem",
    borderTop: "1px solid #1E293B",
    paddingTop: "0.75rem",
  },
  btnCardExport: {
    backgroundColor: "transparent",
    border: "1px solid #334155",
    color: "#CBD5E1",
    borderRadius: "6px",
    padding: "0.45rem 0.8rem",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnCardOpen: {
    backgroundColor: "#0284C7",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    padding: "0.45rem 0.9rem",
    fontSize: "0.825rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  },
  tableCardContainer: {
    backgroundColor: "#131C31",
    border: "1px solid #1E293B",
    borderRadius: "12px",
    overflow: "hidden",
  },
  projectsTable: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  tableHeaderRow: {
    backgroundColor: "#0B1120",
    borderBottom: "1px solid #1E293B",
  },
  thCell: {
    padding: "0.85rem 1rem",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tableRow: {
    borderBottom: "1px solid #1E293B",
    cursor: "pointer",
    transition: "background-color 0.12s ease",
  },
  tableRowSelected: {
    backgroundColor: "rgba(2, 132, 199, 0.1)",
  },
  tdCell: {
    padding: "0.85rem 1rem",
    fontSize: "0.85rem",
    color: "#E2E8F0",
    verticalAlign: "middle",
  },
  tableNamePrimary: {
    fontWeight: 600,
    color: "#F8FAFC",
  },
  tableNameSub: {
    fontSize: "0.72rem",
    color: "#64748B",
    fontFamily: "monospace",
  },
  tableMetricText: {
    fontWeight: 600,
  },
  tableDateText: {
    color: "#94A3B8",
    fontSize: "0.8rem",
  },
  tableActionBtnGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.4rem",
  },
  tableBtnExport: {
    backgroundColor: "transparent",
    border: "1px solid #334155",
    color: "#CBD5E1",
    borderRadius: "4px",
    padding: "0.3rem 0.6rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  tableBtnOpen: {
    backgroundColor: "#0284C7",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "4px",
    padding: "0.3rem 0.7rem",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "1rem",
  },
  modalCard: {
    backgroundColor: "#131C31",
    border: "1px solid #1E293B",
    borderRadius: "14px",
    padding: "1.75rem",
    width: "100%",
    maxWidth: "480px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#F8FAFC",
    margin: 0,
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    fontSize: "1.2rem",
    cursor: "pointer",
  },
  modalDesc: {
    fontSize: "0.875rem",
    color: "#94A3B8",
    lineHeight: 1.5,
    margin: "0 0 1.25rem 0",
  },
  modalInput: {
    width: "100%",
    backgroundColor: "#0B1120",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    color: "#F8FAFC",
    fontSize: "0.95rem",
    boxSizing: "border-box",
    outline: "none",
    marginBottom: "1.5rem",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  btnSecondary: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    color: "#E2E8F0",
    borderRadius: "8px",
    padding: "0.6rem 1.2rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnPrimary: {
    backgroundColor: "#0284C7",
    border: "none",
    color: "#FFFFFF",
    borderRadius: "8px",
    padding: "0.6rem 1.2rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  exportOptionsList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
    marginBottom: "1.5rem",
  },
  exportOptionCard: {
    backgroundColor: "#0B1120",
    border: "1px solid #1E293B",
    borderRadius: "10px",
    padding: "1rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  exportOptionIcon: {
    fontSize: "1.8rem",
    flexShrink: 0,
  },
  exportOptionInfo: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#F8FAFC",
    marginBottom: "0.2rem",
  },
  exportOptionDesc: {
    fontSize: "0.78rem",
    color: "#94A3B8",
    lineHeight: 1.35,
  },
  btnExportOption: {
    backgroundColor: "transparent",
    border: "1px solid #38BDF8",
    color: "#38BDF8",
    padding: "0.5rem 0.85rem",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  promptCodeBlock: {
    backgroundColor: "#0B1120",
    border: "1px solid #1E293B",
    borderRadius: "8px",
    padding: "1rem",
    maxHeight: "220px",
    overflowY: "auto",
    marginBottom: "1.5rem",
  },
  promptPre: {
    margin: 0,
    color: "#38BDF8",
    fontSize: "0.78rem",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    lineHeight: 1.4,
  },
};
