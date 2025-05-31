'use client'

import { useState } from 'react'
import { Form, Input, Button, Card, Typography } from 'antd'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserAddOutlined, LoadingOutlined } from '@ant-design/icons'

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

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      })
      if (error) throw error
      
      // Show navigation loader before redirecting
      setNavigating(true)
      
      // Small delay to show the loading animation
      await new Promise(resolve => setTimeout(resolve, 800))
      
      router.push('/login')
    } catch (error: any) {
      setLoading(false)
      form.setFields([{ name: 'password', errors: [error.message] }])
    }
  }

  return (
    <>
      {navigating && <TransitionLoader />}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 px-2">
        <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md w-full max-w-md" bodyStyle={{ padding: '2.5rem 2rem' }}>
          <Title level={3} className="!mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md text-center">Register</Title>
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
      </Card>
    </div>
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s cubic-bezier(0.4,0,0.2,1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
} 