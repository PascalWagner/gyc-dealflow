export const CURRENT_GP_AGREEMENT_VERSION = '1.1';

export async function getLatestGpAgreement(supabase, userId) {
  const { data, error } = await supabase
    .from('gp_agreements')
    .select('id, agreement_version, offering_type, accepted_at, signatory_name, signatory_email, signatory_title, accepted_tos, accepted_listing, accepted_data_accuracy, accepted_recording, accepted_data_processing, agreement_pdf_url')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function hasCurrentGpAgreement(agreement) {
  return Boolean(
    agreement
      && agreement.agreement_version === CURRENT_GP_AGREEMENT_VERSION
      && agreement.accepted_tos === true
      && agreement.accepted_listing === true
      && agreement.accepted_data_accuracy === true
      && agreement.accepted_recording === true
      && agreement.accepted_data_processing === true
  );
}
