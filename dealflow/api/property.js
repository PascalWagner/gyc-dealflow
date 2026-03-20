// Vercel Serverless Function: RentCast Property Data Proxy
// Looks up property details by address using RentCast API
// Returns: property details, tax history, sale history, owner info

const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY;
const RENTCAST_BASE = 'https://api.rentcast.io/v1';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address, city, state, zipCode, lat, lng, radius } = req.query;

  if (!address && !city && !lat) {
    return res.status(400).json({ success: false, error: 'Provide address, city+state, or lat+lng' });
  }

  try {
    // Build RentCast query
    const url = new URL(`${RENTCAST_BASE}/properties`);

    if (address) {
      url.searchParams.set('address', address);
    } else if (lat && lng) {
      url.searchParams.set('latitude', lat);
      url.searchParams.set('longitude', lng);
      url.searchParams.set('radius', radius || '5');
    } else if (city && state) {
      url.searchParams.set('city', city);
      url.searchParams.set('state', state);
    }

    // Filter for multi-family / commercial when doing area searches
    if (!address) {
      url.searchParams.set('limit', '20');
    } else {
      url.searchParams.set('limit', '1');
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': RENTCAST_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RentCast API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: 'RentCast API error',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();

    // Transform into our format
    const properties = (Array.isArray(data) ? data : [data]).map(p => ({
      id: p.id,
      address: p.formattedAddress,
      addressLine1: p.addressLine1,
      city: p.city,
      state: p.state,
      zipCode: p.zipCode,
      county: p.county,
      latitude: p.latitude,
      longitude: p.longitude,
      propertyType: p.propertyType,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      squareFootage: p.squareFootage,
      lotSize: p.lotSize,
      yearBuilt: p.yearBuilt,
      unitCount: p.unitCount,
      floorCount: p.floorCount,
      roofType: p.roofType,
      foundationType: p.foundationType,
      cooling: p.coolingType,
      heating: p.heatingType,
      pool: p.pool,
      garage: p.garage,
      garageSpaces: p.garageSpaces,
      ownerOccupied: p.ownerOccupied,
      // Owner info
      owner: p.owner ? {
        names: p.owner.names,
        type: p.owner.type,
        mailingAddress: p.owner.mailingAddress
      } : null,
      // Sale history
      lastSaleDate: p.lastSaleDate,
      lastSalePrice: p.lastSalePrice,
      // Tax assessments by year
      taxAssessments: p.taxAssessments || {},
      // Property taxes by year
      propertyTaxes: p.propertyTaxes || {},
      // Features
      zoning: p.zoning,
      subdivision: p.subdivision,
      assessorID: p.assessorID
    }));

    return res.status(200).json({
      success: true,
      count: properties.length,
      properties
    });

  } catch (error) {
    console.error('Property lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch property data',
      message: error.message
    });
  }
};
