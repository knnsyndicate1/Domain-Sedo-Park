'use client'

import { useEffect, useState } from 'react'
import { Card, Button, message, Form, Input, List, Tag, Alert, Empty, Typography, Avatar, Spin, Row, Col } from 'antd'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Domain } from '@/lib/types'
import { 
  LogoutOutlined, 
  PlusOutlined, 
  CheckCircleOutlined, 
  LoadingOutlined, 
  CloudUploadOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  UserOutlined,
  WarningOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

// Modern loading component for small spaces
function SearchLoader() {
  return (
    <div className="flex items-center space-x-3">
      <div className="w-4 h-4 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-4 h-4 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-4 h-4 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  )
}

function ModernLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-xl animate-pulse"></div>
        <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-pink-400 animate-spin"></div>
        <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
          <PlusOutlined style={{ fontSize: 28, color: '#6366f1' }} />
        </div>
      </div>
      <Text className="mt-6 text-lg text-gray-700 font-semibold animate-fadeIn">Loading, please wait...</Text>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [form] = Form.useForm()
  const [domains, setDomains] = useState<Domain[]>([])
  const [fetchingDomains, setFetchingDomains] = useState(true)
  const [domainToRegister, setDomainToRegister] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [userId, setUserId] = useState<string | null>(null)
  const [autoListingInProgress, setAutoListingInProgress] = useState(false)
  const [showPrice, setShowPrice] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  // Fetch domains for the logged-in user
  useEffect(() => {
    if (userId) {
      fetchDomains()
      checkAdminStatus()
    }
    // eslint-disable-next-line
  }, [userId])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setUserId(session.user.id)
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAdminStatus = async () => {
    if (!userId) return
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single()
        
      if (!error && data) {
        setIsAdmin(true)
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
    }
  }

  const fetchDomains = async () => {
    setFetchingDomains(true)
    try {
      // Fetch all domains for the user
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('status', 'registered')
      .order('created_at', { ascending: false })
      
    if (error) {
      message.error('Failed to fetch domains')
      console.error('Error fetching domains:', error)
    } else {
        // Filter out domains that are already listed on Sedo or have Sedo nameservers
        // Only show domains that still need action (need to be listed on Sedo)
        const domainsNeedingAction = (data as Domain[])
          .filter(domain => {
            // Filter out domains explicitly marked as Sedo listed
            if (domain.sedo_listed) return false;
            
            // IMPORTANT: Also filter out any domain that has Sedo nameservers
            // regardless of its sedo_listed flag value
            if (domain.nameservers && 
                (domain.nameservers.includes('sedoparking.com') || 
                 domain.nameservers.includes('sedo'))) {
              console.log(`Domain ${domain.domain} has Sedo nameservers, filtering out`);
              return false;
            }
            return true;
          })
          .filter(Boolean); // Remove any null/undefined entries
        
        // Remove duplicates based on domain name
        const uniqueDomains = domainsNeedingAction.reduce((acc, current) => {
          const x = acc.find(item => item.domain === current.domain);
          if (!x) {
            return [...acc, current];
          } else {
            return acc;
          }
        }, [] as Domain[]);
        
        // Set domains state, ensuring no listed domains are shown
        setDomains(uniqueDomains);
        
        // Log the filtered domains for debugging
        console.log(`Filtered domains: ${uniqueDomains.length} domains need action`);
    }
    } catch (err) {
      console.error('Error fetching domains:', err)
      message.error('Failed to load your domains')
    } finally {
    setFetchingDomains(false)
    }
  }

  const handleLogout = async () => {
    try {
      setNavigating(true)
      // Add small delay to show the loading animation
      await new Promise(resolve => setTimeout(resolve, 400))
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      router.push('/')
    } catch (error: any) {
      setNavigating(false)
      message.error(error.message)
    }
  }

  // Validate TLD - strict enforcement
  const isValidTLD = (domain: string) => {
    const lowercaseDomain = domain.toLowerCase().trim();
    return lowercaseDomain.endsWith('.shop') || lowercaseDomain.endsWith('.click');
  }

  // Real price check using Namecheap API - updated for better reliability
  const checkPrice = async (domain: string) => {
    setPriceLoading(true);
    setError(null);
    setPrice(null);
    setDomainAvailable(null);
    setShowPrice(false); // Don't show price section until we're certain
    
    // Normalize domain for consistent checks (lowercase and trim)
    const normalizedDomain = domain.toLowerCase().trim();
    
    if (!isValidTLD(normalizedDomain)) {
      message.error('Only .shop or .click domains allowed');
      setPriceLoading(false);
      return;
    }
    
    try {
      // Check for internet connection first
      if (!navigator.onLine) {
        setError('Unable to check price: You are offline');
        message.error('Network error. Please check your connection and try again.');
        setPriceLoading(false);
        return;
      }

      console.log(`=== CHECKING DOMAIN: ${normalizedDomain} ===`);
      
      // STEP 1: First check database for exact matches to prevent duplicates
      console.log(`Checking database for domain: ${normalizedDomain}`);
      
      // Use EXACT matching only to prevent false positives
      const { data: existingDomains, error: searchError } = await supabase
        .from('domains')
        .select('domain, status, user_id')
        .eq('domain', normalizedDomain);
      
      if (searchError) {
        console.error("Error searching database for domain:", searchError);
      } else {
        console.log(`Database search results:`, existingDomains);
        
        if (existingDomains && existingDomains.length > 0) {
          console.log(`FOUND IN DATABASE: Domain ${normalizedDomain} already exists in our system`);
          
          // Check if current user owns this domain - only if we have an exact match
          const ownedByUser = existingDomains.some(d => d.user_id === userId);
          
          setError(ownedByUser ? 
            'You have already registered this domain' : 
            'This domain is already registered in our system')
          setPrice(null)
          setDomainAvailable(false)
          setShowPrice(true) // Show the error message
          
          message.error(ownedByUser ? 
                      "You've already registered this domain in your account." : 
            "This domain is already registered in our system.");
          setPriceLoading(false);
          return;
        }
      }
      
      // STEP 2: Check with Namecheap API directly
      console.log("STEP 2: Checking with Namecheap API...");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('Request timeout'), 20000);
      
      try {
        // Call price API first, which is more reliable for our use case
        const res = await fetch('/api/namecheap/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: normalizedDomain }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.error(`Price API returned status ${res.status}`);
          throw new Error(`Price API returned status ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Price API response:', data);
        
        // If price API returns an error or domain is not available
        if (data.error || !data.available) {
          setError(data.error || 'Domain is not available');
          setPrice(null);
          setDomainAvailable(false);
          setShowPrice(true);
          
          message.error(data.error || "This domain is already registered and not available.");
        } else {
          // Domain is available and we have a price!
          const domainPrice = data.price || 0; // Default to 0 if price is undefined
          console.log(`SUCCESS: Domain ${normalizedDomain} is available for $${domainPrice}`);
          setPrice(domainPrice);
          setDomainAvailable(true);
          setShowPrice(true);
          setError(null);
          
          // Check if the price is under $2
          if (domainPrice < 2) {
            // Show success message for available domains under $2
            message.success(`${normalizedDomain} is available for $${domainPrice} - You can register this domain!`);
          } else {
            // Show warning message for domains over $2
            message.warning(`Domain ${normalizedDomain} costs $${domainPrice} - Only domains under $2 can be registered.`);
            setError(`This domain costs $${domainPrice}. Only domains under $2 can be registered.`);
          }
        }
      } catch (error: any) {
        console.error('Price check error:', error);
        
        // Show appropriate error message
        setError('Failed to check price');
        setPrice(null);
        setDomainAvailable(null);
        setShowPrice(true);
        
        const isAbortError = error.name === 'AbortError';
        message.error(isAbortError ? 
                  'Request timed out. Server may be busy.' : 
          'Unable to connect to domain registration service.');
      }
    } catch (error: any) {
      console.error('Overall domain check error:', error);
      setError('Failed to check domain availability');
      setPrice(null);
      setDomainAvailable(null);
      setShowPrice(true);
      
      message.error('Failed to check domain availability. Please try again.');
    } finally {
      setPriceLoading(false);
    }
  }

  // Show registration modal with added price check
  const showRegistrationForm = () => {
    const domain = form.getFieldValue('domain');
    
    if (!domain || !domain.trim()) {
      message.error('Please enter a domain name');
      return;
    }
    
    // Check for internet connection first
    if (!navigator.onLine) {
      message.error('Network error. Please check your connection and try again.');
      return;
    }
    
    // Normalize domain to lowercase for consistent checks
    const normalizedDomain = domain.toLowerCase().trim();
    
    // Validate TLD before proceeding
    if (!isValidTLD(normalizedDomain)) {
      message.error('Only .shop or .click domains are allowed');
      return;
  }

    // Make sure the price has been checked before registration
    if (price === null) {
      // Check price first if not already checked
      checkPrice(normalizedDomain);
      message.info('Please check domain availability and price first');
      return;
    }
    
    // Ensure domain is available
    if (!domainAvailable) {
      message.error('This domain is not available for registration');
      return;
    }
    
    // Verify price is under $2
    if (price >= 2) {
      message.error(`Domain price $${price} exceeds the $2 limit. Please choose another domain.`);
      return;
    }
    
    console.log(`Starting domain registration for: ${normalizedDomain} at price: $${price}`);
    
    // Call registration with domain value
    onRegister({ domain: normalizedDomain });
  }

  // Register domain using Namecheap API and update Supabase
  const onRegister = async (values: { domain: string }) => {
    setRegistering(true);
    
    try {
      const normalizedDomain = values.domain.toLowerCase().trim();
      
      // Double-check TLD validity
      if (!isValidTLD(normalizedDomain)) {
        message.error('Only .shop or .click domains are allowed');
            setRegistering(false);
            return;
          }

      // Double-check price before registering
      if (price === null || price >= 2) {
        message.error(`Domain price ${price === null ? 'is unknown' : `$${price} exceeds the $2 limit`}`);
          setRegistering(false);
          return;
        }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        message.error('Authentication error. Please log in again.');
        router.push('/login');
        return;
      }
      
      const userId = user.id;
      console.log(`User ID for registration: ${userId}`);
      
      // Check if domain already exists in user's domains to prevent duplicates
      const { data: existingDomains, error: checkError } = await supabase
        .from('domains')
        .select('id, domain, status')
        .eq('user_id', userId)
        .eq('domain', normalizedDomain);
      
      if (checkError) {
        console.error('Error checking existing domains:', checkError);
      } else if (existingDomains && existingDomains.length > 0) {
        const existingDomain = existingDomains[0];
        if (existingDomain.status === 'registered') {
          // Domain already registered, just show the Auto-List button
          message.info(`Domain ${normalizedDomain} is already registered!`);
          setRegistering(false);
          return;
        }
      }
      
      console.log(`Calling registration API for: ${normalizedDomain}`);
      
      // Register the domain with the API
        const res = await fetch('/api/namecheap/register', {
          method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify({ domain: normalizedDomain }),
        });
        
      const data = await res.json();
      console.log('Registration API response:', data);
      
      if (res.ok && data.status === 'registered') {
        // Successful registration
        try {
          // Prepare domain data
          const domainData = {
            user_id: userId,
            domain: normalizedDomain,
            status: 'registered',
            registration_date: new Date().toISOString(),
            expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
            nameservers: data.nameservers || 'ns1.sedoparking.com, ns2.sedoparking.com',
            sedo_listed: false // Will be set to true after listing on Sedo
          };
          
          console.log('Attempting to insert domain with data:', domainData);
          
          // Save to database with nameservers
          const { data: newDomain, error: insertError } = await supabase
            .from('domains')
            .insert(domainData)
            .select();
            
          if (insertError) {
            console.error('Error inserting domain:', insertError);
            // Try to get more details about the error
            console.error('Error code:', insertError.code);
            console.error('Error message:', insertError.message);
            console.error('Error details:', insertError.details);
          
            // Check for specific error types and handle accordingly
            if (insertError.code === '23505') {
              // Unique constraint violation (domain already exists)
              message.warning('This domain is already in your account. Refreshing your domains list.');
              fetchDomains(); // Refresh the domain list
            } else {
              // Try a simpler insert with only the essential fields
              console.log('Trying simplified domain insertion...');
              const { error: simpleInsertError } = await supabase
                .from('domains')
                .insert({
                  user_id: userId,
                  domain: normalizedDomain,
                  status: 'registered'
                });
              
              if (simpleInsertError) {
                console.error('Simplified insert also failed:', simpleInsertError);
                message.error('Domain registered, but failed to save to your account. Please contact support.');
      } else {
                message.success(`${normalizedDomain} registered! (Basic info saved)`);
                fetchDomains();
              }
            }
          } else {
            // Show success message with nameserver info
            message.success(
              `${normalizedDomain} successfully registered! Nameservers set to: ns1.sedoparking.com, ns2.sedoparking.com`
            );
        
            // Refresh domain list
            fetchDomains();
            
            // Reset form
      form.resetFields();
      setDomainAvailable(null);
      setShowPrice(false);
            setPrice(null);
          }
        } catch (dbError) {
          console.error('Error saving to database:', dbError);
          
          // Try one more time with minimal data
          try {
            const { error: finalAttemptError } = await supabase
              .from('domains')
              .insert({
                user_id: userId,
                domain: normalizedDomain,
                status: 'registered'
              });
              
            if (finalAttemptError) {
              console.error('Final attempt failed:', finalAttemptError);
              message.error('Domain registered, but failed to save to your account. Please check your domain list later.');
            } else {
              message.success(`${normalizedDomain} registered successfully! (minimal info saved)`);
              fetchDomains();
            }
          } catch (finalError) {
            console.error('All database save attempts failed:', finalError);
            message.error('Domain registered, but failed to save to your account.');
          }
        }
      } else {
        // API returned an error
        const errorMessage = data.error || 'Failed to register domain';
        message.error(errorMessage);
      }
    } catch (error: any) {
      // Network or other errors
      console.error('Registration error:', error);
      message.error('Connection error. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // Auto list on Sedo and mark as listed
  const handleAutoListOnSedo = async (domain: string, domainId: string) => {
    setSelectedDomain(domain);
    setAutoListingInProgress(true);
    
    try {
      // Show a clean loading message
      message.loading({
        content: `Listing ${domain} on Sedo...`,
        key: domain,
        duration: 0 // Don't auto-close the loading message
      });
      
      console.log(`Attempting to list domain ${domain} on Sedo...`);
      
      // Call the Sedo API
      const res = await fetch('/api/sedo/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to connect to Sedo API (${res.status})`);
      }
      
      const data = await res.json();
      console.log(`Sedo API response for ${domain}:`, data);
      
      if (data.success) {
        // Update the database
        console.log(`Updating database for ${domain} with Sedo nameservers`);
        const { error } = await supabase
          .from('domains')
          .update({ 
            sedo_listed: true,
            nameservers: data.nameservers || 'ns1.sedoparking.com, ns2.sedoparking.com'
          })
          .eq('id', domainId);
          
        if (error) {
          console.error(`Failed to update database for ${domain}:`, error);
          message.error({ 
            content: 'Failed to update database', 
            key: domain,
            duration: 6
          });
        } else {
          console.log(`Database updated successfully for ${domain} - marked as Sedo listed with nameservers`);
          
          // Store domain in localStorage for simulating listed domains in searches
          try {
            if (typeof window !== 'undefined') {
              // Add to localStorage for search simulation
              const domainData = {
                domain: domain?.toLowerCase() || '', // Use optional chaining and provide default value
                price: 0, // Price set to 0 as not for sale by default
                currency: 1, // USD
                forsale: 0, // Not for sale by default (set to 0)
                fixedprice: 0, // Not fixed price
                sedo_listed: true
              };
              
              console.log(`Preparing to save domain to localStorage: ${domain}`);
              
              // Get existing domains or initialize empty array
              const existingDomainsString = localStorage.getItem('listed_domains');
              let existingDomains: any[] = [];
              
              if (existingDomainsString) {
                try {
                  existingDomains = JSON.parse(existingDomainsString);
                  console.log('Current domains in localStorage:', existingDomains);
                  
                  if (!Array.isArray(existingDomains)) {
                    console.log('localStorage data is not an array, resetting');
                    existingDomains = [];
                  }
                } catch (e) {
                  console.error('Error parsing localStorage domains:', e);
                  existingDomains = [];
                }
              } else {
                console.log('No domains in localStorage yet, creating new array');
              }
              
              // Remove any existing entries for this domain (to avoid duplicates)
              existingDomains = existingDomains.filter(d => 
                d.domain?.toLowerCase() !== domain?.toLowerCase()
              );
              
              // Add the new domain
                existingDomains.push(domainData);
              
              // Save back to localStorage
                localStorage.setItem('listed_domains', JSON.stringify(existingDomains));
              console.log(`Updated localStorage - added domain ${domain}`);
              console.log('Total domains in localStorage now:', existingDomains.length);
              console.log('Domains in localStorage:', existingDomains.map(d => d.domain).join(', '));
            }
          } catch (e) {
            console.error('Error saving domain to localStorage:', e);
          }
          
          // Immediately remove domain from the UI
          setDomains(prevDomains => prevDomains.filter(d => d.id !== domainId));
          
          // Show clean success message for 6 seconds
          message.success({ 
            content: (
              <div className="flex items-center">
                <CheckCircleOutlined className="text-green-500 mr-2" />
                <span><strong>{domain}</strong> successfully listed on Sedo!</span>
              </div>
            ),
            duration: 6,
            key: domain
          });
        }
      } else {
        message.error({ 
          content: data.error || "Could not list domain on Sedo. Please try again.",
          key: domain,
          duration: 6
        });
      }
    } catch (error: any) {
      console.error('Error listing domain on Sedo:', error);
      
      // Show a simple error message
      message.error({ 
        content: 'Connection error. Please try again.',
        key: domain,
        duration: 6
      });
    } finally {
      setAutoListingInProgress(false);
    }
  };

  // Add search domains navigation function
  const goToSearchDomains = async (domain?: string) => {
    setNavigating(true);
    // Add small delay to show the loading animation
    await new Promise(resolve => setTimeout(resolve, 400));
    
    if (domain) {
      // Navigate to search page with the domain parameter
      router.push(`/search-domain?domain=${encodeURIComponent(domain)}`);
    } else {
      // Navigate to search page without parameters
      router.push('/search-domain');
    }
  }

  // Display nameserver status tag based on nameservers value
  const getNameserverStatusTag = (nameservers: string | null | undefined) => {
    if (!nameservers) return null;
    
    // Check if using Sedo nameservers
    if (nameservers.includes('sedoparking.com')) {
      return (
        <Tag color="green" className="ml-2">
          <CheckCircleOutlined /> Sedo Nameservers
        </Tag>
      );
    }
    
    // Default nameservers
    return (
      <Tag color="orange" className="ml-2">
        <InfoCircleOutlined /> Custom Nameservers
      </Tag>
    );
  }

  // Render the domain item in the list
  const renderDomainItem = (item: Domain) => (
    <List.Item className="p-4 border border-gray-100 rounded-xl mb-3 bg-white/90 hover:shadow-lg transition-shadow">
      <div className="flex flex-col w-full">
        <div className="flex items-center w-full">
          <Avatar size={48} className="bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 text-white font-bold flex-shrink-0">
            {item.domain.charAt(0).toUpperCase()}
          </Avatar>
          <div className="ml-4 flex-grow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {item.domain}
                  {getNameserverStatusTag(item.nameservers)}
                </div>
                <div className="text-sm text-gray-500">
                  {item.registration_date ? (
                    `Registered: ${new Date(item.registration_date).toLocaleDateString()}`
                  ) : (
                    'Recently registered'
                  )}
                </div>
              </div>
            </div>
            
            <Row className="mt-4">
              <Col span={24} className="flex justify-end space-x-2">
                {/* Manual fix button for domains that are actually already listed but not marked correctly */}
                {!item.sedo_listed && item.nameservers && item.nameservers.includes('sedoparking.com') && (
                  <Button
                    type="default"
                    onClick={() => fixDomainListingStatus(item.domain, item.id)}
                    icon={<CheckCircleOutlined />}
                    className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200"
                  >
                    Fix Status
                  </Button>
                )}
                <Button
                  type="primary"
                  onClick={() => handleAutoListOnSedo(item.domain, item.id)}
                  icon={<CloudUploadOutlined />}
                  loading={autoListingInProgress && selectedDomain === item.domain}
                  className="bg-blue-500 hover:bg-blue-600"
                  disabled={!!(autoListingInProgress || (item.nameservers && item.nameservers.includes('sedoparking.com')))}
                >
                  {(item.nameservers && item.nameservers.includes('sedoparking.com')) ? 'Already Using Sedo NS' : 'Auto-Sedo Listing'}
                </Button>
              </Col>
            </Row>
          </div>
        </div>
        {item.nameservers && (
          <div className="mt-2 text-sm text-gray-500 p-2 bg-gray-50 rounded border border-gray-100">
            <strong>Nameservers:</strong> {item.nameservers}
          </div>
        )}
      </div>
    </List.Item>
  )

  // Function to fix a domain's listing status when it has Sedo nameservers
  // but isn't marked as listed in the database
  const fixDomainListingStatus = async (domain: string, domainId: string) => {
    try {
      message.loading({
        content: `Fixing listing status for ${domain}...`,
        key: domain,
        duration: 0
      });
      
      console.log(`Fixing listing status for domain: ${domain}`);
      
      // Update the domain to mark it as Sedo listed
      const { error } = await supabase
        .from('domains')
        .update({ 
          sedo_listed: true,
          nameservers: 'ns1.sedoparking.com, ns2.sedoparking.com' 
        })
        .eq('id', domainId);
      
      if (error) {
        console.error(`Error updating domain ${domain}:`, error);
        message.error({
          content: 'Failed to update domain status',
          key: domain,
          duration: 4
        });
        return;
      }
      
      // Add to localStorage for search simulation
      try {
        if (typeof window !== 'undefined') {
          const domainData = {
            domain: domain.toLowerCase(),
            price: 0,
            currency: 1,
            forsale: 0,
            fixedprice: 0,
            sedo_listed: true
          };
          
          const existingDomainsString = localStorage.getItem('listed_domains');
          let existingDomains: any[] = [];
          
          if (existingDomainsString) {
            try {
              existingDomains = JSON.parse(existingDomainsString);
              if (!Array.isArray(existingDomains)) {
                existingDomains = [];
              }
            } catch (e) {
              console.error('Error parsing localStorage domains:', e);
              existingDomains = [];
            }
          }
          
          // Remove any existing entries for this domain
          existingDomains = existingDomains.filter(d => 
            d.domain?.toLowerCase() !== domain.toLowerCase()
          );
          
          // Add the domain
          existingDomains.push(domainData);
          localStorage.setItem('listed_domains', JSON.stringify(existingDomains));
        }
      } catch (e) {
        console.error('Error saving domain to localStorage:', e);
      }
      
      message.success({
        content: `Fixed ${domain} listing status!`,
        key: domain,
        duration: 4
      });
      
      // Refresh domains list
      fetchDomains();
      
    } catch (err) {
      console.error(`Error fixing domain status for ${domain}:`, err);
      message.error({
        content: 'Error fixing domain status',
        key: domain,
        duration: 4
      });
    }
  };

  if (loading) {
    return <ModernLoader />
  }

  const NavigationLoader = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="relative">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-xl animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-pink-400 animate-spin"></div>
          <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
            <PlusOutlined style={{ fontSize: 28, color: '#6366f1' }} />
          </div>
        </div>
        <div className="mt-6 text-center">
          <Text className="text-lg text-gray-700 font-semibold animate-fadeIn">Loading, please wait...</Text>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {navigating && <NavigationLoader />}
      <div className="min-h-screen bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header with action buttons */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
            <div>
              <Title level={3} className="!mb-0 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md">Domain Dashboard</Title>
              <Text className="text-gray-600">Register domains and list them on Sedo</Text>
            </div>
            <div className="flex gap-3">
              {isAdmin && (
                <Button 
                  type="primary" 
                  icon={<UserOutlined />}
                  onClick={() => {
                    setNavigating(true)
                    setTimeout(() => router.push('/admin'), 400)
                  }}
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 border-0 shadow-md hover:from-purple-600 hover:to-indigo-600"
                >
                  Admin Panel
                </Button>
              )}
              <Button 
                type="primary" 
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                className="bg-gradient-to-r from-blue-500 to-purple-500 border-0 shadow-md hover:from-blue-600 hover:to-purple-600"
              >
                Logout
              </Button>
            </div>
          </div>

          {/* Register Domain Form */}
          <Card className="rounded-2xl shadow-xl border-0 bg-white/70 backdrop-blur-md mb-8">
            <Title level={4} className="!mb-6 flex items-center text-gray-800 font-semibold">
              <PlusOutlined className="mr-2 text-blue-500" />
              Register New Domain
            </Title>
          <Form
            form={form}
            layout="vertical"
              className="mt-4"
            onFinish={showRegistrationForm}
            initialValues={{ domain: '' }}
          >
            <Form.Item
                label={<span className="text-red-500 mr-1">*</span>}
              name="domain"
                rules={[{ required: true, message: 'Please enter a domain name' }]}
                labelCol={{ span: 24 }}
                wrapperCol={{ span: 24 }}
                className="mb-0"
            >
                <Input
                  placeholder="Enter domain name (e.g., mydomain.shop)"
                  size="large"
                  className="rounded-lg shadow border-0 bg-white/80 focus:bg-white"
                  suffix={priceLoading ? <LoadingOutlined style={{ color: '#6366f1' }} /> : <SearchOutlined style={{ color: '#6366f1' }} />}
                />
            </Form.Item>
              
              <div className="flex justify-between mt-4">
              <Button
                  icon={<SearchOutlined />}
                  onClick={() => checkPrice(form.getFieldValue('domain'))}
                  disabled={priceLoading}
                loading={priceLoading}
                  className="mr-2"
                  size="large"
              >
                Check Price
              </Button>
                
              <Button
                type="primary"
                htmlType="submit"
                  disabled={!price || price >= 2 || !domainAvailable || registering}
                  loading={registering}
                  className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600"
                  style={{ fontWeight: 600, letterSpacing: 1 }}
                  size="large"
                  icon={<PlusOutlined />}
              >
                Register
              </Button>
            </div>
              
              {/* Fixed height result container to prevent layout shifts */}
              <div className="h-auto mt-4">
                {priceLoading && (
                  <div className="flex items-center bg-blue-50 text-blue-700 px-4 py-3 rounded-xl border border-blue-100 animate-fadeIn">
                    <LoadingOutlined className="mr-2" />
                    <span className="ml-3 font-medium">Checking domain availability...</span>
                  </div>
                )}
                
                {!priceLoading && showPrice && (
                  <div className="mt-4">
                      {domainAvailable === true ? (
                      price !== null && price < 2 ? (
                        <div className="rounded-md bg-green-50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <CheckCircleOutlined className="h-5 w-5 text-green-400" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-green-800">
                                Domain Available - Price Under $2!
                              </h3>
                              <div className="mt-2 text-sm text-green-700">
                                <p>{form.getFieldValue('domain')} is available for ${price} - You can register this domain!</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md bg-yellow-50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <WarningOutlined className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-yellow-800">
                                Domain Available - Price Too High
                              </h3>
                              <div className="mt-2 text-sm text-yellow-700">
                                <p>{form.getFieldValue('domain')} costs ${price} - Only domains under $2 can be registered.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                      ) : (
                        <div className="rounded-md bg-red-50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <CloseCircleOutlined className="h-5 w-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-red-800">
                                Domain Not Available
                              </h3>
                              <div className="mt-2 text-sm text-red-700">
                                <p>{error || 'This domain is already registered.'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
          </Form>
        </Card>

          {domains.length === 0 && !fetchingDomains && (
            <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md animate-fadeIn mb-8">
              <div className="bg-blue-50 text-blue-700 px-6 py-5 rounded-xl border border-blue-100">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <InfoCircleOutlined className="text-blue-500 mr-3 text-xl" />
                    <span className="font-medium">All your registered domains have been successfully listed on Sedo!</span>
                  </div>
                  <Button 
                    type="primary" 
                    icon={<SearchOutlined />}
                    onClick={() => goToSearchDomains()}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 border-0 shadow-md hover:from-blue-600 hover:to-purple-600"
                  >
                    Search Listed Domains
                  </Button>
                </div>
              </div>
            </Card>
          )}
          
          {domains.length > 0 && (
            <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md animate-fadeIn">
              <Title level={4} className="!mb-4 text-gray-800 font-semibold">Domains Needing Action</Title>
              <Text className="block text-gray-600 mb-4">
                The following domains need to be listed on Sedo. Once listed, they will be removed from this dashboard
                and can be found using the "Search Listed Domains" button.
              </Text>
          {fetchingDomains ? (
                <div className="py-10 flex flex-col items-center">
                  <ModernLoader />
                  <Text className="mt-4 text-gray-600">Loading your domains...</Text>
                </div>
          ) : (
            <List
              dataSource={domains}
              renderItem={renderDomainItem}
              className="w-full"
            />
          )}
        </Card>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-fadeIn {
          animation: fadeIn 0.5s cubic-bezier(0.4,0,0.2,1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-bounce {
          animation: bounce 0.7s infinite alternate;
        }
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-8px); }
        }
        `
      }}></style>
    </>
  )
} 