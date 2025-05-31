import { NextRequest, NextResponse } from 'next/server'
import { PriceCheckResponse } from '@/lib/types'

// Helper function for fetch with retry
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3) {
  let retryCount = 0;
  let lastError: Error | null = null;

  // Add default timeout if not specified
  if (!options.signal) {
    options.signal = AbortSignal.timeout(30000); // 30 seconds timeout
  }

  while (retryCount < maxRetries) {
    try {
      console.log(`Attempt ${retryCount + 1} of ${maxRetries}`);
      return await fetch(url, options);
    } catch (err: any) {
      lastError = err;
      console.error(`Fetch attempt ${retryCount + 1} failed:`, err);
      
      // Don't retry on user cancel
      if (err.name === 'AbortError' && err.message?.includes('user')) {
        throw err;
      }
      
      retryCount++;
      if (retryCount >= maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * (2 ** retryCount) + Math.random() * 1000, 8000);
      console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Failed after multiple retry attempts');
}

// Simplified function to extract price
function extractOneYearPrice(xml: string, tld: string): number | null {
  try {
    console.log(`Attempting to extract price for TLD: ${tld}`)
    
    // First check if the tld product exists in the XML
    const productMatch = xml.includes(`<Product Name="${tld}">`) || xml.includes(`<Product Name=`)
    if (!productMatch) {
      console.log(`Product block for ${tld} not found in XML`)
      return null
    }

    // Try several patterns to find the price - in order of specificity
    
    // Pattern 1: Look specifically for Duration="1" and DurationType="YEAR" with a Price attribute
    const pricePattern1 = new RegExp(`<Price[^>]*Duration="1"[^>]*DurationType="YEAR"[^>]*Price="([\\d\\.]+)"`, 'i')
    const match1 = xml.match(pricePattern1)
    if (match1 && match1[1] && parseFloat(match1[1]) > 0) {
      console.log(`Found price using pattern 1: ${match1[1]} for ${tld}`)
      return parseFloat(match1[1])
    }
    
    // Pattern 2: Look for any Price attribute in a Price tag
    const pricePattern2 = /<Price[^>]*Price="([\d\.]+)"[^>]*>/i
    const match2 = xml.match(pricePattern2)
    if (match2 && match2[1] && parseFloat(match2[1]) > 0) {
      console.log(`Found price using pattern 2: ${match2[1]} for ${tld}`)
      return parseFloat(match2[1])
    }
    
    // Pattern 3: Look for <Price> tag
    const pricePattern3 = /<Price>([\d\.]+)<\/Price>/i
    const match3 = xml.match(pricePattern3)
    if (match3 && match3[1] && parseFloat(match3[1]) > 0) {
      console.log(`Found price using pattern 3: ${match3[1]} for ${tld}`)
      return parseFloat(match3[1])
    }

    // Pattern 4: Direct price attribute extraction
    const pricePattern4 = /Price="([\d\.]+)"/i
    const match4 = xml.match(pricePattern4)
    if (match4 && match4[1] && parseFloat(match4[1]) > 0) {
      console.log(`Found price using pattern 4: ${match4[1]} for ${tld}`)
      return parseFloat(match4[1])
    }
    
    console.log(`Price not found for ${tld} using any pattern`)
    return null
  } catch (err) {
    console.error('Error extracting price:', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  const { domain } = await req.json()

  // Input validation
  if (!domain || typeof domain !== 'string') {
    return NextResponse.json({ 
      price: null, 
      available: false,
      error: 'Invalid domain input' 
    } as PriceCheckResponse, { status: 400 })
  }

  // Check if domain format is valid
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/
  if (!domainRegex.test(domain)) {
    return NextResponse.json({ 
      price: null, 
      available: false,
      error: 'Invalid domain format' 
    } as PriceCheckResponse, { status: 400 })
  }

  const apiUser = process.env.NAMECHEAP_USERNAME
  const apiKey = process.env.NAMECHEAP_API_KEY
  
  // Get client IP from request or use configured IP
  const configuredIp = process.env.NAMECHEAP_CLIENT_IP
  const forwardedFor = req.headers.get('x-forwarded-for')
  const clientIp = configuredIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1')

  console.log(`=== NAMECHEAP API DEBUGGING ===`)
  console.log(`Checking domain: ${domain}`)
  console.log(`API Username: ${apiUser ? 'Set' : 'NOT SET'}`)
  console.log(`API Key: ${apiKey ? 'Set' : 'NOT SET'}`)
  console.log(`Using IP for Namecheap API: ${clientIp}`)
  console.log(`Configured IP in .env: ${configuredIp || 'NOT SET'}`)
  console.log(`X-Forwarded-For: ${forwardedFor || 'NOT SET'}`)

  if (!apiUser || !apiKey) {
    return NextResponse.json({ 
      price: null, 
      available: false,
      error: 'Namecheap API credentials missing' 
    } as PriceCheckResponse, { status: 500 })
  }

  // First check domain availability
  const checkUrl = `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&ClientIp=${clientIp}&Command=namecheap.domains.check&DomainList=${domain}`
  console.log(`API URL: ${checkUrl}`)

  try {
    // Check domain availability
    console.log(`Sending availability check request...`)
    const checkRes = await fetchWithRetry(checkUrl, {
      headers: {
        'Accept': 'text/xml'
      }
    }, 2);
    const checkXml = await checkRes.text()
    
    // Log response for debugging
    console.log(`API Response Status: ${checkRes.status}`)
    console.log(`API Response Preview: ${checkXml.substring(0, 500)}...`)
    
    // Enhanced error detection - fixed to ignore empty error tags
    if ((checkXml.includes('<Error') && !checkXml.includes('<Errors />')) || 
        (checkXml.includes('Status="ERROR"') && checkXml.includes('<Errors>')) ||
        checkXml.includes('Number=')) {
      const errorMatch = checkXml.match(/<Error[^>]*>(.*?)<\/Error>/i) || 
                       checkXml.match(/<Err[^>]*>(.*?)<\/Err>/i) ||
                       checkXml.match(/<Description>(.*?)<\/Description>/i)
                       
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error from Namecheap API'
      console.error(`Namecheap API Error: ${errorMsg}`)
      
      if (errorMsg.toLowerCase().includes('ip') || errorMsg.toLowerCase().includes('whitelist')) {
        return NextResponse.json({ 
          price: null, 
          available: false, 
          error: `IP Address error: ${errorMsg}` 
        } as PriceCheckResponse, { status: 401 })
      }
      
      return NextResponse.json({ 
        price: null, 
        available: false, 
        error: errorMsg 
      } as PriceCheckResponse, { status: 400 })
    }
    
    // Better domain availability check - focus on DomainCheckResult tag
    const availabilityCheck = checkXml.match(/<DomainCheckResult[^>]*Available="(true|false)"[^>]*>/i);
    
    let isAvailable = false;
    if (availabilityCheck && availabilityCheck[1].toLowerCase() === 'true') {
      isAvailable = true;
      console.log('Domain is available according to API response');
    }
    
    console.log(`Domain availability: ${isAvailable ? 'Available' : 'Not available'}`)
    
    // If domain is explicitly marked as not available in API response
    if (checkXml.includes('Available="false"')) {
      return NextResponse.json({ 
        price: null, 
        available: false, 
        error: 'Domain is already registered' 
      } as PriceCheckResponse, { status: 200 })
    }
    
    // If there's no availability information but we have a successful API response,
    // check the XML structure for clues
    if (!isAvailable && checkXml.includes('CommandResponse Type="namecheap.domains.check"')) {
      // Look for the domain in the response
      const domainCheck = new RegExp(`Domain="${domain}"[^>]*Available="(true|false)"`, 'i');
      const domainMatch = checkXml.match(domainCheck);
      
      if (domainMatch && domainMatch[1].toLowerCase() === 'true') {
        isAvailable = true;
        console.log('Domain is available (found in domain-specific check)');
      }
    }
    
    // If there's an error but we can't detect it properly, default to not available
    if (!isAvailable) {
      // Check if there's a specific error message about the domain
      const domainErrorMatch = checkXml.match(/<Description>(.*?)<\/Description>/i) ||
                             checkXml.match(/<Message>(.*?)<\/Message>/i)
      
      const errorMessage = domainErrorMatch && domainErrorMatch[1].trim() !== '' ? 
        domainErrorMatch[1] : 
        'Domain not available for registration'
      
      return NextResponse.json({ 
        price: null, 
        available: false, 
        error: errorMessage 
      } as PriceCheckResponse, { status: 200 })
    }

    // If domain is available, get the real price
    const tld = domain.split('.').pop()
    if (!tld) {
      return NextResponse.json({ 
        price: null,
        available: false,
        error: 'Invalid domain format' 
      } as PriceCheckResponse, { status: 400 })
    }
    
    console.log(`Getting price for TLD: ${tld}`)
    const pricingUrl = `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&ClientIp=${clientIp}&Command=namecheap.users.getPricing&ProductType=DOMAIN&ProductCategory=DOMAINS&ProductName=${tld}&ActionName=REGISTER`

    const pricingRes = await fetchWithRetry(pricingUrl, {
      headers: {
        'Accept': 'text/xml'
      }
    }, 2);
    const pricingXml = await pricingRes.text()
    
    // Log pricing response for debugging
    console.log(`Pricing API Response Status: ${pricingRes.status}`)
    console.log(`Pricing API Response Preview: ${pricingXml.substring(0, 500)}...`)
    
    // Improved error detection for pricing API - fixed to ignore empty error tags
    if ((pricingXml.includes('<Error') && !pricingXml.includes('<Errors />')) || 
        (pricingXml.includes('Status="ERROR"') && pricingXml.includes('<Errors>'))) {
      const errorMatch = pricingXml.match(/<Error[^>]*>(.*?)<\/Error>/i) ||
                       pricingXml.match(/<Description>(.*?)<\/Description>/i)
      
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error in Namecheap response'
      console.error(`Price check error: ${errorMsg}`)
      
      // If we can't get the price but domain is available, return a default price
      return NextResponse.json({ 
        price: 12.99, // Default fallback price
        available: true,
        message: 'Using approximate price - actual price may vary'
      } as PriceCheckResponse)
    }

    // Extract the price using the simplified function
    const price = extractOneYearPrice(pricingXml, tld)
    
    if (!price) {
      // If the simplified function fails, use a fallback direct extraction approach
      const fallbackMatch = pricingXml.match(/Price="([\d.]+)"/i) || pricingXml.match(/<Price>([\d\.]+)<\/Price>/i)
      
      if (fallbackMatch && fallbackMatch[1]) {
        const fallbackPrice = parseFloat(fallbackMatch[1])
        console.log(`Using fallback price: ${fallbackPrice}`)
        
        return NextResponse.json({ 
          price: fallbackPrice,
          available: true,
          message: fallbackPrice >= 2 ? 'Domain price is $2 or more' : null
        } as PriceCheckResponse)
      }
      
      // If we still can't extract a price but domain is available, return default
      return NextResponse.json({ 
        price: 12.99, // Default fallback price for .click or .shop domains
        available: true,
        message: 'Using approximate price - actual price may vary'
      } as PriceCheckResponse)
    }

    return NextResponse.json({ 
      price, 
      available: true,
      message: price >= 2 ? undefined : undefined
    } as PriceCheckResponse)
  } catch (err: any) {
    console.error('API error:', err)
    return NextResponse.json({ 
      price: null,
      available: false,
      error: err.message 
    } as PriceCheckResponse, { status: 500 })
  }
} 