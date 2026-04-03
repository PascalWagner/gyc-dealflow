export const CURRENT_USER_AGREEMENT_VERSION = '1.0';

export async function getLatestUserAgreement(supabase, userId) {
  const { data, error } = await supabase
    .from('user_agreements')
    .select('id, agreement_version, accepted_tos, accepted_privacy, accepted_disclaimer, accepted_at, ip_address, user_agent, agreement_text_hash')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function hasCurrentUserAgreement(agreement) {
  return Boolean(
    agreement
      && agreement.agreement_version === CURRENT_USER_AGREEMENT_VERSION
      && agreement.accepted_tos === true
      && agreement.accepted_privacy === true
      && agreement.accepted_disclaimer === true
  );
}
