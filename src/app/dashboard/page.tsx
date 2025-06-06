'use client'

import { useEffect, useState } from 'react'
import { Card, Button, message, Form, Input, List, Tag, Alert, Empty, Typography, Avatar, Spin } from 'antd'
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
  UserOutlined
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

  // Validate TLD
  const isValidTLD = (domain: string) => {
    return domain.endsWith('.shop') || domain.endsWith('.click')
  }

  // Real price check using Namecheap API
  const checkPrice = async (domain: string) => {
    setPriceLoading(true)
    setError(null)
    setPrice(null)
    setDomainAvailable(null)
    setShowPrice(false) // Don't show price section until we're certain
    
    // Normalize domain for consistent checks (lowercase and trim)
    const normalizedDomain = domain.toLowerCase().trim();
    
    try {
      // Check for internet connection first
      if (!navigator.onLine) {
        setError('Unable to check price: You are offline')
        message.error({
          content: (
            <div className="flex items-center">
              <CloseCircleOutlined className="text-red-500 mr-2" />
              <div>
                <div className="font-bold">Network Error</div>
                <div className="text-sm">Please check your internet connection and try again.</div>
              </div>
            </div>
          ),
          duration: 5
        });
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
          
          message.error({
            content: (
              <div className="flex items-center">
                <CloseCircleOutlined className="text-red-500 mr-2" />
                <div>
                  <div className="font-bold">Domain Already Registered</div>
                  <div className="text-sm">
                    {ownedByUser ? 
                      "You've already registered this domain in your account." : 
                      "This domain is already registered in our system."}
                  </div>
                </div>
              </div>
            ),
            duration: 5
          });
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
          throw new Error(`Price API returned status ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Price API response:', data);
        
        // If price API returns an error or domain is not available
        if (data.error || !data.available) {
          setError(data.error || 'Domain is not available')
          setPrice(null)
          setDomainAvailable(false)
          setShowPrice(true)
          
          message.error({
            content: (
              <div className="flex items-center">
                <CloseCircleOutlined className="text-red-500 mr-2" />
                <div>
                  <div className="font-bold">Domain Not Available</div>
                  <div className="text-sm">This domain is already registered and not available.</div>
                </div>
              </div>
            ),
            duration: 5
          });
        } else {
          // Domain is available and we have a price!
          console.log(`SUCCESS: Domain ${normalizedDomain} is available for $${data.price}`);
          setPrice(data.price)
          setDomainAvailable(true)
          setShowPrice(true)
          setError(null)
          
          // Show success message for available domains
          message.success({
            content: (
              <div className="flex items-center">
                <CheckCircleOutlined className="text-green-500 mr-2" />
                <div>
                  <div className="font-bold">Domain Available!</div>
                  <div className="text-sm">
                    {normalizedDomain} is available for ${data.price}
                  </div>
                </div>
              </div>
            ),
            duration: 5
          });
        }
      } catch (error: any) {
        console.error('Price check error:', error);
        
        // Show appropriate error message
        setError('Failed to check price')
        setPrice(null)
        setDomainAvailable(null)
        setShowPrice(true)
        
        const isAbortError = error.name === 'AbortError';
        const isNetworkError = !navigator.onLine || 
          (typeof error.message === 'string' && (
            error.message.includes('network') || 
            error.message.includes('fetch') || 
            error.message.includes('connect')
          ));
        
        message.error({
          content: (
            <div className="flex items-center">
              <CloseCircleOutlined className="text-red-500 mr-2" />
              <div>
                <div className="font-bold">{isAbortError ? 'Timeout Error' : 'Connection Error'}</div>
                <div className="text-sm">{isAbortError ? 
                  'Request timed out. Server may be busy.' : 
                  'Unable to connect to domain registration service.'}</div>
              </div>
            </div>
          ),
          duration: 5
        });
      }
    } catch (error: any) {
      console.error('Overall domain check error:', error);
      setError('Failed to check domain availability')
      setPrice(null)
      setDomainAvailable(null)
      setShowPrice(true)
      
      message.error({
        content: (
          <div className="flex items-center">
            <CloseCircleOutlined className="text-red-500 mr-2" />
            <div>
              <div className="font-bold">Error</div>
              <div className="text-sm">Failed to check domain availability. Please try again.</div>
            </div>
          </div>
        ),
        duration: 5
      });
    } finally {
      setPriceLoading(false)
    }
  }

  // Show registration modal
  const showRegistrationForm = () => {
    const domain = form.getFieldValue('domain')
    
    // Check for internet connection first
    if (!navigator.onLine) {
      message.error({
        content: (
          <div className="flex items-center">
            <CloseCircleOutlined className="text-red-500 mr-2" />
            <div>
              <div className="font-bold">Network Error</div>
              <div className="text-sm">Please check your internet connection and try again.</div>
            </div>
          </div>
        ),
        duration: 5,
      });
      return;
    }
    
    setDomainToRegister(domain)
    
    console.log('Starting domain registration for:', domain)
    // Directly register with fixed company details
    onRegister()
  }

  // Register domain using Namecheap API and update Supabase
  const onRegister = async () => {
    if (!domainToRegister) {
      console.error('No domain to register');
      return;
    }
    
    // Normalize domain to lowercase for consistent comparison
    const normalizedDomain = domainToRegister.toLowerCase().trim();
    
    console.log(`Registering domain: ${normalizedDomain}`);
    setRegistering(true);
    setError(null);
    
    // Check for internet connection first
    if (!navigator.onLine) {
      message.error({
        content: (
          <div className="flex items-center">
            <CloseCircleOutlined className="text-red-500 mr-2" />
            <div>
              <div className="font-bold">Network Error</div>
              <div className="text-sm">Please check your internet connection and try again.</div>
            </div>
          </div>
        ),
        duration: 5,
      });
      setRegistering(false);
      return;
    }
    
    try {
      // Double-check if domain exists across ALL users (system-wide)
      const { data: existingSystemDomain, error: systemSearchError } = await supabase
        .from('domains')
        .select('id, domain, status, user_id')
        .eq('domain', normalizedDomain);
      
      if (existingSystemDomain && existingSystemDomain.length > 0) {
        // Domain exists in the system
        const isOwnedByCurrentUser = existingSystemDomain.some(d => d.user_id === userId);
        
        if (isOwnedByCurrentUser) {
          // Domain belongs to current user
          const existingDomain = existingSystemDomain.find(d => d.user_id === userId);
          if (existingDomain && existingDomain.status === 'registered') {
            // Domain already registered by current user, show auto-list button
            message.info({
              content: (
                <div className="flex flex-col">
                  <div className="flex items-center mb-2">
                    <InfoCircleOutlined className="text-blue-500 mr-2" />
                    <span>You already own this domain. You can list it on Sedo.</span>
                  </div>
                </div>
              ),
              duration: 5,
              key: `domain-exists-${existingDomain.id}`
            });
            setRegistering(false);
            return;
          }
        } else {
          // Domain belongs to another user
          message.error({
            content: (
              <div className="flex items-center">
                <CloseCircleOutlined className="text-red-500 mr-2" />
                <div>
                  <div className="font-bold">Domain Already Registered</div>
                  <div className="text-sm">This domain is already registered in our system.</div>
                </div>
              </div>
            ),
            duration: 5
          });
          setRegistering(false);
          return;
        }
      }
      
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
          message.info({
            content: (
              <div className="flex flex-col">
                <div className="flex items-center mb-2">
                  <InfoCircleOutlined className="text-blue-500 mr-2" />
                  <span>Domain <strong>{normalizedDomain}</strong> is already registered!</span>
                </div>
                <div className="mt-3 flex justify-center">
                  <Button 
                    type="primary"
                    onClick={() => {
                      message.destroy(); // Close this message
                      handleAutoListOnSedo(normalizedDomain, existingDomain.id);
                    }}
                    icon={<CloudUploadOutlined />}
                    size="large"
                    className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600"
                    style={{ fontWeight: 600, padding: '0 20px', height: '40px' }}
                  >
                    Auto-Sedo Listing
                  </Button>
                </div>
              </div>
            ),
            duration: 0, // Don't auto-close
            key: `auto-list-${existingDomain.id}`,
          });
          setRegistering(false);
          return;
        }
      }
      
      // Insert as pending first
      console.log('Inserting domain into database with pending status...');
      const { data: inserted, error: insertError } = await supabase.from('domains').insert([
        {
          user_id: userId,
          domain: normalizedDomain,
          status: 'pending',
          sedo_listed: false,
        },
      ]).select();
      
      if (insertError) {
        console.error('Error inserting domain:', insertError);
        throw insertError;
      }
      
      console.log('Domain inserted successfully:', inserted);
      const newDomain = (inserted as Domain[])[0];
      setDomains([newDomain, ...domains]);

      // Call Namecheap registration API with fixed company details
      console.log('Calling Namecheap registration API...');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('Request timeout'), 30000);
        
        const res = await fetch('/api/namecheap/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: normalizedDomain }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`API Error Response (${res.status}):`, errorText);
          
          // Add specific handling for connection errors
          if (res.status === 401) {
            throw new Error('Connection error: API authentication failed. Please try again later.');
          } else {
            throw new Error(`Registration API returned status ${res.status}`);
          }
        }
        
        const regData = await res.json();
        console.log('Registration data:', regData);
        
        let newStatus = regData.status;
        
        // Update status and nameservers in Supabase
        console.log('Updating domain status in database...');
        await supabase.from('domains').update({ 
          status: newStatus,
          nameservers: regData.nameservers || ''
        }).eq('id', newDomain.id);
        
        // Update domains in state
        setDomains(prevDomains => prevDomains.map(d => 
          d.id === newDomain.id 
            ? { 
                ...d, 
                status: newStatus,
                nameservers: regData.nameservers || '' 
              } 
            : d
        ));
        
        if (regData.status === 'registered') {
          console.log('Domain registration successful');
          message.success({
            content: (
              <div className="flex items-center">
                <CheckCircleOutlined className="text-green-500 mr-2" />
                <span>Domain <strong>{normalizedDomain}</strong> registered successfully!</span>
              </div>
            ),
            duration: 5,
            key: `registered-${newDomain.id}`,
          });
          
          fetchDomains(); // Refresh the domains list
      } else if (regData.status === 'failed') {
          // Display detailed error message
          console.error('Registration failed:', regData.error);
          const errorMessage = regData.error || 'Registration failed.';
          setError(errorMessage);
          
          // Show error in a more prominent way
          message.error({
            content: (
              <div className="flex items-center">
                <CloseCircleOutlined className="text-red-500 mr-2" />
                <div>
                  <div className="font-bold">Registration Failed</div>
                  <div className="text-sm">{errorMessage}</div>
                </div>
              </div>
            ),
            duration: 8, // Show longer so user can read it
          });
          
          // Remove the domain from the database if it failed to register
          console.log('Removing failed domain from database...');
          await supabase.from('domains').delete().eq('id', newDomain.id);
          
          // Update the UI state to remove the failed domain
          setDomains(prevDomains => prevDomains.filter(d => d.id !== newDomain.id));
      } else {
          console.log('Registration status:', regData.status);
          message.info({
            content: 'Registration submitted, check status later.',
            icon: <LoadingOutlined />,
          });
        }
      } catch (fetchError: any) {
        console.error('Fetch error during registration:', fetchError);
        
        const isAbortError = fetchError.name === 'AbortError';
        const isNetworkError = !navigator.onLine || fetchError.message?.includes('network') || 
          fetchError.message?.includes('fetch') || fetchError.message?.includes('connect') || 
          fetchError.message?.includes('Connection error');
        
        const errorTitle = isAbortError ? "Registration Timeout" : 
                          isNetworkError ? "Connection Error" : "Registration Error";
        
        const errorDescription = isAbortError ? "Registration request took too long. The server might be busy." : 
                                isNetworkError ? "Failed to connect to registration service" : 
                                fetchError.message || "Failed to connect to registration service";
        
        // Show error with retry button
        message.error({
          content: (
            <div className="flex flex-col">
              <div className="flex items-center">
                <CloseCircleOutlined className="text-red-500 mr-2" />
                <div>
                  <div className="font-bold">{errorTitle}</div>
                  <div className="text-sm">{errorDescription}</div>
                </div>
              </div>
              <div className="mt-3 flex justify-center">
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={() => {
                    message.destroy(`reg-error-${normalizedDomain}`);
                    setTimeout(() => onRegister(), 500);
                  }}
                >
                  Retry Registration
                </Button>
              </div>
            </div>
          ),
          duration: 0,  // Keep showing until user takes action
          key: `reg-error-${normalizedDomain}`,
        });
        
        // Do NOT remove the domain from the database yet to allow for retry
        // Just update its status to indicate error
        await supabase.from('domains').update({ 
          status: 'error',
          nameservers: 'Registration error: connection failed'
        }).eq('id', newDomain.id);
        
        setRegistering(false);
        return;
      }
      
      form.resetFields();
      setPrice(null);
      setDomainAvailable(null);
      setShowPrice(false);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message);
      message.error({
        content: (
          <div className="flex items-center">
            <CloseCircleOutlined className="text-red-500 mr-2" />
            <div>
              <div className="font-bold">Registration Error</div>
              <div className="text-sm">{err.message}</div>
            </div>
          </div>
        ),
        duration: 5,
      });
    } finally {
      setRegistering(false);
    }
  };

  // Auto list on Sedo and mark as listed
  const handleAutoListOnSedo = async (domain: string, domainId: string) => {
    setSelectedDomain(domain);
    setAutoListingInProgress(true);
    
    try {
      // Show a more elegant loading message with the domain
      message.loading({
        content: (
          <div className="flex items-center">
            <div className="mr-3">
              <div className="w-3 h-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            </div>
            <span>Listing <strong>{domain}</strong> on Sedo...</span>
          </div>
        ),
        key: domain,
        duration: 0
      });
      
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
      
      if (data.success) {
        // Update the database
        const { error } = await supabase
          .from('domains')
          .update({ 
            sedo_listed: true,
            nameservers: data.nameservers || 'ns1.sedoparking.com, ns2.sedoparking.com'
          })
          .eq('id', domainId);
          
        if (error) {
          message.error({ content: 'Failed to update database', key: domain });
        } else {
          // Store domain in localStorage for simulating listed domains in searches
          try {
            if (typeof window !== 'undefined') {
              // Add to localStorage for search simulation
              const domainData = {
                domain: domain,
                price: 0, // Price set to 0 as not for sale
                currency: 1, // USD
                forsale: 0, // Not for sale (set to 0)
                fixedprice: 0, // Not fixed price
                sedo_listed: true
              };
              
              // Get existing domains or initialize empty array
              const existingDomainsString = localStorage.getItem('listed_domains');
              let existingDomains = [];
              
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
              
              // Add new domain if it doesn't exist already
              if (!existingDomains.some(d => d.domain === domain)) {
                existingDomains.push(domainData);
                localStorage.setItem('listed_domains', JSON.stringify(existingDomains));
                console.log(`Added domain ${domain} to localStorage for search simulation`);
              }
            }
          } catch (e) {
            console.error('Error saving domain to localStorage:', e);
          }
          
          // Immediately remove domain from the UI
          setDomains(prevDomains => prevDomains.filter(d => d.id !== domainId));
          
          // Show success message
          message.success({ 
            content: (
              <div className="flex items-center">
                <CheckCircleOutlined className="text-green-500 mr-2" />
                <span><strong>{domain}</strong> successfully listed on Sedo!</span>
              </div>
            ),
            duration: 3,
            key: domain
          });
          
          // DO NOT automatically redirect - let user explicitly click search button if desired
          // This fixes the issue where domain disappears before user sees it's listed
        }
      } else {
        message.error({ 
          content: (
            <div className="flex items-center">
              <CloseCircleOutlined className="text-red-500 mr-2" />
              <div>
                <div className="font-bold">Sedo Listing Failed</div>
                <div className="text-sm">{data.error || "Could not list domain on Sedo. Please try again."}</div>
              </div>
            </div>
          ), 
          key: domain,
          duration: 5
        });
      }
    } catch (error: any) {
      console.error('Error listing domain on Sedo:', error);
      
      // Show a retry option for connection errors
      message.error({ 
        content: (
          <div className="flex flex-col">
            <div className="flex items-center">
              <CloseCircleOutlined className="text-red-500 mr-2" />
              <div>
                <div className="font-bold">Connection Error</div>
                <div className="text-sm">Failed to connect to registration service</div>
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <Button
                type="primary"
                icon={<SyncOutlined />}
                onClick={() => {
                  message.destroy(domain);
                  setTimeout(() => handleAutoListOnSedo(domain, domainId), 500);
                }}
              >
                Retry Registration
              </Button>
            </div>
          </div>
        ), 
        key: domain,
        duration: 0  // Don't auto-close so user can retry
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

  // Add a function to immediately fix any domains with sedo nameservers by marking them as listed
  const fixSedoListedDomains = async () => {
    try {
      // Find all domains with Sedo nameservers but not marked as listed
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('status', 'registered')
        .eq('sedo_listed', false)
        .or('nameservers.ilike.%sedoparking.com%,nameservers.ilike.%sedo%');
      
      if (error) {
        console.error('Error finding domains to fix:', error);
        return;
      }
      
      console.log(`Found ${data?.length || 0} domains with Sedo nameservers that need fixing`);
      
      // Update each domain to be marked as listed
      if (data && data.length > 0) {
        for (const domain of data) {
          const { error: updateError } = await supabase
            .from('domains')
            .update({ sedo_listed: true })
            .eq('id', domain.id);
            
          if (updateError) {
            console.error(`Error updating domain ${domain.domain}:`, updateError);
          } else {
            console.log(`Fixed domain ${domain.domain} to be marked as sedo_listed`);
          }
        }
        
        // After fixing, refresh the domains list
        fetchDomains();
      }
    } catch (err) {
      console.error('Error fixing domains:', err);
    }
  };

  // Call the fix function when the component mounts
  useEffect(() => {
    if (userId) {
      fixSedoListedDomains();
    }
  }, [userId]);

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

          {/* Domain registration form */}
          <Card className="rounded-2xl shadow-xl border-0 bg-white/70 backdrop-blur-md mb-8">
            <Title level={4} className="!mb-6 flex items-center text-gray-800 font-semibold">
              <PlusOutlined className="mr-2 text-blue-500" />
              Register New Domain
            </Title>
          <Form
            form={form}
            layout="vertical"
            onFinish={showRegistrationForm}
            initialValues={{ domain: '' }}
          >
            <Form.Item
              name="domain"
                label={<span className="text-gray-700 font-medium">Domain Name</span>}
              rules={[
                { required: true, message: 'Please enter a domain name' },
                {
                  validator: (_, value) =>
                    !value || isValidTLD(value)
                      ? Promise.resolve()
                      : Promise.reject('Only .shop or .click domains allowed'),
                },
              ]}
            >
                <Input
                  placeholder="e.g. mybrand.shop"
                  size="large"
                  className="rounded-lg shadow border-0 bg-white/80 focus:bg-white"
                  suffix={priceLoading ? <LoadingOutlined style={{ color: '#6366f1' }} /> : <SearchOutlined style={{ color: '#6366f1' }} />}
                  style={{ fontWeight: 500 }}
                />
            </Form.Item>
              <div className="flex gap-3">
              <Button
                type="default"
                onClick={() => {
                  const domain = form.getFieldValue('domain')
                  if (isValidTLD(domain)) checkPrice(domain)
                  else setError('Only .shop or .click domains allowed')
                }}
                loading={priceLoading}
                  className="bg-gradient-to-r from-blue-400 to-purple-400 border-0 shadow-md hover:from-blue-500 hover:to-purple-500 text-white"
                  size="large"
                  style={{ fontWeight: 500 }}
                  icon={<SearchOutlined />}
              >
                Check Price
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                disabled={!price || price >= 2 || !domainAvailable}
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
                    <SearchLoader />
                    <span className="ml-3 font-medium">Checking domain availability...</span>
                  </div>
                )}
                
                {!priceLoading && showPrice && (
                  <div className="mt-4">
                    <div className="mb-4">
                      {domainAvailable === true ? (
                        <div className="rounded-md bg-green-50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <CheckCircleOutlined className="h-5 w-5 text-green-400" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-green-800">
                                Domain Available
                              </h3>
                              <div className="mt-2 text-sm text-green-700">
                                <p>{form.getFieldValue('domain')} is available for ${price}</p>
                              </div>
                            </div>
                          </div>
                        </div>
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
              renderItem={item => (
                <List.Item className="p-4 border border-gray-100 rounded-xl mb-3 bg-white/90 hover:shadow-lg transition-shadow">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center w-full">
                      <Avatar size={48} className="bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 text-white font-bold flex-shrink-0">
                        {item.domain.charAt(0).toUpperCase()}
                      </Avatar>
                      <div className="ml-4 flex-grow">
                        <Text strong className="text-lg text-gray-800 block font-semibold">{item.domain}</Text>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Tag color="success" className="rounded-full px-3 border-0 bg-green-100 text-green-700">
                            registered
                          </Tag>
                          <Tag color="default" className="rounded-full px-3 border-0 bg-gray-100 text-gray-700">
                            {/* Display registration date + 1 year for expiration */}
                            {item.created_at && new Date(new Date(item.created_at).setFullYear(new Date(item.created_at).getFullYear() + 1)).toLocaleDateString()}
                          </Tag>
                        </div>
                    </div>
                      {/* Always show the Auto-Sedo-List button for registered domains */}
                      <Button
                        type="primary"
                        className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600 ml-auto"
                        onClick={() => handleAutoListOnSedo(item.domain, item.id)}
                        icon={<CloudUploadOutlined />}
                        loading={autoListingInProgress && selectedDomain === item.domain}
                        size="large"
                        style={{ fontWeight: 600, padding: '0 18px', height: '40px' }}
                      >
                        Auto-Sedo Listing
                      </Button>
                    </div>
                    {item.nameservers && (
                      <div className="mt-1 text-sm text-gray-500">
                        Nameservers: {item.nameservers}
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
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