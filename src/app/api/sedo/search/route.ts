import { NextResponse } from 'next/server';
import { searchDomainOnSedo } from '@/lib/sedo-api';

// Define an interface for the domain object
interface SedoDomain {
  domain: string;
  forsale: number;
  price?: number;
  currency?: number;
  fixedprice?: number;
  [key: string]: any; // Allow other properties
}

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json();
    
    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    // Get Sedo credentials from environment variables
    const sedoUsername = process.env.SEDO_USERNAME;
    const sedoPassword = process.env.SEDO_PASSWORD;

    if (!sedoUsername || !sedoPassword) {
      console.warn('Using API without proper Sedo credentials - will use simulated domains');
    }
    
    // Call the Sedo API to get ONLY the user's registered domains and filter them by keyword
    const result = await searchDomainOnSedo(keyword, {
      email: sedoUsername || '',
      password: sedoPassword || '',
    });
    
    if (result.success) {
      // In production, this would only return domains that are actually in the user's account
      // In development with simulation, we're ensuring we only return the 4 test domains
      
      return NextResponse.json({ 
        success: true,
        message: result.message,
        data: result.data,
        listed: result.listed,
        fromFallback: result.message && result.message.includes('(simulated)')
      });
    } else {
      return NextResponse.json({ 
        success: false,
        error: result.message,
        listed: false
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in Sedo API search:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      listed: false
    }, { status: 500 });
  }
} 