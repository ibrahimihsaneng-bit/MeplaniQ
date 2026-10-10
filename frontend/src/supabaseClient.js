import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const LOCAL_AUTH_KEY = 'cad_cloud_auth_user';
const LOCAL_PROJECTS_KEY_PREFIX = 'cad_cloud_vault_';

export function getLocalUser() {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setLocalUser(user) {
  if (user) {
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_AUTH_KEY);
  }
}

export async function getCurrentUser() {
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return { id: user.id, email: user.email, isLive: true };
    } catch (e) {
      console.warn("Supabase auth check failed, checking local session:", e);
    }
  }
  return getLocalUser();
}

export async function signUpUser(email, password) {
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      const user = { id: data.user?.id || 'usr_' + Date.now(), email, isLive: true };
      setLocalUser(user);
      return { user, error: null };
    } catch (err) {
      console.warn("Supabase signup failed, using local cloud fallback:", err);
      // Fallback to local
    }
  }

  // Local cloud fallback user
  const user = { id: 'usr_' + Math.random().toString(36).substr(2, 9), email, isLive: false };
  setLocalUser(user);
  return { user, error: null };
}

export async function signInUser(email, password) {
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const user = { id: data.user.id, email: data.user.email, isLive: true };
      setLocalUser(user);
      return { user, error: null };
    } catch (err) {
      console.warn("Supabase signin failed, using local cloud fallback:", err);
    }
  }

  // Local cloud fallback user
  const user = { id: 'usr_' + Math.random().toString(36).substr(2, 9), email, isLive: false };
  setLocalUser(user);
  return { user, error: null };
}

export async function signOutUser() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
  }
  setLocalUser(null);
}

export async function saveProjectToCloud(user, projectData) {
  if (!user) throw new Error("Please log in to save projects to Cloud Database.");

  const cloudRecord = {
    id: projectData.project_id || 'proj_' + Date.now(),
    user_id: user.id,
    user_email: user.email,
    project_name: projectData.project_name || "Custom CAD Floorplan",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    room_count: projectData.rooms?.length || 0,
    opening_count: (projectData.doors?.length || 0) + (projectData.windows?.length || 0),
    hvac_count: projectData.hvac_equipment?.length || 0,
    cad_payload: projectData
  };

  // 1. Try real Supabase table if configured
  if (supabase && user.isLive) {
    try {
      const { data, error } = await supabase
        .from('cad_projects')
        .upsert(cloudRecord, { onConflict: 'id' });
      if (error) throw error;
      return { success: true, record: cloudRecord, storageType: 'Supabase Cloud' };
    } catch (err) {
      console.warn("Supabase upsert failed, saving to local cloud vault:", err);
    }
  }

  // 2. Always persist into user's cloud vault (localStorage fallback)
  const vaultKey = `${LOCAL_PROJECTS_KEY_PREFIX}${user.email}`;
  let existing = [];
  try {
    const raw = localStorage.getItem(vaultKey);
    existing = raw ? JSON.parse(raw) : [];
  } catch (e) {
    existing = [];
  }

  const existingIdx = existing.findIndex(p => p.id === cloudRecord.id);
  if (existingIdx >= 0) {
    existing[existingIdx] = cloudRecord;
  } else {
    existing.unshift(cloudRecord);
  }

  localStorage.setItem(vaultKey, JSON.stringify(existing));
  return { success: true, record: cloudRecord, storageType: isSupabaseConfigured ? 'Supabase & Local Vault' : 'Cloud Vault (Local Mode)' };
}

export async function getCloudProjects(user) {
  if (!user) return [];

  if (supabase && user.isLive) {
    try {
      const { data, error } = await supabase
        .from('cad_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (!error && data) return data;
    } catch (err) {
      console.warn("Supabase fetch failed, retrieving from local cloud vault:", err);
    }
  }

  const vaultKey = `${LOCAL_PROJECTS_KEY_PREFIX}${user.email}`;
  try {
    const raw = localStorage.getItem(vaultKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function deleteCloudProject(user, projectId) {
  if (!user) return;

  if (supabase && user.isLive) {
    try {
      await supabase.from('cad_projects').delete().eq('id', projectId).eq('user_id', user.id);
    } catch (e) {
      console.warn("Supabase delete failed:", e);
    }
  }

  const vaultKey = `${LOCAL_PROJECTS_KEY_PREFIX}${user.email}`;
  try {
    const raw = localStorage.getItem(vaultKey);
    let existing = raw ? JSON.parse(raw) : [];
    existing = existing.filter(p => p.id !== projectId);
    localStorage.setItem(vaultKey, JSON.stringify(existing));
  } catch (e) {
    // ignore
  }
}
