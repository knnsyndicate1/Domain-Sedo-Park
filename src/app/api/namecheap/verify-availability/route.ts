import { NextRequest, NextResponse } from 'next/server'

interface VerifyResponse {
  available: boolean;
  message?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const { domain } = await req.json();

  if (!domain || typeof domain !== 'string') {
    return NextResponse.json({ 
      available: false, 
      error: 'Invalid domain input' 
    } as VerifyResponse, { status: 400 });
  }

  // Normalize the domain
  const normalizedDomain = domain.toLowerCase().trim();
  
  const apiUser = process.env.NAMECHEAP_USERNAME;
  const apiKey = process.env.NAMECHEAP_API_KEY;
  
  // Get client IP from request or use configured IP
  const configuredIp = process.env.NAMECHEAP_CLIENT_IP;
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = configuredIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1');

  console.log(`=== VERIFYING DOMAIN AVAILABILITY ===`);
  console.log(`Checking domain: ${normalizedDomain}`);
  console.log(`Using IP for Namecheap API: ${clientIp}`);

  if (!apiUser || !apiKey) {
    return NextResponse.json({ 
      available: false, 
      error: 'Namecheap API credentials missing' 
    } as VerifyResponse, { status: 500 });
  }

  try {
    // Use more robust approach with both methods
    const results = await Promise.allSettled([
      // Method 1: Direct domain check
      checkDomainDirect(normalizedDomain, apiUser, apiKey, clientIp),
      
      // Method 2: Price-based check (if price check returns with no error, domain is available)
      checkDomainViaPrice(normalizedDomain, apiUser, apiKey, clientIp)
    ]);
    
    console.log(`Verification results: ${results.map(r => r.status).join(', ')}`);
    
    // If either method definitively says domain is NOT available, trust that result
    const directCheck = results[0].status === 'fulfilled' ? results[0].value : null;
    const priceCheck = results[1].status === 'fulfilled' ? results[1].value : null;
    
    // Log detailed results
    if (directCheck) {
      console.log(`Direct check result: ${directCheck.available ? 'Available' : 'Not available'}`);
    }
    if (priceCheck) {
      console.log(`Price check result: ${priceCheck.available ? 'Available' : 'Not available'}`);
    }
    
    // Determine final availability - if either says it's not available, consider it not available
    const isDefinitelyUnavailable = 
      (directCheck && !directCheck.available) || 
      (priceCheck && !priceCheck.available);
    
    // Only consider available if at least one check explicitly confirms availability
    const isConfirmedAvailable = 
      (directCheck && directCheck.available) || 
      (priceCheck && priceCheck.available);
    
    if (isDefinitelyUnavailable) {
      return NextResponse.json({
        available: false,
        message: 'Domain is already registered'
      } as VerifyResponse);
    } else if (isConfirmedAvailable) {
      return NextResponse.json({
        available: true,
        message: 'Domain is available'
      } as VerifyResponse);
    } else {
      // If we can't determine availability with confidence, assume it's not available
      // This is safer to prevent duplicate registrations
      return NextResponse.json({
        available: false,
        message: 'Domain availability could not be confirmed - assuming unavailable for safety'
      } as VerifyResponse);
    }
  } catch (error) {
    console.error('Error verifying domain availability:', error);
    return NextResponse.json({ 
      available: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    } as VerifyResponse, { status: 500 });
  }
}

// Helper function for direct domain availability check
async function checkDomainDirect(domain: string, apiUser: string, apiKey: string, clientIp: string): Promise<{available: boolean, error?: string}> {
  try {
    // Direct check using Namecheap API
    const checkUrl = `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&ClientIp=${clientIp}&Command=namecheap.domains.check&DomainList=${domain}`;
    
    console.log(`Sending direct verification request to Namecheap...`);
    
    // Set timeout for API request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('Request timeout'), 15000);
    
    const checkRes = await fetch(checkUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!checkRes.ok) {
      console.error(`Namecheap API returned status ${checkRes.status}`);
      return { available: false, error: `API returned status ${checkRes.status}` };
    }
    
    const checkXml = await checkRes.text();
    console.log(`Received direct check response from Namecheap (${checkXml.length} chars)`);
    
    // Parse the response to determine availability
    let isAvailable = false;
    
    // Check for the domain availability flag
    const availableMatch = checkXml.match(/Available="(true|false)"/i);
    if (availableMatch) {
      isAvailable = availableMatch[1].toLowerCase() === 'true';
      console.log(`Domain availability from direct XML: ${isAvailable ? 'Available' : 'Not available'}`);
      return { available: isAvailable };
    } else {
      console.log('Could not determine availability from direct XML');
      
      // Fallback check - look for error messages
      const errorMatch = checkXml.match(/<Error[^>]*>(.*?)<\/Error>/i);
      if (errorMatch) {
        console.error(`Direct API Error: ${errorMatch[1]}`);
        return { available: false, error: errorMatch[1] };
      }
      
      // If we get here, we couldn't determine availability
      return { available: false, error: 'Could not determine availability from response' };
    }
  } catch (error) {
    console.error('Error in direct domain check:', error);
    return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function for price-based availability check
async function checkDomainViaPrice(domain: string, apiUser: string, apiKey: string, clientIp: string): Promise<{available: boolean, price?: number, error?: string}> {
  try {
    // Get pricing info, which also contains availability
    const priceUrl = `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&ClientIp=${clientIp}&Command=namecheap.domains.getpricing&ProductName=DOMAIN&ProductType=REGISTER&ActionName=REGISTER&ProductCategory=DOMAINS`;
    
    console.log(`Sending price-based verification request to Namecheap...`);
    
    // Set timeout for API request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('Request timeout'), 15000);
    
    const priceRes = await fetch(priceUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!priceRes.ok) {
      console.error(`Namecheap price API returned status ${priceRes.status}`);
      return { available: false, error: `Price API returned status ${priceRes.status}` };
    }
    
    const priceXml = await priceRes.text();
    console.log(`Received price check response from Namecheap (${priceXml.length} chars)`);
    
    // For price check, we're checking if the domain exists in the TLD data
    // Extract the domain parts
    const domainParts = domain.split('.');
    if (domainParts.length < 2) {
      return { available: false, error: 'Invalid domain format' };
    }
    
    const tld = `.${domainParts[domainParts.length - 1]}`;
    
    // Check if the TLD exists in the pricing data
    const tldMatch = priceXml.includes(`<TLD>${tld}</TLD>`);
    if (!tldMatch) {
      console.log(`TLD ${tld} not found in pricing data`);
      return { available: false, error: `TLD ${tld} not supported` };
    }
    
    // If the TLD is supported, we use a separate API to check availability
    const checkUrl = `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&ClientIp=${clientIp}&Command=namecheap.domains.check&DomainList=${domain}`;
    
    const secondController = new AbortController();
    const secondTimeoutId = setTimeout(() => secondController.abort('Request timeout'), 15000);
    
    const secondCheckRes = await fetch(checkUrl, { signal: secondController.signal });
    clearTimeout(secondTimeoutId);
    
    if (!secondCheckRes.ok) {
      return { available: false, error: `Secondary check failed with status ${secondCheckRes.status}` };
    }
    
    const secondCheckXml = await secondCheckRes.text();
    
    // Check for availability from response
    const availableMatch = secondCheckXml.match(/Available="(true|false)"/i);
    if (availableMatch) {
      const isAvailable = availableMatch[1].toLowerCase() === 'true';
      console.log(`Domain availability from price check: ${isAvailable ? 'Available' : 'Not available'}`);
      return { available: isAvailable };
    }
    
    return { available: false, error: 'Could not determine availability from price check' };
  } catch (error) {
    console.error('Error in price-based domain check:', error);
    return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
} 