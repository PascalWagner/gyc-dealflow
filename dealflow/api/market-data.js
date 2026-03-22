// Vercel Serverless Function: Market Intelligence Data
// Fetches population, income, and employment data from Census Bureau and BLS
// Returns: population time series, top industries, risk flags

import { setCors, getAdminClient } from './_supabase.js';

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

  // ── Cache check ──
  const cacheKey = zip || fips || '';
  const CACHE_MAX_AGE_DAYS = 30;
  const forceRefresh = req.query.refresh === '1';
  if (cacheKey && !forceRefresh) {
    try {
      const sb = getAdminClient();
      const { data: cached } = await sb
        .from('market_data_cache')
        .select('data, fetched_at')
        .eq('zip', cacheKey)
        .single();

      if (cached && cached.data) {
        const age = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60 * 24);
        if (age < CACHE_MAX_AGE_DAYS) {
          return res.status(200).json({ success: true, ...cached.data, _cached: true });
        }
      }
    } catch (e) {
      // Cache miss or error — proceed to fetch fresh
    }
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

    // ── 1a2. State & National Benchmarks ──
    try {
      const benchVars = 'B19013_001E,B01003_001E,NAME';
      const benchPromises = [];

      // State-level
      if (resolvedStateFips) {
        benchPromises.push(
          fetch(`${CENSUS_BASE}/2023/acs/acs5?get=${benchVars}&for=state:${resolvedStateFips}`)
            .then(r => r.ok ? r.json() : null).catch(() => null)
        );
      } else {
        benchPromises.push(Promise.resolve(null));
      }

      // National
      benchPromises.push(
        fetch(`${CENSUS_BASE}/2023/acs/acs5?get=B19013_001E,B01003_001E&for=us:1`)
          .then(r => r.ok ? r.json() : null).catch(() => null)
      );

      const [stateData, nationalData] = await Promise.all(benchPromises);

      results.benchmarks = {};
      if (stateData && stateData.length > 1) {
        const sh = stateData[0];
        const sv = stateData[1];
        results.benchmarks.state = {
          name: sv[sh.indexOf('NAME')] || '',
          medianIncome: parseInt(sv[sh.indexOf('B19013_001E')]) || null,
          population: parseInt(sv[sh.indexOf('B01003_001E')]) || null
        };
      }
      if (nationalData && nationalData.length > 1) {
        const nv = nationalData[1];
        results.benchmarks.national = {
          medianIncome: parseInt(nv[0]) || null,
          population: parseInt(nv[1]) || null
        };
      }
    } catch (e) {
      console.log('Benchmark fetch failed:', e.message);
    }

    // ── 1b. Age Distribution (Census ACS B01001) ──
    try {
      // B01001: Sex by Age — male (003-025), female (027-049)
      const maleVars = 'B01001_003E,B01001_004E,B01001_005E,B01001_006E,B01001_007E,B01001_008E,B01001_009E,B01001_010E,B01001_011E,B01001_012E,B01001_013E,B01001_014E,B01001_015E,B01001_016E,B01001_017E,B01001_018E,B01001_019E,B01001_020E,B01001_021E,B01001_022E,B01001_023E,B01001_024E,B01001_025E';
      const femaleVars = 'B01001_027E,B01001_028E,B01001_029E,B01001_030E,B01001_031E,B01001_032E,B01001_033E,B01001_034E,B01001_035E,B01001_036E,B01001_037E,B01001_038E,B01001_039E,B01001_040E,B01001_041E,B01001_042E,B01001_043E,B01001_044E,B01001_045E,B01001_046E,B01001_047E,B01001_048E,B01001_049E';

      let ageUrl;
      if (zip) {
        ageUrl = `${CENSUS_BASE}/2023/acs/acs5?get=${maleVars},${femaleVars}&for=zip%20code%20tabulation%20area:${zip}`;
      } else if (resolvedCountyFips) {
        const sf = resolvedCountyFips.substring(0, 2);
        const cf = resolvedCountyFips.substring(2, 5);
        ageUrl = `${CENSUS_BASE}/2023/acs/acs5?get=${maleVars},${femaleVars}&for=county:${cf}&in=state:${sf}`;
      }

      if (ageUrl) {
        const ageResp = await fetch(ageUrl);
        if (ageResp.ok) {
          const ageData = await ageResp.json();
          const vals = ageData[1].map(v => parseInt(v) || 0);

          // Raw Census age groups (23 male + 23 female):
          // Under5,5-9,10-14,15-17,18-19,20,21,22-24,25-29,30-34,35-39,40-44,45-49,50-54,55-59,60-61,62-64,65-66,67-69,70-74,75-79,80-84,85+
          // Consolidate into 5-year groups matching the pyramid chart
          const m = vals.slice(0, 23);
          const f = vals.slice(23, 46);

          const ageGroups = [
            { label: 'Under 5',       male: m[0],  female: f[0] },
            { label: '5 to 9',        male: m[1],  female: f[1] },
            { label: '10 to 14',      male: m[2],  female: f[2] },
            { label: '15 to 19',      male: m[3]+m[4], female: f[3]+f[4] },
            { label: '20 to 24',      male: m[5]+m[6]+m[7], female: f[5]+f[6]+f[7] },
            { label: '25 to 29',      male: m[8],  female: f[8] },
            { label: '30 to 34',      male: m[9],  female: f[9] },
            { label: '35 to 39',      male: m[10], female: f[10] },
            { label: '40 to 44',      male: m[11], female: f[11] },
            { label: '45 to 49',      male: m[12], female: f[12] },
            { label: '50 to 54',      male: m[13], female: f[13] },
            { label: '55 to 59',      male: m[14], female: f[14] },
            { label: '60 to 64',      male: m[15]+m[16], female: f[15]+f[16] },
            { label: '65 to 69',      male: m[17]+m[18], female: f[17]+f[18] },
            { label: '70 to 74',      male: m[19], female: f[19] },
            { label: '75 to 79',      male: m[20], female: f[20] },
            { label: '80 to 84',      male: m[21], female: f[21] },
            { label: '85 and over',   male: m[22], female: f[22] }
          ];

          results.ageDistribution = ageGroups;
        }
      }
    } catch (e) {
      console.log('Age distribution fetch failed:', e.message);
    }

    // ── 1c. Housing Data (Census ACS B25002 + B25041) — time series ──
    try {
      const housingYears = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
      const occVars = 'B25002_001E,B25002_002E,B25002_003E';
      const brVars = 'B25041_002E,B25041_003E,B25041_004E,B25041_005E,B25041_006E,B25041_007E';

      // Fetch occupancy time series in parallel
      const occPromises = housingYears.map(async (yr) => {
        try {
          let url;
          if (zip) {
            const stQ = (yr < 2020 && resolvedStateFips) ? `&in=state:${resolvedStateFips}` : '';
            url = `${CENSUS_BASE}/${yr}/acs/acs5?get=${occVars}&for=zip%20code%20tabulation%20area:${zip}${stQ}`;
          } else if (resolvedCountyFips) {
            const sf = resolvedCountyFips.substring(0, 2);
            const cf = resolvedCountyFips.substring(2, 5);
            url = `${CENSUS_BASE}/${yr}/acs/acs5?get=${occVars}&for=county:${cf}&in=state:${sf}`;
          }
          if (!url) return null;
          const r = await fetch(url);
          if (!r.ok) return null;
          const d = await r.json();
          if (d && d.length > 1) {
            const v = d[1].map(x => parseInt(x) || 0);
            return { year: yr, total: v[0], occupied: v[1], vacant: v[2] };
          }
        } catch (e) { return null; }
        return null;
      });

      const occResults = (await Promise.all(occPromises)).filter(r => r && r.total > 0).sort((a, b) => a.year - b.year);

      // Fetch bedroom data for latest year only
      let brUrl;
      if (zip) {
        brUrl = `${CENSUS_BASE}/2023/acs/acs5?get=${brVars}&for=zip%20code%20tabulation%20area:${zip}`;
      } else if (resolvedCountyFips) {
        const sf = resolvedCountyFips.substring(0, 2);
        const cf = resolvedCountyFips.substring(2, 5);
        brUrl = `${CENSUS_BASE}/2023/acs/acs5?get=${brVars}&for=county:${cf}&in=state:${sf}`;
      }

      let bedrooms = null;
      if (brUrl) {
        const brResp = await fetch(brUrl);
        if (brResp.ok) {
          const brData = await brResp.json();
          const bv = brData[1].map(x => parseInt(x) || 0);
          const brTotal = bv.reduce((a, b) => a + b, 0);
          if (brTotal > 0) {
            bedrooms = [
              { label: 'No bedroom', count: bv[0], pct: Math.round((bv[0] / brTotal) * 1000) / 10 },
              { label: '1 bedroom', count: bv[1], pct: Math.round((bv[1] / brTotal) * 1000) / 10 },
              { label: '2 bedrooms', count: bv[2], pct: Math.round((bv[2] / brTotal) * 1000) / 10 },
              { label: '3 bedrooms', count: bv[3], pct: Math.round((bv[3] / brTotal) * 1000) / 10 },
              { label: '4+ bedrooms', count: bv[4] + bv[5], pct: Math.round(((bv[4] + bv[5]) / brTotal) * 1000) / 10 }
            ];
          }
        }
      }

      if (occResults.length > 0) {
        const latest = occResults[occResults.length - 1];
        results.housing = {
          totalUnits: latest.total,
          occupied: latest.occupied,
          vacant: latest.vacant,
          vacancyRate: Math.round((latest.vacant / latest.total) * 1000) / 10,
          bedrooms,
          timeSeries: occResults.map(r => ({
            year: r.year,
            occupancyRate: Math.round((r.occupied / r.total) * 1000) / 10,
            vacancyRate: Math.round((r.vacant / r.total) * 1000) / 10,
            totalUnits: r.total,
            occupied: r.occupied,
            vacant: r.vacant
          }))
        };
      }
    } catch (e) {
      console.log('Housing data fetch failed:', e.message);
    }

    // ── 2. Employment Data (BLS QCEW via API) ──
    // Use County Employment data if we have FIPS
    let countyFips = resolvedCountyFips;

    if (countyFips && countyFips.length === 5) {
      try {
        const INDUSTRY_LABELS = {
          '1011': 'Natural Resources & Mining',
          '1012': 'Construction',
          '1013': 'Manufacturing',
          '1021': 'Trade, Transportation & Utilities',
          '1022': 'Information',
          '1023': 'Financial Activities',
          '1024': 'Professional & Business Services',
          '1025': 'Education & Health Services',
          '1026': 'Leisure & Hospitality',
          '1027': 'Other Services'
        };

        const currentYear = new Date().getFullYear();
        const qcewYears = [];
        for (let y = currentYear - 7; y <= currentYear - 2; y++) qcewYears.push(y);

        // Fetch all years in parallel
        function parseQcewCsv(csvText, year) {
          const lines = csvText.split('\n');
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          const emplIdx = headers.indexOf('annual_avg_emplvl');
          const wageIdx = headers.indexOf('avg_annual_pay');
          const indCodeIdx = headers.indexOf('industry_code');
          const ownCodeIdx = headers.indexOf('own_code');
          const sizeCodeIdx = headers.indexOf('size_code');
          const agglvlIdx = headers.indexOf('agglvl_code');
          const otyEmplPctIdx = headers.indexOf('oty_annual_avg_emplvl_pct_chg');

          const industries = {};
          let totalEmpl = null;

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
            if (!cols[indCodeIdx]) continue;
            const ownCode = cols[ownCodeIdx];
            const sizeCode = cols[sizeCodeIdx];
            const agglvl = cols[agglvlIdx];
            const indCode = cols[indCodeIdx];
            if (sizeCode !== '0') continue;

            if (indCode === '10' && ownCode === '0' && agglvl === '70') {
              totalEmpl = parseInt(cols[emplIdx]) || null;
              continue;
            }
            if (ownCode !== '5' || agglvl !== '73') continue;
            const label = INDUSTRY_LABELS[indCode];
            if (!label) continue;
            const empl = parseInt(cols[emplIdx]);
            if (!empl || empl < 50) continue;

            industries[indCode] = {
              industry: label,
              employment: empl,
              avgAnnualPay: parseInt(cols[wageIdx]) || null,
              yoyPct: parseFloat(cols[otyEmplPctIdx]) || null
            };
          }
          return { year, industries, totalEmpl };
        }

        const qcewPromises = qcewYears.map(async (yr) => {
          try {
            const resp = await fetch(`https://data.bls.gov/cew/data/api/${yr}/a/area/${countyFips}.csv`);
            if (!resp.ok) return null;
            return parseQcewCsv(await resp.text(), yr);
          } catch (e) { return null; }
        });

        const qcewResults = (await Promise.all(qcewPromises)).filter(r => r !== null).sort((a, b) => a.year - b.year);

        if (qcewResults.length > 0) {
          const latest = qcewResults[qcewResults.length - 1];
          const latestIndustries = Object.values(latest.industries).sort((a, b) => b.employment - a.employment);

          // Build time series per industry
          const topCodes = Object.keys(latest.industries).sort((a, b) => latest.industries[b].employment - latest.industries[a].employment).slice(0, 8);
          const industryTimeSeries = {};
          topCodes.forEach(code => {
            const label = INDUSTRY_LABELS[code];
            industryTimeSeries[label] = qcewResults.map(r => ({
              year: r.year,
              employment: r.industries[code] ? r.industries[code].employment : null
            }));
          });

          results.employment = {
            year: latest.year,
            topIndustries: latestIndustries.slice(0, 12),
            totalEmployment: latest.totalEmpl,
            timeSeries: industryTimeSeries,
            years: qcewResults.map(r => r.year)
          };
        }
      } catch (e) {
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

    // ── Store in cache ──
    if (cacheKey && results.population && results.population.length > 0) {
      try {
        const sb = getAdminClient();
        await sb.from('market_data_cache').upsert({
          zip: cacheKey,
          data: results,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'zip' });
      } catch (e) {
        console.log('Cache write failed:', e.message);
      }
    }

    return res.status(200).json({ success: true, ...results });

  } catch (error) {
    console.error('Market data error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
