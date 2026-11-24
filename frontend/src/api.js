import {
  getCombinedProjectsSummary,
  getCombinedProjectById,
  solveGeometryInBrowser,
  saveLocalProject,
  deleteLocalProject,
  updateLocalProject,
  generateAreaProgramProposalLocal,
  generateProjectFromAreaLocal,
  downloadDxfInBrowser,
  calculateBoqLocal
} from "./utils/clientCadSolver";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";

/**
 * Robust JSON request helper that detects HTML fallback responses (e.g. Vercel SPA rewrites)
 * or network failures, returning an object { ok: boolean, data?: any, isHtml?: boolean, status?: number }
 */
async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    // Vercel SPA rewrite returns 200 with text/html when an API route does not exist
    if (contentType.includes("text/html")) {
      return { ok: false, isHtml: true, status: response.status, data: null };
    }

    if (!response.ok) {
      let errDetail = response.statusText;
      try {
        const errJson = await response.json();
        if (errJson && errJson.detail) errDetail = errJson.detail;
      } catch (_) {}
      return { ok: false, isHtml: false, status: response.status, error: errDetail, data: null };
    }

    const text = await response.text();
    if (!text || text.trim().startsWith("<")) {
      return { ok: false, isHtml: true, status: response.status, data: null };
    }

    const data = JSON.parse(text);
    return { ok: true, isHtml: false, status: response.status, data };
  } catch (err) {
    return { ok: false, isNetworkError: true, error: err.message, data: null };
  }
}

export async function fetchDefaultPayload() {
  const res = await requestJson(`${API_BASE_URL}/api/default-payload`);
  if (res.ok && res.data) return res.data;
  return getCombinedProjectById("default-sample-1bhk") || {};
}

export async function solveCadGeometry(roomsPayload, openingsPayload = [], hvacPayload = []) {
  const res = await requestJson(`${API_BASE_URL}/solve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rooms: roomsPayload,
      openings: openingsPayload,
      hvac_equipment: hvacPayload
    }),
  });
  if (res.ok && res.data) return res.data;
  return solveGeometryInBrowser("Solved CAD Plan", roomsPayload, openingsPayload, hvacPayload);
}

export function getExcelTemplateUrl() {
  return `${API_BASE_URL}/api/download-template`;
}

export function get2BhkExcelTemplateUrl() {
  return `${API_BASE_URL}/api/download-2bhk-template`;
}

export function getCustomPlanTemplateUrl() {
  return `${API_BASE_URL}/api/download-custom-plan`;
}

export function getCustom3BhkExcelTemplateUrl() {
  return `${API_BASE_URL}/api/download-custom-plan`;
}

export async function uploadExcelPlan(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/upload-plan`, {
      method: "POST",
      body: formData,
    });

    if (response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
      const text = await response.text();
      if (!text.trim().startsWith("<")) {
        return JSON.parse(text);
      }
    }
  } catch (_) {}

  const safeName = (file && file.name ? file.name.replace(/\.[^/.]+$/, "") : "Uploaded Plan");
  return solveGeometryInBrowser(safeName);
}

export async function fetchProjects() {
  const res = await requestJson(`${API_BASE_URL}/api/projects`);
  if (res.ok && Array.isArray(res.data)) {
    return res.data;
  }
  return getCombinedProjectsSummary();
}

export async function fetchProjectById(projectId) {
  const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`);
  if (res.ok && res.data) {
    return res.data;
  }
  const local = getCombinedProjectById(projectId);
  if (local) return local;
  throw new Error(`Project ${projectId} not found.`);
}

export async function uploadProjectFile(file, projectName = null) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (projectName && projectName.trim()) {
      formData.append("name", projectName.trim());
    }

    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: "POST",
      body: formData,
    });

    if (response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
      const text = await response.text();
      if (!text.trim().startsWith("<")) {
        return JSON.parse(text);
      }
    }
  } catch (_) {}

  const safeName = projectName || (file && file.name ? file.name.replace(/\.[^/.]+$/, "") : "Uploaded Project");
  return solveGeometryInBrowser(safeName);
}

export async function deleteProjectById(projectId) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}
  deleteLocalProject(projectId);
  return { status: "success", deleted_id: projectId };
}

export async function updateProjectById(projectId, payload) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}
  return updateLocalProject(projectId, payload);
}

export async function exportDxf(solveData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export-dxf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(solveData),
    });

    if (response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "floorplan_export.dxf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    }
  } catch (_) {}

  downloadDxfInBrowser(solveData, "floorplan_export.dxf");
}

export async function downloadProjectPdf(projectId, projectName = "Project_Report", liveCadData = null) {
  let response;
  if (projectId) {
    try {
      response = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/export-pdf`);
    } catch (e) {}
  }

  if ((!response || !response.ok || (response.headers.get("content-type") || "").includes("text/html")) && liveCadData) {
    try {
      response = await fetch(`${API_BASE_URL}/api/projects/export-pdf-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cad_data: liveCadData, project_name: projectName })
      });
    } catch (_) {}
  }

  if (response && response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (projectName || "Project_Report").replace(/[^a-zA-Z0-9_\-]/g, "_");
    a.download = `${safeName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 2500);
    return;
  }

  // Graceful browser print fallback if server PDF rendering is unavailable
  window.print();
}

export async function downloadProjectBoqPdf(projectId, qualityTier = "medium", projectName = "BOQ_Cost_Estimate", liveCadData = null) {
  let response;
  if (projectId) {
    try {
      response = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/export-boq-pdf?quality_tier=${encodeURIComponent(qualityTier)}`);
    } catch (e) {}
  }

  if ((!response || !response.ok || (response.headers.get("content-type") || "").includes("text/html")) && liveCadData) {
    try {
      response = await fetch(`${API_BASE_URL}/api/projects/export-boq-pdf-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cad_data: liveCadData, quality_tier: qualityTier, project_name: projectName })
      });
    } catch (_) {}
  }

  if (response && response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (projectName || "BOQ_Cost_Estimate").replace(/[^a-zA-Z0-9_\-]/g, "_");
    a.download = `${safeName}_BOQ_${qualityTier.toUpperCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 2500);
    return;
  }

  window.print();
}

export async function exportExcel(cadData, projectName = "Floorplan") {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export-excel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cadData),
    });
    if (response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (projectName || "Floorplan").replace(/[^a-zA-Z0-9_\-]/g, "_");
      a.download = `${safeName}_Full_Schedule.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    }
  } catch (_) {}

  // Fallback: download CSV/JSON data
  const blob = new Blob([JSON.stringify(cadData, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (projectName || "Floorplan").replace(/[^a-zA-Z0-9_\-]/g, "_");
  a.download = `${safeName}_Schedule.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadProjectExcel(projectId, projectName = "Project_Data") {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/export-excel`);
    if (response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (projectName || "Project_Data").replace(/[^a-zA-Z0-9_\-]/g, "_");
      a.download = `${safeName}_Full_Schedule.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    }
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  return exportExcel(project, projectName);
}

export async function createManualProject(payload) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(typeof payload === "object" ? payload : { name: payload }),
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}
  return solveGeometryInBrowser(payload);
}

export async function fetchAreaProgramProposal(params) {
  const query = new URLSearchParams(params).toString();
  const res = await requestJson(`${API_BASE_URL}/api/projects/area-program-proposal?${query}`);
  if (res.ok && res.data) return res.data;
  return generateAreaProgramProposalLocal(params);
}

export async function generateProjectFromArea(payload) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/generate-from-area`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}
  return generateProjectFromAreaLocal(payload);
}

// ---------------------------------------------------------------------------
// Electrical Subsystem API
// ---------------------------------------------------------------------------

export async function fetchElectricalLayout(projectId) {
  const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical`);
  if (res.ok && res.data) return res.data;
  const project = getCombinedProjectById(projectId) || {};
  return {
    components: project.electrical_components || [],
    circuits: project.electrical_circuits || [],
    routes: project.electrical_routes || []
  };
}

export async function addElectricalComponent(projectId, compData) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/components`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compData)
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = project.electrical_components || [];
  const newComp = { ...compData, id: compData.id || `EC-${Date.now()}` };
  list.push(newComp);
  updateLocalProject(projectId, { electrical_components: list });
  return newComp;
}

export async function updateElectricalComponent(projectId, compId, updateData) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/components/${encodeURIComponent(compId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = (project.electrical_components || []).map((c) =>
    c.id === compId ? { ...c, ...updateData } : c
  );
  updateLocalProject(projectId, { electrical_components: list });
  return updateData;
}

export async function deleteElectricalComponent(projectId, compId) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/components/${encodeURIComponent(compId)}`, {
      method: "DELETE"
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = (project.electrical_components || []).filter((c) => c.id !== compId);
  updateLocalProject(projectId, { electrical_components: list });
  return { status: "success", deleted_id: compId };
}

export async function createElectricalCircuit(projectId, circuitData) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/circuits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(circuitData)
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = project.electrical_circuits || [];
  const newCircuit = { ...circuitData, id: circuitData.id || `CKT-${Date.now()}` };
  list.push(newCircuit);
  updateLocalProject(projectId, { electrical_circuits: list });
  return newCircuit;
}

export async function updateElectricalCircuit(projectId, circuitId, updateData) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/circuits/${encodeURIComponent(circuitId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = (project.electrical_circuits || []).map((c) =>
    c.id === circuitId ? { ...c, ...updateData } : c
  );
  updateLocalProject(projectId, { electrical_circuits: list });
  return updateData;
}

export async function deleteElectricalCircuit(projectId, circuitId) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/circuits/${encodeURIComponent(circuitId)}`, {
      method: "DELETE"
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = (project.electrical_circuits || []).filter((c) => c.id !== circuitId);
  updateLocalProject(projectId, { electrical_circuits: list });
  return { status: "success", deleted_id: circuitId };
}

export async function addElectricalRoute(projectId, routeData) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(routeData)
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = project.electrical_routes || [];
  const newRoute = { ...routeData, id: routeData.id || `RT-${Date.now()}` };
  list.push(newRoute);
  updateLocalProject(projectId, { electrical_routes: list });
  return newRoute;
}

export async function deleteElectricalRoute(projectId, routeId) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/routes/${encodeURIComponent(routeId)}`, {
      method: "DELETE"
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  const list = (project.electrical_routes || []).filter((r) => r.id !== routeId);
  updateLocalProject(projectId, { electrical_routes: list });
  return { status: "success", deleted_id: routeId };
}

export async function autoRouteElectrical(projectId) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/electrical/auto-route`, {
      method: "POST"
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  return { status: "success", message: "Conduits generated.", routes: project.electrical_routes || [] };
}

export async function autoPopulateProjectMep(projectId, options = {}) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/auto-populate-mep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  return project;
}

export async function switchProjectVariant(projectId, variant = 0) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/switch-variant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant })
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  return getCombinedProjectById(projectId) || {};
}

export async function fetchTierSpecifications() {
  const res = await requestJson(`${API_BASE_URL}/api/boq/tier-specifications`);
  if (res.ok && res.data) return res.data;
  return [
    { tier: "budget", name: "Economy Spec", rate_per_sqft: 1800 },
    { tier: "medium", name: "Standard Premium", rate_per_sqft: 2600 },
    { tier: "luxury", name: "Ultra Luxury", rate_per_sqft: 4200 }
  ];
}

export async function calculateProjectBoq(projectId, qualityTier = "medium") {
  const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/calculate-boq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quality_tier: qualityTier })
  });
  if (res.ok && res.data) return res.data;
  const project = getCombinedProjectById(projectId) || {};
  return calculateBoqLocal(project, qualityTier);
}

export async function fetchProjectBoq(projectId) {
  const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/boq`);
  if (res.ok && res.data) return res.data;
  const project = getCombinedProjectById(projectId) || {};
  return calculateBoqLocal(project, "medium");
}

export async function calculateBoqLive(cadData, qualityTier = "medium") {
  const res = await requestJson(`${API_BASE_URL}/api/projects/calculate-boq-live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cad_data: cadData, quality_tier: qualityTier })
  });
  if (res.ok && res.data) return res.data;
  return calculateBoqLocal(cadData, qualityTier);
}

export function getProjectBoqPdfUrl(projectId, qualityTier = "medium") {
  return `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/export-boq-pdf?quality_tier=${encodeURIComponent(qualityTier)}`;
}

export async function renameProject(projectId, newName) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/rename`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  updateLocalProject(projectId, { name: newName, project_name: newName });
  return { id: projectId, name: newName };
}

export async function duplicateProject(projectId, newName = null) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/duplicate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  const original = getCombinedProjectById(projectId);
  if (original) {
    const dup = JSON.parse(JSON.stringify(original));
    const newId = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    dup.id = newId;
    dup.project_id = newId;
    dup.name = newName || `${original.name || original.project_name || "Floorplan"} (Copy)`;
    dup.project_name = dup.name;
    dup.created_at = new Date().toISOString();
    saveLocalProject(dup);
    return dup;
  }
  throw new Error("Project to duplicate not found.");
}

export async function batchDeleteProjects(projectIds) {
  try {
    const res = await requestJson(`${API_BASE_URL}/api/projects/batch-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project_ids: projectIds }),
    });
    if (res.ok && res.data) return res.data;
  } catch (_) {}

  (projectIds || []).forEach((id) => deleteLocalProject(id));
  return { status: "success", deleted_count: (projectIds || []).length };
}

export async function downloadProjectDxf(projectId, projectName = "Floorplan") {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/export-dxf`);
    if (response.ok && !(response.headers.get("content-type") || "").includes("text/html")) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (projectName || "Floorplan").replace(/[^a-zA-Z0-9_\-]/g, "_");
      a.download = `${safeName}_Floorplan.dxf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    }
  } catch (_) {}

  const project = getCombinedProjectById(projectId) || {};
  downloadDxfInBrowser(project, `${projectName || "Floorplan"}.dxf`);
}

export async function downloadProjectJson(projectId, projectName = "Floorplan") {
  const data = await fetchProjectById(projectId);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (projectName || "Floorplan").replace(/[^a-zA-Z0-9_\-]/g, "_");
  a.download = `${safeName}_CAD.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
