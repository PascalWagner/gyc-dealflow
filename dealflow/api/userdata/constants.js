export const TABLE_MAP = {
  stages: 'user_deal_stages',
  portfolio: 'user_portfolio',
  goals: 'user_goals',
  taxdocs: 'user_tax_docs',
  plan: 'user_portfolio_plans'
};

export const MUTATION_TYPES = ['profile', 'autoRenew', 'notif_prefs', ...Object.keys(TABLE_MAP)];
export const READ_TYPES = ['notif_prefs', ...Object.keys(TABLE_MAP)];

export const FIELD_MAP = {
  stages: {
    'Deal ID': 'deal_id',
    'Stage': 'stage',
    'Notes': 'notes',
    'Skipped From Stage': 'skipped_from_stage'
  },
  portfolio: {
    'Deal ID': 'deal_id',
    'Investment Name': 'investment_name',
    'Sponsor': 'sponsor',
    'Asset Class': 'asset_class',
    'Amount Invested': 'amount_invested',
    'Date Invested': 'date_invested',
    'Status': 'status',
    'Target IRR': 'target_irr',
    'Distributions Received': 'distributions_received',
    'Hold Period': 'hold_period',
    'Investing Entity': 'investing_entity',
    'Entity Invested Into': 'entity_invested_into',
    'Notes': 'notes'
  },
  goals: {
    'Goal Type': 'goal_type',
    'Current Income': 'current_income',
    'Target Income': 'target_income',
    'Capital Available': 'capital_available',
    'Timeline': 'timeline',
    'Tax Reduction': 'tax_reduction'
  },
  taxdocs: {
    'Tax Year': 'tax_year',
    'Investment Name': 'investment_name',
    'Investing Entity': 'investing_entity',
    'Entity Invested Into': 'entity_invested_into',
    'Form Type': 'form_type',
    'Upload Status': 'upload_status',
    'Date Received': 'date_received',
    'File URL': 'file_url',
    'Portal URL': 'portal_url',
    'Contact': 'contact_name',
    'Contact Email': 'contact_email',
    'Contact Phone': 'contact_phone',
    'Notes': 'notes'
  }
};

export function mapFields(type, data) {
  const mapping = FIELD_MAP[type] || {};
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === '_recordId' || key === 'Email' || key === 'Updated At') continue;
    const column = mapping[key] || key;
    result[column] = value;
  }
  return result;
}
