'use client'

import { useState, useEffect } from 'react'
import { Card, Button, Form, AutoComplete, Spin, Typography, message, Tag, Tooltip } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  SearchOutlined, 
  LoadingOutlined, 
  DashboardOutlined, 
  LogoutOutlined,
  DollarOutlined,
  GlobalOutlined,
  UserOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import debounce from 'lodash/debounce'

const { Title, Text } = Typography

// Modern loading animation for transition
function TransitionLoader({ type = 'dashboard' }) {
  const icon = type === 'logout' ? 
    <LogoutOutlined style={{ fontSize: 28, color: '#6366f1' }} /> : 
    <DashboardOutlined style={{ fontSize: 28, color: '#6366f1' }} />
  
  const text = type === 'logout' ? 'Logging out...' : 'Loading dashboard...'
  
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="relative">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-xl animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-pink-400 animate-spin"></div>
          <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="mt-6 text-center">
          <Text className="text-lg text-gray-700 font-semibold animate-fadeIn">{text}</Text>
        </div>
      </div>
    </div>
  )
}

// Format currency for display
function formatCurrency(amount: number, currency: number) {
  const currencySymbol = currency === 0 ? '€' : currency === 1 ? '$' : '£';
  return `${currencySymbol}${amount.toLocaleString()}`;
}

export default function SearchDomainPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [navigationType, setNavigationType] = useState('dashboard')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [options, setOptions] = useState<{ value: string; label: React.ReactNode }[]>([])

  useEffect(() => {
    checkUser()
  }, [])
  
  // Check for domain parameter in URL and search for it
  useEffect(() => {
    if (!loading) {
      const domain = searchParams.get('domain')
      if (domain) {
        setSearchValue(domain)
        debouncedSearch(domain)
      }
    }
  }, [loading, searchParams])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    } finally {
      setLoading(false)
    }
  }

  // Debounced search function to call API as user types
  const debouncedSearch = debounce(async (searchText: string) => {
    if (searchText.length < 1) {
      setSearchResults([]);
      setOptions([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    
    try {
      const res = await fetch('/api/sedo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchText }),
      });
      
      const data = await res.json();
      
      if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
        setSearchResults(data.data);
        
        const formattedOptions = data.data.map((domain: any) => ({
          value: domain.domain,
          label: (
            <div className="flex items-center justify-between">
              <span className="font-medium">{domain.domain}</span>
              <div className="flex items-center">
                {domain.forsale === 1 && (
                  <Tag color="green" className="ml-2 rounded-full px-2">
                    <DollarOutlined className="mr-1" />
                    {domain.price ? formatCurrency(domain.price, domain.currency || 1) : "Listed"}
                  </Tag>
                )}
              </div>
            </div>
          ),
        }));
        
        setOptions(formattedOptions);
      } else {
        setSearchResults([]);
        setOptions([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setOptions([]);
      
      message.error({
        content: (
          <div className="flex items-center">
            <CloseCircleOutlined className="text-red-500 mr-2" />
            <span>Error searching for domains</span>
          </div>
        ),
        duration: 3
      });
    } finally {
      setSearchLoading(false);
    }
  }, 500); // Increased debounce time to 500ms

  // Handle input change and trigger search
  const handleSearch = (value: string) => {
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleSelect = (value: string) => {
    setSearchValue(value);
    const selectedDomain = searchResults.find(item => item.domain === value);
    if (selectedDomain) {
      // Removed the success message on selection
      // Just update the search value
    }
  };

  const goToDashboard = async () => {
    setNavigationType('dashboard')
    setNavigating(true)
    await new Promise(resolve => setTimeout(resolve, 400))
    router.push('/dashboard')
  }

  const handleLogout = async () => {
    try {
      setNavigationType('logout')
      setNavigating(true)
      await new Promise(resolve => setTimeout(resolve, 400))
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      router.push('/')
    } catch (error: any) {
      setNavigating(false)
      message.error(error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200">
        <div className="relative">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-xl animate-pulse"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-pink-400 animate-spin"></div>
            <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
              <SearchOutlined style={{ fontSize: 28, color: '#6366f1' }} />
            </div>
          </div>
          <div className="mt-6 text-center">
            <Text className="text-lg text-gray-700 font-semibold animate-fadeIn">Loading, please wait...</Text>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {navigating && <TransitionLoader type={navigationType} />}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 px-2">
        <div className="w-full max-w-3xl">
          <div className="flex justify-between items-center mb-8">
            <Title level={3} className="!mb-0 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md">My Sedo Domains</Title>
            <div className="flex gap-3">
              <Button 
                type="primary" 
                icon={<DashboardOutlined />} 
                onClick={goToDashboard}
                size="middle"
                className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600"
              >
                Dashboard
              </Button>
              <Button 
                type="primary" 
                icon={<LogoutOutlined />} 
                onClick={handleLogout}
                size="middle"
                className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600"
              >
                Logout
              </Button>
            </div>
          </div>
          
          <Card className="rounded-2xl shadow-xl border-0 bg-white/70 backdrop-blur-md mb-8">
            <Title level={4} className="!mb-6 flex items-center text-gray-800 font-semibold">
              <UserOutlined className="mr-2 text-blue-500" />
              Find My Listed Domains
            </Title>

            <div className="space-y-6">
              <Form layout="vertical">
                <Form.Item
                  label={<span className="text-gray-700 font-medium">Search My Listed Domains</span>}
                >
                  <AutoComplete
                    value={searchValue}
                    options={options}
                    onSelect={handleSelect}
                    onSearch={handleSearch}
                    placeholder="Type to search your Sedo-listed domains"
                    notFoundContent={searchLoading ? 
                      <Spin size="small" /> : 
                      <div className="py-2 px-3 text-yellow-700">
                        <SearchOutlined className="mr-2" />
                        No matching domains listed on Sedo
                      </div>
                    }
                    style={{ width: '100%' }}
                    className="rounded-lg shadow"
                    size="large"
                  />
                </Form.Item>
              </Form>

              {searchLoading && (
                <div className="flex items-center justify-center py-4">
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 24, color: '#6366f1' }} spin />} />
                  <span className="ml-3 text-gray-600">Searching your Sedo-listed domains...</span>
                </div>
              )}

              {!searchLoading && searchResults.length > 0 && searchValue && (
                <div className="bg-blue-50 text-blue-700 px-4 py-4 rounded-xl border border-blue-100">
                  <div className="flex items-center mb-3">
                    <UserOutlined className="text-blue-500 mr-2 text-xl" />
                    <span className="font-medium">Found {searchResults.length} of your Sedo-listed domains matching "{searchValue}"</span>
                  </div>
                  
                  <div className="text-sm text-blue-600">
                    Select a domain from the dropdown to view details.
                  </div>
                </div>
              )}
              
              {!searchLoading && searchValue && searchResults.length === 0 && (
                <div className="bg-yellow-50 text-yellow-700 px-4 py-4 rounded-xl border border-yellow-100">
                  <div className="flex items-center">
                    <SearchOutlined className="text-yellow-500 mr-2 text-xl" />
                    <span className="font-medium">No domains matching "{searchValue}" are listed on Sedo.</span>
                  </div>
                  <div className="mt-2 text-sm text-yellow-600">
                    First register domains on the Dashboard, then use the Auto-List button to list them on Sedo.
                    Once successfully listed, they will appear in search results here.
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      <style jsx global>{`
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
      `}</style>
    </>
  )
} 