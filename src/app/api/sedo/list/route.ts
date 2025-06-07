import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { listDomainOnSedo } from '../../../../lib/sedo-api';

// Response interface for consistent typing
interface ListingResponse {
  success: boolean;
  message?: string;
  error?: string;
  nameservers?: string;
  domain?: string;
}

export async function POST(request: Request) {
  try {
    const { domain } = await request.json();
    
    if (!domain) {
      return NextResponse.json({ 
        success: false, 
        error: 'Domain is required' 
      } as ListingResponse, { status: 400 });
    }

    // Normalize domain to lowercase for consistent handling
    const normalizedDomain = domain.toLowerCase();
    console.log(`Processing Sedo listing request for: ${normalizedDomain}`);

    // Get Sedo credentials from environment variables
    const sedoUsername = process.env.SEDO_USERNAME;
    const sedoPassword = process.env.SEDO_PASSWORD;

    if (!sedoUsername || !sedoPassword) {
      console.log('Using simulated Sedo listing as credentials are not set');
      
      // For development without actual Sedo credentials
      // Return a success response to simulate API behavior
      
      // Update domain status in database
      const { error } = await supabase
        .from('domains')
        .update({ 
          sedo_listed: true,
          nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com' 
        })
        .eq('domain', normalizedDomain);
        
      if (error) {
        console.error('Database update error:', error);
        return NextResponse.json({ 
          success: false,
          error: 'Domain simulated listing succeeded but failed to update database'
        } as ListingResponse, { status: 500 });
      }
      
      console.log(`Simulation successful for ${normalizedDomain}. Nameservers set to ns1.sedoparking.com, ns2.sedoparking.com`);
      
      return NextResponse.json({ 
        success: true,
        message: `Domain "${normalizedDomain}" successfully listed on Sedo! (simulated)`,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com',
        domain: normalizedDomain
      } as ListingResponse);
    }
    
    console.log(`Calling Sedo API to list domain: ${normalizedDomain}`);
    
    // Call the Sedo API integration function
    const result = await listDomainOnSedo(normalizedDomain, {
      email: sedoUsername, // Actually username
      password: sedoPassword,
    });
    
    console.log(`Sedo API result for ${normalizedDomain}:`, result);
    
    if (result.success) {
      // Update domain status in database
      const { error } = await supabase
        .from('domains')
        .update({ 
          sedo_listed: true,
          nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com'
        })
        .eq('domain', normalizedDomain);
        
      if (error) {
        console.error(`Database update error for ${normalizedDomain}:`, error);
        return NextResponse.json({ 
          success: false,
          error: 'Domain listed on Sedo but failed to update database'
        } as ListingResponse, { status: 500 });
      }
      
      console.log(`Successfully listed ${normalizedDomain} on Sedo and updated database`);
      
      return NextResponse.json({ 
        success: true,
        message: `Domain "${normalizedDomain}" successfully listed on Sedo!`,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com',
        domain: normalizedDomain
      } as ListingResponse);
    } else {
      console.error(`Sedo API listing failed for ${normalizedDomain}:`, result.message);
      return NextResponse.json({ 
        success: false,
        error: result.message || 'Failed to list domain on Sedo' 
      } as ListingResponse, { status: 500 });
    }
  } catch (error) {
    console.error('Error in Sedo API listing:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    } as ListingResponse, { status: 500 });
  }
} 