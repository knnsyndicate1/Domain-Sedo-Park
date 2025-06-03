'use client'

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Typography, Divider } from 'antd';
import { GlobalOutlined, LoginOutlined, UserAddOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

// Modern loading animation for transition
function TransitionLoader({ type = 'login' }) {
  const icon = type === 'register' ? 
    <UserAddOutlined style={{ fontSize: 28, color: '#6366f1' }} /> : 
    type === 'admin' ?
    <LockOutlined style={{ fontSize: 28, color: '#6366f1' }} /> :
    <LoginOutlined style={{ fontSize: 28, color: '#6366f1' }} />
  
  const text = type === 'register' ? 'Creating account...' : 
               type === 'admin' ? 'Accessing admin...' : 'Logging in...';
  
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

export default function Home() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [navigationType, setNavigationType] = useState('login');

  const handleNavigation = async (path: string, type: string) => {
    setNavigationType(type);
    setNavigating(true);
    // Add small delay to show the loading animation
    await new Promise(resolve => setTimeout(resolve, 800));
    router.push(path);
  };

  return (
    <>
      {navigating && <TransitionLoader type={navigationType} />}
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 px-4 py-8">
        <div className="max-w-3xl w-full text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 opacity-30 blur-lg animate-pulse"></div>
            <div className="relative">
              <GlobalOutlined style={{ fontSize: 40, color: '#6366f1' }} />
            </div>
          </div>
          <Title level={2} className="!mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md">
            Domain Register + Sedo Listing Tool
          </Title>
          <Text className="text-lg text-gray-700 block mb-6 max-w-xl mx-auto">
            Register and manage your domains with automated Namecheap registration and Sedo listing.
          </Text>
        </div>
        
        <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md w-full max-w-2xl">
          <div className="py-4">
            <Title level={4} className="!mb-6 text-center text-gray-800 font-semibold">
              Streamline Your Domain Management
            </Title>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <GlobalOutlined className="text-blue-500 text-lg" />
                  </div>
                  <Text strong className="text-lg">Domain Registration</Text>
                </div>
              </div>
              
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-100">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-500 w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3z M12 8v8m-4-4h8" />
                    </svg>
                  </div>
                  <Text strong className="text-lg">Sedo Integration</Text>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button 
                type="primary" 
                size="large"
                icon={<LoginOutlined />}
                onClick={() => handleNavigation('/login', 'login')}
                className="bg-gradient-to-r from-blue-500 to-purple-500 border-0 shadow-md hover:from-blue-600 hover:to-purple-600 min-w-[150px]"
              >
                Login
              </Button>
              
              <Button 
                type="primary" 
                size="large"
                icon={<UserAddOutlined />}
                onClick={() => handleNavigation('/register', 'register')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 shadow-md hover:from-purple-600 hover:to-pink-600 min-w-[150px]"
              >
                Register
              </Button>
            </div>
            
            <Divider className="my-6">
              <Text className="text-gray-500">Admin Access</Text>
            </Divider>
            
            <div className="flex justify-center">
              <Button 
                size="large"
                icon={<LockOutlined />}
                onClick={() => handleNavigation('/admin-login', 'admin')}
                className="bg-gradient-to-r from-gray-600 to-gray-800 text-white border-0 shadow-md hover:from-gray-700 hover:to-gray-900 min-w-[150px]"
              >
                Admin Login
              </Button>
            </div>
          </div>
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
        .animate-bounce {
          animation: bounce 0.7s infinite alternate;
        }
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-8px); }
        }
      `}</style>
    </>
  );
} 