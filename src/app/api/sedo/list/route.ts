import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { listDomainOnSedo } from '@/lib/sedo-api';

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

    // Get Sedo credentials from environment variables
    const sedoUsername = process.env.SEDO_USERNAME;
    const sedoPassword = process.env.SEDO_PASSWORD;

    if (!sedoUsername || !sedoPassword) {
      console.log('Using simulated Sedo listing as credentials are not set');
      
      // Return a success response even without API credentials
      // This helps with development/testing
      
      // Update domain status in database
      const { error } = await supabase
        .from('domains')
        .update({ sedo_listed: true })
        .eq('domain', domain);
        
      if (error) {
        console.error('Database update error:', error);
        return NextResponse.json({ 
          success: false,
          error: 'Domain simulated listing succeeded but failed to update database'
        } as ListingResponse, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true,
        message: `Domain "${domain}" successfully listed on Sedo! (simulated)`,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com',
        domain
      } as ListingResponse);
    }
    
    // Call the Sedo API integration function
    const result = await listDomainOnSedo(domain, {
      email: sedoUsername, // Actually username
      password: sedoPassword,
    });
    
    if (result.success) {
      // Update domain status in database
      const { error } = await supabase
        .from('domains')
        .update({ sedo_listed: true })
        .eq('domain', domain);
        
      if (error) {
        return NextResponse.json({ 
          success: false,
          error: 'Domain listed on Sedo but failed to update database'
        } as ListingResponse, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true,
        message: `Domain "${domain}" successfully listed on Sedo!`,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com',
        domain
      } as ListingResponse);
    } else {
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