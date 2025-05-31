import { NextRequest, NextResponse } from 'next/server'
import { RegistrationResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { domain } = await req.json()

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

  // Set custom nameservers for Sedo parking
  const nameservers = 'ns1.sedoparking.com,ns2.sedoparking.com'

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
    const res = await fetch(registerUrl)
    const xml = await res.text()
    
    // Log response for debugging
    console.log(`API Response Status: ${res.status}`)
    console.log(`API Response Preview: ${xml.substring(0, 500)}...`)
    
    // Check for IP address issues in the error message
    if (xml.includes('<Error Number=') || (xml.includes('Status="ERROR"') && xml.includes('<Errors>'))) {
      const errorMatch = xml.match(/<Error[^>]*>(.*?)<\/Error>/i)
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error from Namecheap API'
      console.error(`Namecheap API Error: ${errorMsg}`)
      
      if (errorMsg.includes('IP') || errorMsg.includes('whitelist')) {
        return NextResponse.json({ 
          status: 'failed', 
          error: `IP Address error: ${errorMsg}`
        } as RegistrationResponse, { status: 401 })
      }
      
      return NextResponse.json({ 
        status: 'failed', 
        error: errorMsg
      } as RegistrationResponse, { status: 400 })
    }
    
    // Better error handling and response parsing
    if (xml.includes('<DomainCreateResult') && xml.includes('Registered="true"')) {
      console.log('Domain registered successfully!')
      return NextResponse.json({ 
        status: 'registered', 
        message: 'Domain registered successfully!',
        domain: domain,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com'
      } as RegistrationResponse)
    } else if (xml.includes('<RequestedCommand>namecheap.domains.create</RequestedCommand>') && xml.includes('Status="OK"')) {
      // Sometimes Namecheap returns OK but domain is still processing
      console.log('Domain registration submitted successfully!')
      return NextResponse.json({ 
        status: 'registered', 
        message: 'Domain registration submitted successfully!',
        domain: domain,
        nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com'
      } as RegistrationResponse)
    } else if (xml.includes('error')) {
      // Extract error message from XML - fixed regex
      const errorMatch = xml.match(/<Error[^>]*>(.*?)<\/Error>/i)
      const errorMsg = errorMatch ? errorMatch[1] : 'Registration failed.'
      return NextResponse.json({ 
        status: 'failed', 
        error: errorMsg.trim() 
      } as RegistrationResponse, { status: 400 })
    } else {
      return NextResponse.json({ 
        status: 'pending', 
        message: 'Registration submitted, check status later.' 
      } as RegistrationResponse)
    }
  } catch (err: any) {
    console.error('Error registering domain:', err)
    return NextResponse.json({ 
      status: 'failed', 
      error: err.message 
    } as RegistrationResponse, { status: 500 })
  }
} 