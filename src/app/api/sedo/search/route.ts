import { NextRequest, NextResponse } from 'next/server';
import { searchDomainOnSedo, searchDomainsOnSedoMarketplace } from '../../../../lib/sedo-api';

// Define an interface for the domain object
interface SedoDomain {
  domain: string;
  forsale: number;
  price?: number;
  currency?: number;
  fixedprice?: number;
  [key: string]: any; // Allow other properties
}

interface SedoSearchParams {
  keyword: string;
}

interface SedoSearchResult {
  domain: string;
  forsale: number;
  price?: number;
  currency?: number;
  fixedprice?: number;
}

interface SedoSearchResponse {
  success: boolean;
  data?: SedoSearchResult[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json() as SedoSearchParams;
    
    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing or invalid keyword' 
      } as SedoSearchResponse, { status: 400 });
    }

    // Normalize the keyword for case-insensitive search
    const normalizedKeyword = keyword.toLowerCase().trim();
    console.log(`Searching for domains containing: ${normalizedKeyword}`);
    
    // Add cache-control header to prevent repeated identical requests
    const headers = new Headers();
    headers.append('Cache-Control', 'private, max-age=30'); // Cache for 30 seconds
    
    try {
      // Search two sources:
      // 1. Search the Sedo marketplace using the DomainSearch API
      console.log(`Searching Sedo marketplace for: "${normalizedKeyword}"`);
      const marketplaceResults = await searchDomainsOnSedoMarketplace(normalizedKeyword, {
        email: process.env.SEDO_USERNAME || 'Kareer',
        password: process.env.SEDO_PASSWORD || 'defaultpassword'
      });
      
      // 2. Search the user's owned & listed domains
      console.log(`Searching user's own domains for: "${normalizedKeyword}"`);
      const userDomainsResults = await searchDomainOnSedo(normalizedKeyword, {
        email: process.env.SEDO_USERNAME || 'Kareer',
        password: process.env.SEDO_PASSWORD || 'defaultpassword'
      });
      
      // Combine both result sets, avoiding duplicates
      const combinedDomains: SedoSearchResult[] = [];
      
      // Add user's own domains first (usually more important)
      if (userDomainsResults.success && userDomainsResults.data && Array.isArray(userDomainsResults.data)) {
        console.log(`Found ${userDomainsResults.data.length} user domains that match`);
        combinedDomains.push(...userDomainsResults.data);
      }
      
      // Add marketplace domains, avoiding duplicates
      if (marketplaceResults.success && marketplaceResults.data && Array.isArray(marketplaceResults.data)) {
        console.log(`Found ${marketplaceResults.data.length} marketplace domains that match`);
        marketplaceResults.data.forEach(domain => {
          if (!combinedDomains.some(d => d.domain === domain.domain)) {
            combinedDomains.push(domain);
          }
        });
      }
      
      console.log(`Returning ${combinedDomains.length} total domains (user domains + marketplace listings)`);
      console.log(`Domain list: ${combinedDomains.map(d => d.domain).join(', ') || 'none'}`);
      
      return NextResponse.json({
        success: true,
        data: combinedDomains
      } as SedoSearchResponse, { headers });
      
    } catch (searchError) {
      console.error('Error in domain search:', searchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Search processing error',
        data: [] 
      } as SedoSearchResponse, { status: 500, headers });
    }
  } catch (parseError) {
    console.error('Error processing search request:', parseError);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process search request',
      data: [] 
    } as SedoSearchResponse, { status: 400 });
  }
} 