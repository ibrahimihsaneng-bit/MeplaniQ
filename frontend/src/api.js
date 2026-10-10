const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchDefaultPayload() {
  const response = await fetch(`${API_BASE_URL}/api/default-payload`);
  if (!response.ok) {
    throw new Error(`Failed to fetch default payload: ${response.statusText}`);
  }
  return await response.json();
}

export async function solveCadGeometry(roomsPayload, openingsPayload = [], hvacPayload = []) {
  const response = await fetch(`${API_BASE_URL}/solve`, {
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
  if (!response.ok) {
    throw new Error(`CAD Geometry solving failed: ${response.statusText}`);
  }
  return await response.json();
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
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload-plan`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `Upload failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorDetail = errData.detail;
      }
    } catch (e) {
      // Fallback to generic status text
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

export async function fetchProjects() {
  const response = await fetch(`${API_BASE_URL}/api/projects`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project list: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchProjectById(projectId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project (${response.statusText})`);
  }
  return await response.json();
}

export async function uploadProjectFile(file, projectName = null) {
  const formData = new FormData();
  formData.append("file", file);
  if (projectName && projectName.trim()) {
    formData.append("name", projectName.trim());
  }

  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `Upload failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorDetail = errData.detail;
      }
    } catch (e) {
      // Fallback
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

export async function deleteProjectById(projectId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete project: ${response.statusText}`);
  }
  return await response.json();
}

export async function updateProjectById(projectId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = `Update failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorDetail = errData.detail;
      }
    } catch (e) {
      // Fallback
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

export async function exportDxf(solveData) {
  const response = await fetch(`${API_BASE_URL}/api/export-dxf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(solveData),
  });

  if (!response.ok) {
    throw new Error(`DXF Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "floorplan_export.dxf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadProjectPdf(projectId, projectName = "Project_Report", liveCadData = null) {
  let response;
  if (projectId) {
    try {
      response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/export-pdf`);
    } catch (e) {
      // fallback to live post if project ID fetch fails
    }
  }

  if ((!response || !response.ok) && liveCadData) {
    response = await fetch(`${API_BASE_URL}/api/projects/export-pdf-live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cad_data: liveCadData, project_name: projectName })
    });
  }

  if (!response || !response.ok) {
    const statusMsg = response ? `${response.status}: ${response.statusText}` : "Network error";
    throw new Error(`PDF Export failed (${statusMsg})`);
  }

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
}

export async function downloadProjectBoqPdf(projectId, qualityTier = "medium", projectName = "BOQ_Cost_Estimate", liveCadData = null) {
  let response;
  if (projectId) {
    try {
      response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/export-boq-pdf?quality_tier=${encodeURIComponent(qualityTier)}`);
    } catch (e) {
      // fallback to live post
    }
  }

  if ((!response || !response.ok) && liveCadData) {
    response = await fetch(`${API_BASE_URL}/api/projects/export-boq-pdf-live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cad_data: liveCadData, quality_tier: qualityTier, project_name: projectName })
    });
  }

  if (!response || !response.ok) {
    const statusMsg = response ? `${response.status}: ${response.statusText}` : "Network error";
    throw new Error(`BOQ PDF Export failed (${statusMsg})`);
  }

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
}

export async function exportExcel(cadData, projectName = "Floorplan") {
  const response = await fetch(`${API_BASE_URL}/api/export-excel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cadData),
  });
  if (!response.ok) {
    let errorDetail = `Excel Export failed (${response.status})`;
    try {
      const err = await response.json();
      if (err && err.detail) errorDetail = err.detail;
    } catch (e) {}
    throw new Error(errorDetail);
  }

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
}

export async function downloadProjectExcel(projectId, projectName = "Project_Data") {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/export-excel`);
  if (!response.ok) {
    throw new Error(`Excel Export failed (${response.status}: ${response.statusText})`);
  }

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
}

export async function createManualProject(payload) {
  const response = await fetch(`${API_BASE_URL}/api/projects/manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = `Creation failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorDetail = errData.detail;
      }
    } catch (e) {
      // Fallback
    }
    throw new Error(errorDetail);
  }

  return await response.json();
}

export async function fetchAreaProgramProposal(params) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/api/projects/area-program-proposal?${query}`);
  if (!response.ok) {
    let errorDetail = `Proposal query failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) errorDetail = errData.detail;
    } catch (e) {}
    throw new Error(errorDetail);
  }
  return await response.json();
}

export async function generateProjectFromArea(payload) {
  const response = await fetch(`${API_BASE_URL}/api/projects/generate-from-area`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = `Generation failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) errorDetail = errData.detail;
    } catch (e) {}
    throw new Error(errorDetail);
  }

  return await response.json();
}

// ---------------------------------------------------------------------------
// Electrical Subsystem API
// ---------------------------------------------------------------------------

export async function fetchElectricalLayout(projectId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical`);
  if (!response.ok) {
    throw new Error(`Failed to fetch electrical layout: ${response.statusText}`);
  }
  return await response.json();
}

export async function addElectricalComponent(projectId, compData) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/components`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(compData)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to add electrical component: ${response.statusText}`);
  }
  return await response.json();
}

export async function updateElectricalComponent(projectId, compId, updateData) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/components/${compId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update electrical component: ${response.statusText}`);
  }
  return await response.json();
}

export async function deleteElectricalComponent(projectId, compId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/components/${compId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete electrical component: ${response.statusText}`);
  }
  return await response.json();
}

export async function createElectricalCircuit(projectId, circuitData) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/circuits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(circuitData)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create circuit: ${response.statusText}`);
  }
  return await response.json();
}

export async function updateElectricalCircuit(projectId, circuitId, updateData) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/circuits/${circuitId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update circuit: ${response.statusText}`);
  }
  return await response.json();
}

export async function deleteElectricalCircuit(projectId, circuitId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/circuits/${circuitId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete circuit: ${response.statusText}`);
  }
  return await response.json();
}

export async function addElectricalRoute(projectId, routeData) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(routeData)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to add route: ${response.statusText}`);
  }
  return await response.json();
}

export async function deleteElectricalRoute(projectId, routeId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/routes/${routeId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete route: ${response.statusText}`);
  }
  return await response.json();
}

export async function autoRouteElectrical(projectId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/electrical/auto-route`, {
    method: "POST"
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to auto-route electrical: ${response.statusText}`);
  }
  return await response.json();
}

export async function autoPopulateProjectMep(projectId, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/auto-populate-mep`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to auto-populate MEP: ${response.statusText}`);
  }
  return await response.json();
}

export async function switchProjectVariant(projectId, variant = 0) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/switch-variant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to switch layout variant: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchTierSpecifications() {
  const response = await fetch(`${API_BASE_URL}/api/boq/tier-specifications`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch tier specifications: ${response.statusText}`);
  }
  return await response.json();
}

export async function calculateProjectBoq(projectId, qualityTier = "medium") {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/calculate-boq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quality_tier: qualityTier })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to calculate BOQ: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchProjectBoq(projectId) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/boq`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch project BOQ: ${response.statusText}`);
  }
  return await response.json();
}

export async function calculateBoqLive(cadData, qualityTier = "medium") {
  const response = await fetch(`${API_BASE_URL}/api/projects/calculate-boq-live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cad_data: cadData, quality_tier: qualityTier })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to calculate live BOQ: ${response.statusText}`);
  }
  return await response.json();
}

export function getProjectBoqPdfUrl(projectId, qualityTier = "medium") {
  return `${API_BASE_URL}/api/projects/${projectId}/export-boq-pdf?quality_tier=${encodeURIComponent(qualityTier)}`;
}
