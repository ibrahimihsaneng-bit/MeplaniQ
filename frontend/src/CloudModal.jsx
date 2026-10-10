import React, { useState, useEffect } from 'react';
import {
  signInUser,
  signUpUser,
  signOutUser,
  getCloudProjects,
  deleteCloudProject,
  isSupabaseConfigured
} from './supabaseClient';

export default function CloudModal({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  currentProjectData,
  onLoadCloudProject,
  onSaveToCloud,
  initialTab = 'projects' // 'auth' | 'projects'
}) {
  const [tab, setTab] = useState(initialTab);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      if (currentUser) {
        fetchProjects();
      } else {
        setTab('auth');
      }
    }
  }, [isOpen, initialTab, currentUser]);

  const fetchProjects = async () => {
    if (!currentUser) return;
    setLoadingProjects(true);
    try {
      const list = await getCloudProjects(currentUser);
      setProjects(list || []);
    } catch (e) {
      console.error("Failed to load cloud projects:", e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("Please provide both email and password.");
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    try {
      let result;
      if (authMode === 'signup') {
        result = await signUpUser(email, password);
      } else {
        result = await signInUser(email, password);
      }

      if (result.user) {
        onUserChange(result.user);
        setTab('projects');
      } else if (result.error) {
        setAuthError(result.error.message || "Authentication failed.");
      }
    } catch (err) {
      setAuthError(err.message || "Network error. Using fallback.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthLoading(true);
    try {
      const demoEmail = 'architect@antigravity.cad';
      const result = await signInUser(demoEmail, 'demo123456');
      if (result.user) {
        onUserChange(result.user);
        setTab('projects');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    onUserChange(null);
    setTab('auth');
  };

  const handleDelete = async (projId) => {
    if (!window.confirm("Are you sure you want to delete this cloud backup?")) return;
    await deleteCloudProject(currentUser, projId);
    fetchProjects();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#0F172A',
        border: '1px solid #334155',
        borderRadius: '12px',
        width: '580px',
        maxWidth: '92vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        color: '#F8FAFC',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#1E293B'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: '#38BDF8', color: '#0F172A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16
            }}>
              ☁
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Cloud CAD Database (Supabase)</h3>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                {isSupabaseConfigured ? "Connected to Live Supabase Cloud" : "Resilient Cloud Vault (Offline / Demo Mode)"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* User bar if logged in */}
        {currentUser && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: '#131D31',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
              <span>Signed in as: <strong style={{ color: '#38BDF8' }}>{currentUser.email}</strong></span>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => setTab('projects')}
                style={{
                  background: tab === 'projects' ? '#334155' : 'transparent',
                  color: tab === 'projects' ? '#38BDF8' : '#94A3B8',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Saved Floorplans ({projects.length})
              </button>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  color: '#EF4444',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {tab === 'auth' || !currentUser ? (
            <div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #1E293B', paddingBottom: '10px' }}>
                <button
                  onClick={() => setAuthMode('login')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: authMode === 'login' ? '#38BDF8' : '#64748B',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderBottom: authMode === 'login' ? '2px solid #38BDF8' : 'none',
                    paddingBottom: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: authMode === 'signup' ? '#38BDF8' : '#64748B',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderBottom: authMode === 'signup' ? '2px solid #38BDF8' : 'none',
                    paddingBottom: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Create Account
                </button>
              </div>

              {authError && (
                <div style={{ padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', borderRadius: '6px', color: '#FCA5A5', fontSize: '12px', marginBottom: '14px' }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Architect Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@studio.com"
                    style={{
                      width: '100%',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    width: '100%',
                    backgroundColor: '#38BDF8',
                    color: '#0F172A',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    marginBottom: '10px'
                  }}
                >
                  {authLoading ? "Authenticating..." : (authMode === 'login' ? "Sign In to Cloud" : "Create Cloud Account")}
                </button>

                <div style={{ textAlign: 'center', margin: '14px 0', color: '#64748B', fontSize: '11px' }}>
                  &mdash; OR 1-CLICK INSTANT DEMO &mdash;
                </div>

                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={authLoading}
                  style={{
                    width: '100%',
                    backgroundColor: '#334155',
                    color: '#F8FAFC',
                    border: '1px solid #475569',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Quick Login as Demo Architect
                </button>
              </form>
            </div>
          ) : (
            <div>
              {/* Quick Actions Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                  Cloud Storage Vault &bull; {projects.length} saved project(s)
                </span>
                <button
                  onClick={async () => {
                    if (onSaveToCloud) {
                      await onSaveToCloud();
                      fetchProjects();
                    }
                  }}
                  style={{
                    backgroundColor: '#10B981',
                    color: '#0F172A',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>☁+</span> Save Current Floorplan
                </button>
              </div>

              {loadingProjects ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                  Fetching your cloud floorplans...
                </div>
              ) : projects.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center', border: '1px dashed #334155', borderRadius: '8px', color: '#94A3B8' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>☁️</div>
                  <div style={{ fontWeight: 600, color: '#E2E8F0', marginBottom: '4px' }}>No cloud projects yet</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Click &quot;Save Current Floorplan&quot; above to back up your current work to the cloud.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      style={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#F8FAFC', marginBottom: '3px' }}>
                          {proj.project_name || "Floorplan CAD"}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', gap: '10px' }}>
                          <span>🏠 {proj.room_count} Room(s)</span>
                          <span>🚪 {proj.opening_count || 0} Opening(s)</span>
                          <span>❄ {proj.hvac_count || 0} HVAC</span>
                          <span>📅 {new Date(proj.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            if (onLoadCloudProject) {
                              onLoadCloudProject(proj.cad_payload);
                              onClose();
                            }
                          }}
                          style={{
                            backgroundColor: '#38BDF8',
                            color: '#0F172A',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          Load Plan
                        </button>
                        <button
                          onClick={() => handleDelete(proj.id)}
                          title="Delete from cloud"
                          style={{
                            background: 'transparent',
                            border: '1px solid #EF4444',
                            color: '#EF4444',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
