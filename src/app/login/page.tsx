'use client'

import { useState, useEffect } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Steps, message } from 'antd'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  LoginOutlined, 
  LoadingOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  CloseCircleOutlined,
  SyncOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const { Step } = Steps

// Modern loading animation for transition
function TransitionLoader() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="relative">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-xl animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-pink-400 animate-spin"></div>
          <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
            <LoginOutlined style={{ fontSize: 28, color: '#6366f1' }} />
          </div>
        </div>
        <div className="mt-6 text-center">
          <Text className="text-lg text-gray-700 font-semibold animate-fadeIn">Logging in...</Text>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(false)
  const [rejectedUser, setRejectedUser] = useState(false)
  const [isFirstUser, setIsFirstUser] = useState(false)
  const [checkingApproval, setCheckingApproval] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [refreshingStatus, setRefreshingStatus] = useState(false)

  // Check user approval status on page load if email/user info exists in URL or localStorage
  useEffect(() => {
    const checkApprovalStatus = async () => {
      try {
        setCheckingApproval(true)
        
        // Check URL parameters first
        const urlParams = new URLSearchParams(window.location.search)
        let email = urlParams.get('email')
        
        // If no email in URL, check localStorage
        if (!email) {
          email = localStorage.getItem('pendingEmail')
        }
        
        if (!email) {
          // No email to check, just show login form
          setCheckingApproval(false)
          return
        }
        
        setUserEmail(email)
        await checkUserStatus(email)
      } catch (err) {
        console.error('Error checking approval status:', err)
        setCheckingApproval(false)
      }
    }
    
    checkIfFirstUser()
    checkApprovalStatus()
  }, [])
  
  // Function to check user status directly
  const checkUserStatus = async (email: string) => {
    try {
      setRefreshingStatus(true)
      
      // Check if this user is pending approval
      const { data, error } = await supabase
        .from('user_approval')
        .select('status')
        .eq('email', email)
        .single()
        
      if (error) {
        console.error('Error checking user status:', error)
        // If we can't find the user, clear everything and show login
        setPendingApproval(false)
        setRejectedUser(false)
        localStorage.removeItem('pendingEmail')
        return false
      }
      
      if (data) {
        if (data.status === 'pending') {
          setPendingApproval(true)
          setRejectedUser(false)
          localStorage.setItem('pendingEmail', email)
          return false
        } else if (data.status === 'rejected') {
          setPendingApproval(false)
          setRejectedUser(true)
          localStorage.removeItem('pendingEmail')
          return false
        } else if (data.status === 'approved') {
          // User is approved!
          setPendingApproval(false)
          setRejectedUser(false)
          localStorage.removeItem('pendingEmail')
          return true
        }
      } else {
        // No data found, show login
        setPendingApproval(false)
        setRejectedUser(false)
        localStorage.removeItem('pendingEmail')
      }
      
      return false
    } catch (err) {
      console.error('Error in checkUserStatus:', err)
      return false
    } finally {
      setRefreshingStatus(false)
      setCheckingApproval(false)
    }
  }
  
  // Function to refresh approval status
  const refreshApprovalStatus = async () => {
    if (!userEmail) return
    
    try {
      setRefreshingStatus(true)
      const isApproved = await checkUserStatus(userEmail)
      
      if (isApproved) {
        message.success('Your account has been approved! You can now log in.')
      }
    } catch (err) {
      console.error('Error refreshing approval status:', err)
    } finally {
      setRefreshingStatus(false)
    }
  }

  const checkIfFirstUser = async () => {
    try {
      // Count users in user_roles
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        console.error('Error checking user count:', error)
        return
      }
      
      // If there's only one user role record, this might be the first admin
      setIsFirstUser(!error && count === 1)
    } catch (e) {
      console.error('Error checking first user:', e)
    }
  }

  const goToAdminPanel = () => {
    setNavigating(true)
    // Small delay to show the loading animation
    setTimeout(() => router.push('/admin'), 800)
  }

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    setPendingApproval(false)
    setRejectedUser(false)
    
    try {
      // Save email for potential pending check later
      setUserEmail(values.email)
      
      // Try to sign in
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })
      
      if (error) {
        throw error
      }
      
      // Check user approval status
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Failed to get session after login')
      }
      
      // Check if user is approved
      const { data: approvalData, error: approvalError } = await supabase
        .from('user_approval')
        .select('status')
        .eq('user_id', session.user.id)
        .single()
      
      if (approvalError) {
        throw approvalError
      }
      
      if (approvalData.status === 'pending') {
        // User is pending approval
        await supabase.auth.signOut()
        setPendingApproval(true)
        localStorage.setItem('pendingEmail', values.email) // Save for future checks
        setLoading(false)
        return
      } else if (approvalData.status === 'rejected') {
        // User was rejected
        await supabase.auth.signOut()
        setRejectedUser(true)
        setLoading(false)
        return
      }
      
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()
      
      // Show navigation loader before redirecting
      setNavigating(true)
      
      // Small delay to show the loading animation
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Redirect based on role
      if (roleData?.role === 'admin') {
        router.push('/admin')
      } else {
      router.push('/search-domain')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setLoading(false)
      form.setFields([{ name: 'password', errors: [error.message] }])
    }
  }

  return (
    <>
      {navigating && <TransitionLoader />}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 px-2">
        <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md w-full max-w-md" bodyStyle={{ padding: '2.5rem 2rem' }}>
          <Title level={3} className="!mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md text-center">Login</Title>
          
          {checkingApproval && (
            <div className="py-10 flex flex-col items-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-xl animate-pulse"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-pink-400 animate-spin"></div>
              </div>
              <Text className="mt-4 text-gray-600">Checking approval status...</Text>
            </div>
          )}
          
          {!checkingApproval && pendingApproval && (
            <div className="text-center animate-fadeIn mb-6">
              <div className="bg-amber-50 inline-flex p-5 rounded-full mb-5">
                <ClockCircleOutlined className="text-3xl text-amber-500" />
              </div>
              
              <Title level={3} className="!mb-2">Account Pending Approval</Title>
              <Text className="text-gray-500 block mb-8">Your account is awaiting administrator approval</Text>
              
              <div className="px-2">
                <div className="flex items-start mb-6">
                  <div className="bg-blue-500 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                    <CheckCircleOutlined className="text-white text-sm" />
                  </div>
                  <div className="ml-4 text-left">
                    <Text strong className="text-gray-800 block">Account Created</Text>
                    <Text className="text-gray-600">Your account has been created successfully.</Text>
                  </div>
                </div>
                
                <div className="flex items-start mb-6 relative">
                  <div className="bg-blue-500 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                    <ClockCircleOutlined className="text-white text-sm" />
                  </div>
                  <div className="ml-4 text-left">
                    <Text strong className="text-gray-800 block">Awaiting Admin Approval</Text>
                    <Text className="text-gray-600">An admin will review and approve your account shortly.</Text>
                  </div>
                  <div className="absolute left-2.5 top-6 bottom-0 w-0.5 h-10 bg-gray-200"></div>
                </div>
                
                <div className="flex items-start mb-8">
                  <div className="bg-gray-200 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                    <LoginOutlined className="text-gray-400 text-sm" />
                  </div>
                  <div className="ml-4 text-left">
                    <Text strong className="text-gray-500 block">Ready to Login</Text>
                    <Text className="text-gray-400">Once approved, you can log in to access the system.</Text>
                  </div>
                </div>
              </div>

              {isFirstUser && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-left mb-6">
                  <Text strong className="text-blue-700 block mb-2">
                    First Admin User?
                  </Text>
                  <Text className="text-blue-600">
                    If you're the first user to register and are supposed to be an admin, 
                    you need to approve yourself through the admin panel.
                  </Text>
                  <Button 
                    type="primary"
                    onClick={goToAdminPanel}
                    className="mt-3 bg-gradient-to-r from-blue-500 to-purple-500 border-0 shadow-md hover:from-blue-600 hover:to-purple-600 w-full"
                    icon={<UserOutlined />}
                  >
                    Go to Admin Panel
                  </Button>
                </div>
              )}
              
              <Button 
                type="primary"
                onClick={refreshApprovalStatus}
                loading={refreshingStatus}
                icon={<SyncOutlined />}
                className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600 w-full mb-4"
              >
                Check Approval Status
              </Button>
              
              <Button 
                onClick={() => {
                  setPendingApproval(false)
                  setUserEmail('')
                  localStorage.removeItem('pendingEmail')
                  form.resetFields()
                }}
                className="border-blue-200 text-blue-600 hover:text-blue-700 hover:border-blue-300"
              >
                Try different account
              </Button>
            </div>
          )}
          
          {!checkingApproval && rejectedUser && (
            <div className="text-center animate-fadeIn mb-6">
              <div className="bg-red-50 inline-flex p-5 rounded-full mb-5">
                <CloseCircleOutlined className="text-3xl text-red-500" />
              </div>
              
              <Title level={3} className="!mb-2">Account Access Denied</Title>
              <Text className="text-gray-500 block mb-6">Your account registration was rejected</Text>
              
              <Button 
                onClick={() => {
                  setRejectedUser(false)
                  setUserEmail('')
                  localStorage.removeItem('pendingEmail')
                  form.resetFields()
                }}
                className="border-blue-200 text-blue-600 hover:text-blue-700 hover:border-blue-300"
              >
                Try different account
              </Button>
            </div>
          )}
          
          {!checkingApproval && !pendingApproval && !rejectedUser && (
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
              initialValues={{ email: userEmail }}
          >
            <Form.Item
              label={<span className="text-gray-700 font-medium">Email</span>}
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input size="large" className="rounded-lg shadow border-0 bg-white/80 focus:bg-white" />
            </Form.Item>
            <Form.Item
              label={<span className="text-gray-700 font-medium">Password</span>}
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password size="large" className="rounded-lg shadow border-0 bg-white/80 focus:bg-white" />
            </Form.Item>
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                block 
                size="large" 
                icon={loading ? <LoadingOutlined /> : <LoginOutlined />} 
                className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600" 
                style={{ fontWeight: 600, letterSpacing: 1 }}
                loading={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </Button>
            </Form.Item>
            <div className="text-center">
              <Link href="/register" className="text-blue-500 font-medium">
                Don't have an account? Register
              </Link>
            </div>
          </Form>
          )}
        </Card>
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
        `
      }}></style>
    </>
  )
} 