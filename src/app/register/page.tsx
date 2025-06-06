'use client'

import { useState, useEffect } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Steps, message } from 'antd'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  UserAddOutlined, 
  LoadingOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  LoginOutlined,
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
            <UserAddOutlined style={{ fontSize: 28, color: '#6366f1' }} />
          </div>
        </div>
        <div className="mt-6 text-center">
          <Text className="text-lg text-gray-700 font-semibold animate-fadeIn">Creating account...</Text>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [registeredUserId, setRegisteredUserId] = useState('')
  const [approved, setApproved] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Check if the user is approved when the component mounts or when registeredUserId changes
  useEffect(() => {
    if (registeredUserId && registeredEmail) {
      checkApprovalStatus();
      
      // Save email in localStorage for login page to check
      localStorage.setItem('pendingEmail', registeredEmail);
      
      // Set up an interval to check approval status every 10 seconds
      const intervalId = setInterval(() => {
        if (!approved) {
          checkApprovalStatus();
        } else {
          clearInterval(intervalId);
        }
      }, 10000);
      
      // Clean up the interval when the component unmounts
      return () => clearInterval(intervalId);
    }
  }, [registeredUserId, registeredEmail, approved]);

  const checkApprovalStatus = async () => {
    if (!registeredEmail) return;
    
    try {
      setCheckingStatus(true);
      
      // Check user approval status
      const { data, error } = await supabase
        .from('user_approval')
        .select('status')
        .eq('email', registeredEmail)
        .single();
      
      if (error) {
        console.error('Error checking approval status:', error);
        return;
      }
      
      console.log('Approval status check:', data);
      
      if (data && data.status === 'approved') {
        setApproved(true);
        // Clear from localStorage since user is now approved
        localStorage.removeItem('pendingEmail');
        message.success('Your account has been approved! You can now log in.');
      }
    } catch (err) {
      console.error('Error checking approval status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      console.log("Attempting to sign up with:", values.email);

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      })
      
      console.log("Signup response:", { data, error });
      
      if (error) {
        console.error("Signup error:", error);
        throw error;
      }
      
      if (data?.user) {
        console.log("User created successfully:", data.user.id);
        
        // Check if user_approval entry was created via database trigger
        // If not, we'll create it manually (this is a backup in case the trigger fails)
        const { data: approvalCheck, error: checkError } = await supabase
          .from('user_approval')
          .select('id')
          .eq('user_id', data.user.id)
          .single();
          
        if (checkError || !approvalCheck) {
          console.log("Creating user_approval entry manually");
          // Insert approval record manually - status is pending by default
          await supabase
            .from('user_approval')
            .insert({
              user_id: data.user.id,
              email: values.email,
              status: 'pending'
            });
        }
        
        // Show registration success message
        setRegistered(true);
        setRegisteredEmail(values.email);
        setRegisteredUserId(data.user.id);
        setLoading(false);
        
        // Don't redirect - show pending approval message
      } else {
        console.warn("No error but user data is missing");
        setLoading(false);
        form.setFields([{ 
          name: 'password', 
          errors: ["Account created but got an unexpected response. Please try logging in."] 
        }]);
      }
    } catch (error: any) {
      console.error("Caught error during signup:", error);
      setLoading(false);
      
      // More user-friendly error messages
      let errorMessage = error.message;
      if (errorMessage.includes("Database error saving new user")) {
        errorMessage = "Unable to create account. Please check if email signups are enabled in Supabase.";
      } else if (errorMessage.includes("Email signups are disabled")) {
        errorMessage = "Email signups are currently disabled. Please contact administrator.";
      }
      
      form.setFields([{ name: 'password', errors: [errorMessage] }]);
    }
  }

  const goToLogin = () => {
    setNavigating(true);
    // Add small delay to show the loading animation
    setTimeout(() => router.push('/login'), 600);
  }

  return (
    <>
      {navigating && <TransitionLoader />}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 px-2">
        <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md w-full max-w-md" bodyStyle={{ padding: '2.5rem 2rem' }}>
          
          {registered ? (
            <div className="text-center animate-fadeIn">
              <div className="bg-green-100 inline-flex p-5 rounded-full mb-8">
                <CheckCircleOutlined className="text-3xl text-green-600" />
              </div>
              
              <Title level={2} className="!mb-3">Registration Successful!</Title>
              <Text className="text-lg block mb-8">
                {approved 
                  ? "Your account has been approved! You can now log in." 
                  : "Your account has been created and is pending approval"}
              </Text>
              
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
                  <div className={`${approved ? 'bg-blue-500' : 'bg-blue-500'} rounded-full p-1.5 flex-shrink-0 mt-0.5`}>
                    <ClockCircleOutlined className="text-white text-sm" />
                  </div>
                  <div className="ml-4 text-left">
                    <Text strong className="text-gray-800 block">Awaiting Admin Approval</Text>
                    <Text className="text-gray-600">
                      {approved 
                        ? "Your account has been approved by an administrator!" 
                        : "An admin will review and approve your account shortly."}
                    </Text>
                  </div>
                  <div className="absolute left-2.5 top-6 bottom-0 w-0.5 h-10 bg-gray-200"></div>
                </div>
                
                <div className="flex items-start mb-8">
                  <div className={`${approved ? 'bg-blue-500' : 'bg-gray-200'} rounded-full p-1.5 flex-shrink-0 mt-0.5`}>
                    <LoginOutlined className={`${approved ? 'text-white' : 'text-gray-400'} text-sm`} />
                  </div>
                  <div className="ml-4 text-left">
                    <Text strong className={`${approved ? 'text-gray-800' : 'text-gray-500'} block`}>Ready to Login</Text>
                    <Text className={`${approved ? 'text-gray-600' : 'text-gray-400'}`}>
                      {approved 
                        ? "You can now log in to access the system." 
                        : "Once approved, you can log in to access the system."}
                    </Text>
                  </div>
                </div>
              </div>

              {approved ? (
                <Button 
                  type="primary" 
                  onClick={goToLogin}
                  className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600 w-full"
                  icon={<LoginOutlined />}
                  size="large"
                >
                  Go to Login Page
                </Button>
              ) : (
                <>
                  <Button 
                    type="primary"
                    onClick={checkApprovalStatus}
                    loading={checkingStatus}
                    icon={<SyncOutlined />}
                    className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600 w-full mb-4"
                  >
                    Check Approval Status
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
          <Title level={3} className="!mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md text-center">Register</Title>
              
              <Alert
                message="Admin Approval Required"
                description="All new accounts require administrator approval before they can access the system."
                type="info"
                showIcon
                className="mb-6"
              />
        <Form 
            form={form}
          layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
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
                icon={loading ? <LoadingOutlined /> : <UserAddOutlined />} 
                className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600" 
                style={{ fontWeight: 600, letterSpacing: 1 }}
            loading={loading}
          >
                {loading ? "Creating account..." : "Register"}
          </Button>
            </Form.Item>
            <div className="text-center">
              <Link href="/login" className="text-blue-500 font-medium">
                Already have an account? Login
              </Link>
          </div>
        </Form>
            </>
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