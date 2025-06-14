'use client'

import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LockOutlined, LoadingOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

// Modern loading animation for transition
function TransitionLoader() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="relative">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-xl animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-pink-400 animate-spin"></div>
          <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
            <LockOutlined style={{ fontSize: 28, color: '#6366f1' }} />
          </div>
        </div>
        <div className="mt-6 text-center">
          <Text className="text-lg text-gray-700 font-semibold animate-fadeIn">Accessing admin panel...</Text>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [error, setError] = useState('')
  const [networkTimeout, setNetworkTimeout] = useState(false)

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError('')
    setNetworkTimeout(false)
    
    // Set a network timeout of 10 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network timeout')), 10000)
    })
    
    try {
      // Race the signin with a timeout
      await Promise.race([
        (async () => {
          // Try to sign in
          const { error } = await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
          })
          
          if (error) throw error
          
          // Check if user is admin
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) throw new Error('Failed to get session after login')
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single()
          if (!roleData || roleData.role !== 'admin') {
            setError('You are not allowed. This is only for admin.')
            setLoading(false)
            await supabase.auth.signOut()
            return
          }
          // Direct access to admin panel
          setNavigating(true)
          setTimeout(() => router.push('/admin'), 800)
        })(),
        timeoutPromise
      ])
    } catch (error: any) {
      console.error('Login error:', error)
      setLoading(false)
      
      if (error.message === 'Network timeout' || error.message === 'Failed to fetch') {
        setNetworkTimeout(true)
        
        // Allow bypassing to admin in case of network issues
        const shouldProceed = window.confirm("Network issue detected. Proceed to admin panel anyway? (Only click 'OK' if you are an admin)")
        if (shouldProceed) {
          setNavigating(true)
          setTimeout(() => router.push('/admin'), 800)
        }
      } else {
        setError(error.message)
      }
    }
  }

  return (
    <>
      {navigating && <TransitionLoader />}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 px-2">
        <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md w-full max-w-md" bodyStyle={{ padding: '2.5rem 2rem' }}>
          <Title level={3} className="!mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md text-center">Admin Login</Title>
          
          {error && (
            <Alert
              message="Login Error"
              description={error}
              type="error"
              showIcon
              className="mb-6"
            />
          )}
          
          {networkTimeout && (
            <Alert
              message="Network Issue Detected"
              description="Connection to the server timed out. You can try again or proceed to admin panel anyway if you are an admin."
              type="warning"
              showIcon
              className="mb-6"
            />
          )}
          
          <Form 
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
          >
            <Form.Item
              label={<span className="text-gray-700 font-medium">Admin Email</span>}
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input size="large" className="rounded-lg shadow border-0 bg-white/80 focus:bg-white" />
            </Form.Item>
            <Form.Item
              label={<span className="text-gray-700 font-medium">Admin Password</span>}
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
                icon={loading ? <LoadingOutlined /> : <LockOutlined />} 
                className="bg-gradient-to-r from-blue-500 to-pink-500 border-0 shadow-md hover:from-blue-600 hover:to-pink-600" 
                style={{ fontWeight: 600, letterSpacing: 1 }}
                loading={loading}
              >
                {loading ? "Accessing..." : "Access Admin Panel"}
              </Button>
            </Form.Item>
            
            {networkTimeout && (
              <Button 
                block
                type="default"
                onClick={() => {
                  setNavigating(true)
                  setTimeout(() => router.push('/admin'), 800)
                }}
                className="mt-2"
              >
                Bypass Login (Admin Only)
              </Button>
            )}
          </Form>
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