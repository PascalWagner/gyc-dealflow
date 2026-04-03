import { getAdminClient } from './_supabase.js';

function hasOwn(object, key) {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
}

export async function loadUserProfileRecord(db, userId) {
  if (!userId) return null;

  const { data, error } = await db
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function pickSupportedProfileFields(fields = {}, profileRecord = null) {
  if (!profileRecord || typeof profileRecord !== 'object') return {};

  return Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => value !== undefined && hasOwn(profileRecord, key))
  );
}

export async function persistUserAvatarUrl({
  userId,
  avatarUrl,
  admin = getAdminClient(),
  profileRecord = null
} = {}) {
  if (!userId || !avatarUrl) {
    return {
      profileRecord,
      profilePersisted: false,
      metadataPersisted: false
    };
  }

  let nextProfileRecord = profileRecord;
  if (nextProfileRecord === null) {
    nextProfileRecord = await loadUserProfileRecord(admin, userId);
  }

  let profilePersisted = false;
  if (hasOwn(nextProfileRecord, 'avatar_url')) {
    const { data: updatedProfile, error: profileError } = await admin
      .from('user_profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (profileError) throw profileError;
    nextProfileRecord = updatedProfile || { ...(nextProfileRecord || {}), avatar_url: avatarUrl };
    profilePersisted = true;
  }

  try {
    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(userId);
    if (authUserError) throw authUserError;

    const nextMetadata = {
      ...(authUserData?.user?.user_metadata || {}),
      avatar_url: avatarUrl
    };
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: nextMetadata
    });
    if (metadataError) throw metadataError;

    return {
      profileRecord: nextProfileRecord,
      profilePersisted,
      metadataPersisted: true
    };
  } catch (error) {
    if (!profilePersisted) throw error;
    console.warn('[user-profile] avatar metadata fallback failed:', error?.message || error);
    return {
      profileRecord: nextProfileRecord,
      profilePersisted,
      metadataPersisted: false
    };
  }
}
