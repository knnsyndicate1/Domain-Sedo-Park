import { NextRequest, NextResponse } from 'next/server'
import { RegistrationResponse } from '@/lib/types'

// Helper function for fetch with retry
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let retryCount = 0;
  let lastError: Error | null = null;

  // Add default timeout if not specified
  if (!options.signal) {
    options.signal = AbortSignal.timeout(45000); // 45 seconds timeout
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
      const delay = Math.min(1000 * (2 ** retryCount) + Math.random() * 1000, 10000);
      console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Failed after multiple retry attempts');
}

export async function POST(req: NextRequest) {
  const { domain } = await req.json()

  // Input validation
  if (!domain || typeof domain !== 'string') {
    return NextResponse.json({ 
      status: 'failed', 
      error: 'Invalid domain input' 
    } as RegistrationResponse, { status: 400 })
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/
  if (!domainRegex.test(domain)) {
    return NextResponse.json({ 
      status: 'failed', 
      error: 'Invalid domain format' 
    } as RegistrationResponse, { status: 400 })
  }

  const apiUser = process.env.NAMECHEAP_USERNAME
  const apiKey = process.env.NAMECHEAP_API_KEY
  
  // Get client IP from request or use configured IP
  const configuredIp = process.env.NAMECHEAP_CLIENT_IP
  const forwardedFor = req.headers.get('x-forwarded-for')
  const clientIp = configuredIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1')

  console.log(`=== NAMECHEAP REGISTRATION DEBUGGING ===`)
  console.log(`Registering domain: ${domain}`)
  console.log(`API Username: ${apiUser ? 'Set' : 'NOT SET'}`)
  console.log(`API Key: ${apiKey ? 'Set' : 'NOT SET'}`)
  console.log(`Using IP for Namecheap API: ${clientIp}`)
  console.log(`Configured IP in .env: ${configuredIp || 'NOT SET'}`)
  console.log(`X-Forwarded-For: ${forwardedFor || 'NOT SET'}`)

  if (!apiUser || !apiKey) {
    return NextResponse.json({ 
      status: 'failed', 
      error: 'Namecheap API credentials missing' 
    } as RegistrationResponse, { status: 500 })
  }

  // First check if domain is available before attempting to register
  try {
    console.log('Checking domain availability before registration...')
    const checkUrl = `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&ClientIp=${clientIp}&Command=namecheap.domains.check&DomainList=${domain}`
    
    const checkRes = await fetch(checkUrl)
    const checkXml = await checkRes.text()
    
    console.log(`Availability check response: ${checkRes.status}`)
    console.log(`Availability check preview: ${checkXml.substring(0, 200)}...`)
    
    // Log the full response for debugging purposes
    console.log('Full availability check response:')
    console.log(checkXml)
    
    // Improved availability check
    let isAvailable = false
    
    // First look for the domain check result with exact domain matching
    const domainCheck = new RegExp(`<DomainCheckResult[^>]*Domain="${domain}"[^>]*Available="(true|false)"`, 'i')
    const domainMatch = checkXml.match(domainCheck)
    
    if (domainMatch) {
      isAvailable = domainMatch[1].toLowerCase() === 'true'
      console.log(`Domain availability explicitly found in response: ${isAvailable ? 'Available' : 'Not Available'}`)
    } else if (checkXml.includes('Available="true"')) {
      // Fallback check
      isAvailable = true
      console.log('Domain availability found via general check: Available')
    }
    
    // Check for errors in the availability response
    if ((checkXml.includes('<Error') && !checkXml.includes('<Errors />')) || 
        (checkXml.includes('Status="ERROR"') && checkXml.includes('<Errors>'))) {
      const errorMatch = checkXml.match(/<Error[^>]*>(.*?)<\/Error>/i) || 
                       checkXml.match(/<Description>(.*?)<\/Description>/i)
      
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error checking domain availability'
      console.error(`Domain availability check error: ${errorMsg}`)
      
      if (errorMsg.toLowerCase().includes('ip') || errorMsg.toLowerCase().includes('whitelist')) {
        return NextResponse.json({ 
          status: 'failed', 
          error: `IP Address error: ${errorMsg}`
        } as RegistrationResponse, { status: 401 })
      }
      
      // Continue with registration attempt if the error is not IP related
      console.log('Continuing with registration despite availability check error')
    } else if (!isAvailable) {
      return NextResponse.json({ 
        status: 'failed', 
        error: 'Domain is not available for registration'
      } as RegistrationResponse, { status: 400 })
    } else {
      console.log('Domain is available, proceeding with registration')
    }
  } catch (err) {
    console.error('Error checking domain availability:', err)
    // Continue with registration attempt even if availability check fails
    console.log('Continuing with registration despite availability check error')
  }

  // Set custom nameservers for Sedo parking
  const nameservers = 'ns1.sedoparking.com,ns2.sedoparking.com'
  console.log(`Setting nameservers for domain ${domain} to: ${nameservers}`)

  // Use fixed company details for all registrations
  const registrantFirstName = 'Khushwant'
  const registrantLastName = 'Singh'
  const registrantEmail = 'knnsyndicate@gmail.com'
  const registrantPhone = '+91.8146262797'
  const registrantAddress = 'KNN Syndicate, Gconnect Space 3rd floor, A-19A, Phase-2, Mayapuri Industrial area'
  const registrantCity = 'Delhi'
  const registrantState = 'Delhi'
  const registrantPostalCode = '110064'
  const registrantCountry = 'IN'

  console.log(`Using fixed company contact details for registration`)

  // Prepare registration URL with fixed company Whois information
  const registerUrl = `https://api.namecheap.com/xml.response?ApiUser=${apiUser}&ApiKey=${apiKey}&UserName=${apiUser}&ClientIp=${clientIp}` +
    `&Command=namecheap.domains.create&DomainName=${domain}&Years=1&AddFreeWhoisguard=YES&WGEnabled=YES&AutoRenew=false` + 
    `&Nameservers=${nameservers}&UseCustomerBalance=true` +
    // Fixed company contact details for all registrations
    `&RegistrantFirstName=${registrantFirstName}` +
    `&RegistrantLastName=${registrantLastName}` +
    `&RegistrantAddress1=${encodeURIComponent(registrantAddress)}` +
    `&RegistrantCity=${registrantCity}` +
    `&RegistrantStateProvince=${registrantState}` +
    `&RegistrantPostalCode=${registrantPostalCode}` +
    `&RegistrantCountry=${registrantCountry}` +
    `&RegistrantPhone=${encodeURIComponent(registrantPhone)}` +
    `&RegistrantEmailAddress=${encodeURIComponent(registrantEmail)}` +
    `&TechFirstName=${registrantFirstName}` +
    `&TechLastName=${registrantLastName}` +
    `&TechAddress1=${encodeURIComponent(registrantAddress)}` +
    `&TechCity=${registrantCity}` +
    `&TechStateProvince=${registrantState}` +
    `&TechPostalCode=${registrantPostalCode}` +
    `&TechCountry=${registrantCountry}` +
    `&TechPhone=${encodeURIComponent(registrantPhone)}` +
    `&TechEmailAddress=${encodeURIComponent(registrantEmail)}` +
    `&AdminFirstName=${registrantFirstName}` +
    `&AdminLastName=${registrantLastName}` +
    `&AdminAddress1=${encodeURIComponent(registrantAddress)}` +
    `&AdminCity=${registrantCity}` +
    `&AdminStateProvince=${registrantState}` +
    `&AdminPostalCode=${registrantPostalCode}` +
    `&AdminCountry=${registrantCountry}` +
    `&AdminPhone=${encodeURIComponent(registrantPhone)}` +
    `&AdminEmailAddress=${encodeURIComponent(registrantEmail)}` +
    // Add AuxBilling (Billing) contact information
    `&AuxBillingFirstName=${registrantFirstName}` + 
    `&AuxBillingLastName=${registrantLastName}` + 
    `&AuxBillingAddress1=${encodeURIComponent(registrantAddress)}` + 
    `&AuxBillingCity=${registrantCity}` + 
    `&AuxBillingStateProvince=${registrantState}` + 
    `&AuxBillingPostalCode=${registrantPostalCode}` + 
    `&AuxBillingCountry=${registrantCountry}` + 
    `&AuxBillingPhone=${encodeURIComponent(registrantPhone)}` + 
    `&AuxBillingEmailAddress=${encodeURIComponent(registrantEmail)}`

  console.log(`API URL: ${registerUrl.substring(0, 200)}...`)

  try {
    console.log(`Sending registration request...`)
    const res = await fetchWithRetry(registerUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/xml'
      },
      cache: 'no-store'
    }, 3); // Try up to 3 times
    
    console.log(`API Response received, status: ${res.status}`);
    
    if (!res.ok) {
      console.error(`API Response not OK: ${res.status}`);
      return NextResponse.json({ 
        status: 'failed', 
        error: `Namecheap API returned status ${res.status}` 
      } as RegistrationResponse, { status: res.status });
    }
    
    const xml = await res.text();
    
    // Log response for debugging
    console.log(`API Response Status: ${res.status}`)
    console.log(`API Response Preview: ${xml.substring(0, 500)}...`)
    
    // Improved error detection - fixed to ignore empty error tags
    if ((xml.includes('<Error') && !xml.includes('<Errors />')) || 
        (xml.includes('Status="ERROR"') && xml.includes('<Errors>'))) {
      // Extract detailed error information with better pattern matching
      const errorMatch = xml.match(/<Error[^>]*>(.*?)<\/Error>/i) ||
                      xml.match(/<Description>(.*?)<\/Description>/i) ||
                      xml.match(/<Message>(.*?)<\/Message>/i)
      
      const errorMsg = errorMatch ? errorMatch[1].trim() : 'Unknown error from Namecheap API'
      console.error(`Namecheap API Error: ${errorMsg}`)
      
      // Handle IP whitelisting issues specifically
      if (errorMsg.toLowerCase().includes('ip') || errorMsg.toLowerCase().includes('whitelist')) {
        return NextResponse.json({ 
          status: 'failed', 
          error: `IP Address error: ${errorMsg} (IP: ${clientIp})`
        } as RegistrationResponse, { status: 401 })
      }
      
      // Handle account balance issues
      if (errorMsg.toLowerCase().includes('balance') || errorMsg.toLowerCase().includes('funds')) {
        return NextResponse.json({ 
          status: 'failed', 
          error: `Account balance error: ${errorMsg}`
        } as RegistrationResponse, { status: 402 })
      }
      
      // Handle domain-specific issues
      if (errorMsg.toLowerCase().includes('domain')) {
        return NextResponse.json({ 
          status: 'failed', 
          error: errorMsg
        } as RegistrationResponse, { status: 400 })
      }
      
      return NextResponse.json({ 
        status: 'failed', 
        error: errorMsg
      } as RegistrationResponse, { status: 400 })
    }
    
    // Enhanced success detection with multiple patterns
    if (
      (xml.includes('<DomainCreateResult') && xml.includes('Registered="true"')) ||
      (xml.includes('<RequestedCommand>namecheap.domains.create</RequestedCommand>') && xml.includes('Status="OK"')) ||
      (xml.includes('Domain registration successful'))
    ) {
      console.log('Domain registered successfully!')
      return NextResponse.json({ 
        status: 'registered', 
        message: 'Domain registered successfully!',
        domain: domain,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com'
      } as RegistrationResponse)
    } else if (xml.includes('Status="OK"')) {
      // Sometimes Namecheap returns OK but without explicit confirmation
      console.log('Domain registration submitted successfully!')
      return NextResponse.json({ 
        status: 'registered', 
        message: 'Domain registration submitted successfully!',
        domain: domain,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com'
      } as RegistrationResponse)
    } else if (xml.includes('error') || xml.includes('Error')) {
      // Generic error case if patterns above didn't match
      const errorMatch = xml.match(/<Error[^>]*>(.*?)<\/Error>/i) ||
                        xml.match(/<Message[^>]*>(.*?)<\/Message>/i) ||
                        xml.match(/<Description[^>]*>(.*?)<\/Description>/i)
      
      const errorMsg = errorMatch ? errorMatch[1].trim() : 'Registration failed for an unknown reason.'
      return NextResponse.json({ 
        status: 'failed', 
        error: errorMsg
      } as RegistrationResponse, { status: 400 })
    } else {
      console.log('Registration status unclear, assuming pending')
      return NextResponse.json({ 
        status: 'pending', 
        message: 'Registration submitted, check status later.' 
      } as RegistrationResponse)
    }
  } catch (err: any) {
    console.error('Error registering domain:', err)
    return NextResponse.json({ 
      status: 'failed', 
      error: err.message || 'Network error during domain registration'
    } as RegistrationResponse, { status: 500 })
  }
} 