// Vercel Serverless Function: Market Intelligence Data
// Fetches population, income, and employment data from Census Bureau and BLS
// Returns: population time series, top industries, risk flags

import { setCors } from './_supabase.js';

// Census ACS 5-Year API (free, no key required for small volume)
const CENSUS_BASE = 'https://api.census.gov/data';

// BLS Public Data API (no key required for v1)
const BLS_BASE = 'https://api.bls.gov/publicAPI/v1/timeseries/data';

// FIPS code lookup for state abbreviations
const STATE_FIPS = {
  AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',FL:'12',GA:'13',
  HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',
  MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',
  NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',
  SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56',
  DC:'11',PR:'72'
};

// NAICS supersector codes for BLS QCEW
const NAICS_LABELS = {
  '10': 'Total',
  '1011': 'Natural Resources & Mining',
  '1012': 'Construction',
  '1013': 'Manufacturing',
  '1021': 'Trade, Transportation & Utilities',
  '1022': 'Information',
  '1023': 'Financial Activities',
  '1024': 'Professional & Business Services',
  '1025': 'Education & Health Services',
  '1026': 'Leisure & Hospitality',
  '1027': 'Other Services',
  '1028': 'Government'
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { zip, state, county, fips, stateAbbr, lat, lng } = req.query;

  if (!zip && !fips && !(state && county)) {
    return res.status(400).json({ success: false, error: 'Provide zip, fips (state+county FIPS), or state+county name' });
  }

  // Resolve state FIPS for ZCTA queries (needed for pre-2020 Census API)
  let resolvedStateFips = stateAbbr ? STATE_FIPS[stateAbbr.toUpperCase()] : (fips ? fips.substring(0, 2) : null);

  // Resolve county FIPS from lat/lng using FCC Census Area API
  let resolvedCountyFips = fips || null;
  let resolvedCountyName = null;
  if (!resolvedCountyFips && lat && lng) {
    try {
      const fccResp = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&format=json`);
      if (fccResp.ok) {
        const fccData = await fccResp.json();
        if (fccData.results && fccData.results.length > 0) {
          resolvedCountyFips = fccData.results[0].county_fips;
          resolvedCountyName = fccData.results[0].county_name || null;
          if (!resolvedStateFips && resolvedCountyFips) {
            resolvedStateFips = resolvedCountyFips.substring(0, 2);
          }
        }
      }
    } catch (e) {
      console.log('FCC geocode failed:', e.message);
    }
  }

  try {
    const results = {};

    // ── 1. Population Time Series (Census ACS 5-Year) ──
    // ACS 5-year data available from 2009-2023 (as of 2025)
    const years = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

    // Variables: B01003_001E = Total Population, B19013_001E = Median Household Income
    const censusVars = 'B01003_001E,B19013_001E,NAME';

    // Fetch all years in parallel for speed
    const yearPromises = years.map(async (year) => {
      try {
        let url;
        if (zip) {
          // Pre-2020 ACS requires state qualifier for ZCTA lookups
          const stateQ = (year < 2020 && resolvedStateFips) ? `&in=state:${resolvedStateFips}` : '';
          url = `${CENSUS_BASE}/${year}/acs/acs5?get=${censusVars}&for=zip%20code%20tabulation%20area:${zip}${stateQ}`;
        } else if (fips) {
          const stateFips = fips.substring(0, 2);
          const countyFips = fips.substring(2, 5);
          url = `${CENSUS_BASE}/${year}/acs/acs5?get=${censusVars}&for=county:${countyFips}&in=state:${stateFips}`;
        } else if (state && county) {
          const stateFips = STATE_FIPS[state.toUpperCase()];
          if (!stateFips) return null;
          url = `${CENSUS_BASE}/${year}/acs/acs5?get=${censusVars}&for=county:*&in=state:${stateFips}`;
        }

        const resp = await fetch(url);
        if (!resp.ok) return null;
        const data = await resp.json();

        if (data && data.length > 1) {
          const headers = data[0];
          const popIdx = headers.indexOf('B01003_001E');
          const incIdx = headers.indexOf('B19013_001E');
          const nameIdx = headers.indexOf('NAME');

          let row = data[1];
          if (state && county && data.length > 2) {
            const countyNorm = county.toLowerCase().replace(/\s+county$/i, '');
            row = data.slice(1).find(r => {
              const name = (r[nameIdx] || '').toLowerCase();
              return name.includes(countyNorm);
            }) || data[1];
          }

          return {
            year,
            population: parseInt(row[popIdx]) || null,
            medianIncome: parseInt(row[incIdx]) || null,
            name: row[nameIdx] || ''
          };
        }
      } catch (e) {
        return null;
      }
      return null;
    });

    const yearResults = await Promise.all(yearPromises);
    const popData = yearResults.filter(r => r !== null).sort((a, b) => a.year - b.year);

    results.population = popData;

    // Calculate population trend
    if (popData.length >= 2) {
      const first = popData.find(d => d.population > 0);
      const last = [...popData].reverse().find(d => d.population > 0);
      if (first && last && first !== last) {
        const change = last.population - first.population;
        const pctChange = (change / first.population) * 100;
        const yearsSpan = last.year - first.year;
        const annualGrowth = pctChange / yearsSpan;

        // Check for declining trend (last 3 years)
        const recent = popData.slice(-3).filter(d => d.population > 0);
        let declining = false;
        if (recent.length >= 2) {
          declining = recent[recent.length - 1].population < recent[0].population;
        }

        results.populationTrend = {
          totalChange: change,
          pctChange: Math.round(pctChange * 10) / 10,
          annualGrowth: Math.round(annualGrowth * 10) / 10,
          declining,
          startYear: first.year,
          endYear: last.year
        };
      }
    }

    // ── 2. Employment Data (BLS QCEW via API) ──
    // Use County Employment data if we have FIPS
    let countyFips = resolvedCountyFips;

    if (countyFips && countyFips.length === 5) {
      try {
        // BLS QCEW data via CSV endpoint
        const currentYear = new Date().getFullYear();
        const qcewYear = currentYear - 2; // Annual data lags ~18 months

        const qcewUrl = `https://data.bls.gov/cew/data/api/${qcewYear}/a/area/${countyFips}.csv`;
        const qcewResp = await fetch(qcewUrl);

        if (qcewResp.ok) {
          const csvText = await qcewResp.text();
          const lines = csvText.split('\n');
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

          // Supersector industry code → label mapping
          const INDUSTRY_LABELS = {
            '10': 'All Industries',
            '101': 'Goods-Producing',
            '1011': 'Natural Resources & Mining',
            '1012': 'Construction',
            '1013': 'Manufacturing',
            '102': 'Service-Providing',
            '1021': 'Trade, Transportation & Utilities',
            '1022': 'Information',
            '1023': 'Financial Activities',
            '1024': 'Professional & Business Services',
            '1025': 'Education & Health Services',
            '1026': 'Leisure & Hospitality',
            '1027': 'Other Services',
            '1028': 'Government'
          };

          const industries = [];
          const emplIdx = headers.indexOf('annual_avg_emplvl');
          const wageIdx = headers.indexOf('avg_annual_pay');
          const indCodeIdx = headers.indexOf('industry_code');
          const ownCodeIdx = headers.indexOf('own_code');
          const sizeCodeIdx = headers.indexOf('size_code');
          const agglvlIdx = headers.indexOf('agglvl_code');
          var totalEmpl = null;

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
            if (!cols[indCodeIdx]) continue;

            const ownCode = cols[ownCodeIdx];
            const sizeCode = cols[sizeCodeIdx];
            const agglvl = cols[agglvlIdx];
            const indCode = cols[indCodeIdx];

            // size_code=0 means all sizes, own_code=0 is all ownership, 5 is private
            if (sizeCode !== '0') continue;

            // Capture total employment (all ownership, all industries, county total)
            if (indCode === '10' && ownCode === '0' && agglvl === '70') {
              totalEmpl = parseInt(cols[emplIdx]) || null;
              continue;
            }

            // Get supersector level (agglvl=73) for private sector (own_code=5)
            if (ownCode !== '5' || agglvl !== '73') continue;

            const label = INDUSTRY_LABELS[indCode];
            if (!label) continue;

            const empl = parseInt(cols[emplIdx]);
            const wage = parseInt(cols[wageIdx]);
            if (!empl || empl < 50) continue;

            industries.push({
              industry: label,
              employment: empl,
              avgAnnualPay: wage || null
            });
          }

          industries.sort((a, b) => b.employment - a.employment);
          results.employment = {
            year: qcewYear,
            topIndustries: industries.slice(0, 12),
            totalEmployment: totalEmpl,
            countyName: null // Will be enriched from FCC data
          };
        }
      } catch (e) {
        // Employment data not critical
        console.log('BLS QCEW fetch failed:', e.message);
      }
    }

    // ── 3. Risk Flags ──
    const risks = [];
    if (results.populationTrend) {
      if (results.populationTrend.declining) {
        risks.push({
          type: 'population_decline',
          severity: 'warning',
          message: 'Population has declined in recent years',
          detail: `${results.populationTrend.pctChange > 0 ? '+' : ''}${results.populationTrend.pctChange}% over ${results.populationTrend.endYear - results.populationTrend.startYear} years`
        });
      }
      if (results.populationTrend.annualGrowth < -1) {
        risks.push({
          type: 'rapid_population_decline',
          severity: 'danger',
          message: 'Rapid population decline detected',
          detail: `${results.populationTrend.annualGrowth}% per year`
        });
      }
    }

    // Income stagnation check
    if (popData.length >= 3) {
      const recentIncome = popData.slice(-3).filter(d => d.medianIncome > 0);
      if (recentIncome.length >= 2) {
        const incomeChange = ((recentIncome[recentIncome.length - 1].medianIncome - recentIncome[0].medianIncome) / recentIncome[0].medianIncome) * 100;
        if (incomeChange < 0) {
          risks.push({
            type: 'income_decline',
            severity: 'warning',
            message: 'Median household income is declining',
            detail: `${Math.round(incomeChange * 10) / 10}% change`
          });
        }
      }
    }

    results.risks = risks;

    // Include query params for deep-linking
    results.query = { zip: zip || null, fips: resolvedCountyFips || null, stateAbbr: stateAbbr || null, countyName: resolvedCountyName };

    return res.status(200).json({ success: true, ...results });

  } catch (error) {
    console.error('Market data error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
