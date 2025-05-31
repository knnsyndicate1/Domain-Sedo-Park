import { NextRequest, NextResponse } from 'next/server'
import { PriceCheckResponse } from '@/lib/types'

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

    // Try several patterns to find the price
    
    // Pattern 1: Look for Price attribute in a Duration="1" tag
    const pricePattern1 = new RegExp(`<Price[^>]*Duration="1"[^>]*Price="([\\d\\.]+)"`, 'i')
    const match1 = xml.match(pricePattern1)
    if (match1 && match1[1]) {
      console.log(`Found price using pattern 1: ${match1[1]} for ${tld}`)
      return parseFloat(match1[1])
    }
    
    // Pattern 2: Look for any Price attribute
    const pricePattern2 = /Price="([\d\.]+)"/i
    const match2 = xml.match(pricePattern2)
    if (match2 && match2[1]) {
      console.log(`Found price using pattern 2: ${match2[1]} for ${tld}`)
      return parseFloat(match2[1])
    }
    
    // Pattern 3: Look for <Price> tag
    const pricePattern3 = /<Price>([\d\.]+)<\/Price>/i
    const match3 = xml.match(pricePattern3)
    if (match3 && match3[1]) {
      console.log(`Found price using pattern 3: ${match3[1]} for ${tld}`)
      return parseFloat(match3[1])
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
    const checkRes = await fetch(checkUrl)
    const checkXml = await checkRes.text()
    
    // Log response for debugging
    console.log(`API Response Status: ${checkRes.status}`)
    console.log(`API Response Preview: ${checkXml.substring(0, 500)}...`)
    
    // Fix error detection logic to be more specific
    if (checkXml.includes('<Error Number=') || (checkXml.includes('Status="ERROR"') && checkXml.includes('<Errors>'))) {
      const errorMatch = checkXml.match(/<Error[^>]*>(.*?)<\/Error>/i)
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error from Namecheap API'
      console.error(`Namecheap API Error: ${errorMsg}`)
      
      if (errorMsg.includes('IP') || errorMsg.includes('whitelist')) {
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
    
    // Check if domain is available
    const isAvailable = checkXml.includes('Available="true"')
    console.log(`Domain availability: ${isAvailable ? 'Available' : 'Not available'}`)
    
    if (!isAvailable) {
      return NextResponse.json({ 
        price: null, 
        available: false, 
        error: 'Domain not available' 
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

    const pricingRes = await fetch(pricingUrl)
    const pricingXml = await pricingRes.text()
    
    // Log pricing response for debugging
    console.log(`Pricing API Response Status: ${pricingRes.status}`)
    console.log(`Pricing API Response Preview: ${pricingXml.substring(0, 500)}...`)
    
    // Check for errors in the XML - fix error detection pattern
    if (pricingXml.includes('<Error Number=') || (pricingXml.includes('Status="ERROR"') && pricingXml.includes('<Errors>'))) {
      const errorMatch = pricingXml.match(/<Error[^>]*>(.*?)<\/Error>/i)
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error in Namecheap response'
      console.error(`Price check error: ${errorMsg}`)
      return NextResponse.json({ 
        price: null,
        available: false,
        error: errorMsg 
      } as PriceCheckResponse, { status: 500 })
    }

    // Extract the price using the simplified function
    const price = extractOneYearPrice(pricingXml, tld)
    
    if (!price) {
      // If the simplified function fails, use a fallback direct extraction approach
      const fallbackMatch = pricingXml.match(/Price="([\d.]+)"/i)
      if (fallbackMatch && fallbackMatch[1]) {
        const fallbackPrice = parseFloat(fallbackMatch[1])
        console.log(`Using fallback price: ${fallbackPrice}`)
        
        return NextResponse.json({ 
          price: fallbackPrice,
          available: true,
          message: fallbackPrice >= 2 ? 'Domain price is $2 or more' : null
        } as PriceCheckResponse)
      }
      
      // Check if there's a real error in the XML
      if (pricingXml.includes('<Error Number=') || (pricingXml.includes('Status="ERROR"') && pricingXml.includes('<Errors>'))) {
        const errorMatch = pricingXml.match(/<Error[^>]*>(.*?)<\/Error>/i)
        const errorMsg = errorMatch ? errorMatch[1] : 'Could not get domain price from Namecheap'
        
        return NextResponse.json({ 
          price: null,
          available: false,
          error: errorMsg 
        } as PriceCheckResponse, { status: 500 })
      }
      
      return NextResponse.json({ 
        price: null,
        available: false,
        error: 'Could not get domain price from Namecheap' 
      } as PriceCheckResponse, { status: 500 })
    }

    return NextResponse.json({ 
      price, 
      available: true,
      message: price >= 2 ? 'Domain price is $2 or more' : null
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