'use client'

import { useEffect, useState } from 'react'
import { Card, Button, message, List, Tag, Typography, Tabs, Spin, Modal, Alert } from 'antd'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  UserOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  LockOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const { TabPane } = Tabs

type ApprovalUser = {
  id: string
  user_id: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  created_at: string
  updated_at: string
}

// Add new type for user management
interface UserRole {
  user_id: string;
  email: string;
  role: 'user' | 'admin';
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingUsers, setPendingUsers] = useState<ApprovalUser[]>([])
  const [approvedUsers, setApprovedUsers] = useState<ApprovalUser[]>([])
  const [rejectedUsers, setRejectedUsers] = useState<ApprovalUser[]>([])
  const [processingUser, setProcessingUser] = useState<string | null>(null)
  const [approvingUser, setApprovingUser] = useState<string | null>(null)
  const [rejectingUser, setRejectingUser] = useState<string | null>(null)
  const [navigating, setNavigating] = useState(false)
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Message configuration to prevent multiple messages
  const messageKey = 'userActionMessage'

  useEffect(() => {
    checkAdminStatus()
    
    // Refresh user roles every 5 seconds to catch any changes
    const refreshInterval = setInterval(() => {
      if (isAdmin) {
        fetchUserRoles();
      }
    }, 5000);
    
    // Clean up interval on unmount
    return () => clearInterval(refreshInterval);
  }, [isAdmin]);
  
  // Additional useEffect to fetch users and roles after admin status is confirmed
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      ensureUserRoles(); // This will also call fetchUserRoles after ensuring roles
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout')), 8000)
      })
      
      try {
        await Promise.race([
          (async () => {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session) {
              router.push('/login')
              return
            }
            
            setCurrentUserId(session.user.id)
            // Check if user is admin
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .single()
            
            if (!roleData || roleData.role !== 'admin') {
              message.error('You do not have admin permissions')
              router.push('/dashboard')
              return
            }
            
            setIsAdmin(true)
            fetchUsers()
            fetchUserRoles()
          })(),
          timeoutPromise
        ])
      } catch (error: any) {
        // If we got a timeout, show the bypass option
        if (error.message === 'Network timeout' || error.message === 'Failed to fetch') {
          Modal.confirm({
            title: 'Network Connection Issues',
            content: 'Failed to verify admin status due to network issues. Do you want to access admin features anyway? (Only choose "Yes" if you are an admin)',
            onOk: () => {
              setIsAdmin(true)
              // Use preset data or empty data
              setPendingUsers([])
              setApprovedUsers([])
              setRejectedUsers([])
              setUserRoles([])
            }
          })
        } else {
          throw error
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      message.error('Failed to verify admin status')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_approval')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        setPendingUsers(data.filter(user => user.status === 'pending'))
        setApprovedUsers(data.filter(user => user.status === 'approved'))
        setRejectedUsers(data.filter(user => user.status === 'rejected'))
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      message.error('Failed to load users')
    }
  }

  // Fetch all user roles for admin management
  const fetchUserRoles = async () => {
    try {
      // Get all approved users first
      const { data: approvedUsers, error: approvedError } = await supabase
        .from('user_approval')
        .select('user_id, email')
        .eq('status', 'approved');
      
      if (approvedError) throw approvedError;
      console.log('Approved users:', approvedUsers);
      
      // Then get all existing roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;
      console.log('Existing roles:', roles);
      
      // Find users without roles and create default 'user' roles for them
      const usersWithoutRoles = approvedUsers.filter(user => 
        !roles.some(role => role.user_id === user.user_id)
      );
      
      console.log('Users without roles:', usersWithoutRoles);
      
      // Insert missing roles if any found
      if (usersWithoutRoles.length > 0) {
        const rolesToInsert = usersWithoutRoles.map(user => ({
          user_id: user.user_id,
          role: 'user'
        }));
        
        console.log('Inserting roles for users:', rolesToInsert);
        
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(rolesToInsert);
          
        if (insertError) {
          console.error('Error creating roles for users:', insertError);
        } else {
          console.log('Successfully created roles for users');
          // Refresh roles after insert
          const { data: updatedRoles } = await supabase
            .from('user_roles')
            .select('user_id, role');
            
          if (updatedRoles) {
            roles.push(...updatedRoles.filter(newRole => 
              !roles.some(existingRole => existingRole.user_id === newRole.user_id)
            ));
          }
        }
      }
      
      // Create combined list with roles
      const combinedUserRoles = approvedUsers.map(user => {
        const roleData = roles.find(r => r.user_id === user.user_id);
        return {
          user_id: user.user_id,
          email: user.email,
          role: roleData ? roleData.role : 'user' // Default to 'user' if no role exists
        };
      });
      
      console.log('Final combined user roles:', combinedUserRoles);
      setUserRoles(combinedUserRoles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      message.error('Failed to load user roles');
    }
  };

  // Function to ensure every approved user has a role
  const ensureUserRoles = async () => {
    try {
      // Get all approved users without checking roles first
      const { data: approvedUsers, error: approvedError } = await supabase
        .from('user_approval')
        .select('user_id, email')
        .eq('status', 'approved');
      
      if (approvedError) {
        console.error('Error fetching approved users:', approvedError);
        return;
      }
      
      if (!approvedUsers || approvedUsers.length === 0) {
        console.log('No approved users found.');
        return;
      }
      
      console.log(`Found ${approvedUsers.length} approved users.`);
      
      // For each approved user, make sure they have a role
      for (const user of approvedUsers) {
        const { data: existingRole, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.user_id)
          .maybeSingle();
          
        if (roleError) {
          console.error(`Error checking role for user ${user.email}:`, roleError);
          continue;
        }
        
        if (!existingRole) {
          console.log(`Creating default 'user' role for ${user.email}`);
          const { error: insertError } = await supabase
            .from('user_roles')
            .insert({ user_id: user.user_id, role: 'user' });
            
          if (insertError) {
            console.error(`Error creating role for ${user.email}:`, insertError);
          } else {
            console.log(`Successfully created role for ${user.email}`);
          }
        } else {
          console.log(`User ${user.email} already has role: ${existingRole.role}`);
        }
      }
      
      // Refresh user roles after ensuring all roles exist
      fetchUserRoles();
      
    } catch (error) {
      console.error('Error in ensureUserRoles:', error);
    }
  };

  const handleApproveUser = async (userId: string) => {
    setApprovingUser(userId)
    // Clear any existing messages
    message.destroy(messageKey)
    // Show loading message
    message.loading({ content: 'Processing approval...', key: messageKey })
    
    try {
      // Check if this is the first admin approving themselves
      const { data: { session } } = await supabase.auth.getSession()
      const isSelfApproval = session && userId === session.user.id;
      
      // Update user status to approved
      const { error } = await supabase
        .from('user_approval')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      if (error) throw error

      // Add user role if not already set (for non-first users)
      // First admin already has role from trigger
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
        
      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'user' })
      }

      // Update success message
      if (isSelfApproval) {
        message.success({ 
          content: 'You have approved your own account. The system is now fully accessible.',
          key: messageKey,
          duration: 3
        })
        setTimeout(() => window.location.reload(), 2000)
      } else {
        message.success({ 
          content: 'User approved successfully', 
          key: messageKey 
        })
        fetchUsers()
      }
    } catch (error) {
      console.error('Error approving user:', error)
      message.error({ 
        content: 'Failed to approve user', 
        key: messageKey 
      })
    } finally {
      setApprovingUser(null)
    }
  }

  const handleRejectUser = async (userId: string) => {
    setRejectingUser(userId)
    // Clear any existing messages
    message.destroy(messageKey)
    // Show loading message
    message.loading({ content: 'Processing rejection...', key: messageKey })
    
    try {
      const { error } = await supabase
        .from('user_approval')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      if (error) throw error
      
      message.success({ content: 'User rejected', key: messageKey })
      fetchUsers()
    } catch (error) {
      console.error('Error rejecting user:', error)
      message.error({ content: 'Failed to reject user', key: messageKey })
    } finally {
      setRejectingUser(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const removeUserFromLists = () => {
      setApprovedUsers(prev => prev.filter(u => u.user_id !== userId))
      setRejectedUsers(prev => prev.filter(u => u.user_id !== userId))
      setUserRoles(prev => prev.filter(u => u.user_id !== userId))
    }
    const restoreUserToLists = (backup: {
      approved: ApprovalUser[];
      rejected: ApprovalUser[];
      userRoles: UserRole[];
    }) => {
      setApprovedUsers(backup.approved)
      setRejectedUsers(backup.rejected)
      setUserRoles(backup.userRoles)
    }
    Modal.confirm({
      title: 'Are you sure you want to delete this user?',
      content: 'This action cannot be undone. The user will be permanently removed.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setProcessingUser(userId)
        // Clear any existing messages
        message.destroy(messageKey)
        // Show loading message
        message.loading({ content: 'Deleting user...', key: messageKey })
        
        // Backup current lists for rollback
        const backup = {
          approved: [...approvedUsers],
          rejected: [...rejectedUsers],
          userRoles: [...userRoles],
        }
        removeUserFromLists()
        try {
          // Get the user's access token and ID
          const { data: { session } } = await supabase.auth.getSession();
          if (!session || !session.user?.id) {
            throw new Error('No active session found. Please log in again.');
          }

          // Call the SQL function directly via RPC instead of using Edge Functions
          console.log(`Deleting user: ${userId} by admin: ${session.user.id}`);
          
          const { data, error } = await supabase.rpc('delete_user', {
            user_id_to_delete: userId,
            admin_user_id: session.user.id
          });
          
          console.log('Delete result:', data, error);
          
          if (error) throw error;
          
          if (!data?.success) {
            throw new Error(data?.error || 'Failed to delete user');
          }
          
          message.success({ content: 'User deleted successfully', key: messageKey });
          // Optionally refetch to ensure complete sync
          fetchUsers();
          fetchUserRoles();
        } catch (error) {
          restoreUserToLists(backup)
          console.error('Error deleting user:', error)
          if ((error as any)?.message) {
            message.error({ 
              content: `Failed to delete user: ${(error as any).message}`,
              key: messageKey 
            });
          } else if (typeof error === 'string') {
            message.error({ 
              content: `Failed to delete user: ${error}`,
              key: messageKey 
            });
          } else {
            message.error({ 
              content: 'Failed to delete user',
              key: messageKey 
            });
          }
        } finally {
          setProcessingUser(null)
        }
      }
    })
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

  // Promote or demote user
  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    if (userId === currentUserId) {
      message.destroy(messageKey)
      message.warning({ 
        content: "You can't change your own role.",
        key: messageKey 
      })
      return
    }
    setProcessingUser(userId)
    message.destroy(messageKey)
    message.loading({ content: 'Updating user role...', key: messageKey })
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)
      
      if (error) throw error
      
      message.success({ 
        content: `User role updated to ${newRole}`,
        key: messageKey
      })
      fetchUserRoles()
    } catch (error) {
      console.error('Error updating user role:', error)
      message.error({ 
        content: 'Failed to update user role',
        key: messageKey
      })
    } finally {
      setProcessingUser(null)
    }
  }

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200">
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <Text className="ml-3">Verifying admin access...</Text>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <Title level={2} className="!mb-0 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 font-bold tracking-tight drop-shadow-md">
              Admin Dashboard
            </Title>
            <Text className="text-gray-600">Manage users and approvals</Text>
          </div>
          <div className="flex gap-3">
            <Button 
              type="primary" 
              icon={<UserOutlined />}
              onClick={() => router.push('/search-domain')}
              className="bg-gradient-to-r from-blue-500 to-purple-500 border-0 shadow-md hover:from-blue-600 hover:to-purple-600"
            >
              Search Domain
            </Button>
            <Button 
              type="primary" 
              onClick={handleLogout}
              className="bg-gradient-to-r from-blue-500 to-purple-500 border-0 shadow-md hover:from-blue-600 hover:to-purple-600"
            >
              Logout
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl shadow-xl border-0 bg-white/80 backdrop-blur-md mb-8">
          <Tabs defaultActiveKey="pending">
            <TabPane 
              tab={
                <span>
                  <UserAddOutlined /> 
                  Pending Approvals ({pendingUsers.length})
                </span>
              } 
              key="pending"
            >
              <List
                dataSource={pendingUsers}
                locale={{ emptyText: 'No pending approvals' }}
                renderItem={user => (
                  <List.Item
                    actions={[
                      <Button 
                        type="primary" 
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleApproveUser(user.user_id)}
                        loading={approvingUser === user.user_id}
                        className="bg-green-500 border-0 shadow hover:bg-green-600"
                      >
                        Approve
                      </Button>,
                      <Button 
                        danger 
                        icon={<CloseCircleOutlined />} 
                        onClick={() => handleRejectUser(user.user_id)}
                        loading={rejectingUser === user.user_id}
                      >
                        Reject
                      </Button>
                    ]}
                    className="p-4 border border-gray-100 rounded-xl mb-3 bg-white/90"
                  >
                    <List.Item.Meta
                      avatar={<UserOutlined style={{ fontSize: 24 }} />}
                      title={<Text strong>{user.email}</Text>}
                      description={
                        <>
                          <Text type="secondary">Registered: {new Date(user.created_at).toLocaleString()}</Text>
                          <Tag color="orange" className="ml-2">Pending</Tag>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </TabPane>
            
            <TabPane 
              tab={
                <span>
                  <UserOutlined /> 
                  Approved Users ({approvedUsers.length})
                </span>
              } 
              key="approved"
            >
              <List
                dataSource={approvedUsers}
                locale={{ emptyText: 'No approved users' }}
                renderItem={user => (
                  <List.Item
                    actions={[
                      <Button 
                        type="default" 
                        icon={<UserDeleteOutlined />}
                        danger
                        onClick={() => handleDeleteUser(user.user_id)}
                        loading={processingUser === user.user_id}
                      >
                        Delete User
                      </Button>
                    ]}
                    className="p-4 border border-gray-100 rounded-xl mb-3 bg-white/90"
                  >
                    <List.Item.Meta
                      avatar={<UserOutlined style={{ fontSize: 24 }} />}
                      title={<Text strong>{user.email}</Text>}
                      description={
                        <>
                          <Text type="secondary">Approved: {new Date(user.updated_at).toLocaleString()}</Text>
                          <Tag color="green" className="ml-2">Approved</Tag>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </TabPane>
            
            <TabPane 
              tab={
                <span>
                  <CloseCircleOutlined /> 
                  Rejected Users ({rejectedUsers.length})
                </span>
              } 
              key="rejected"
            >
              <List
                dataSource={rejectedUsers}
                locale={{ emptyText: 'No rejected users' }}
                renderItem={user => (
                  <List.Item
                    actions={[
                      <Button 
                        type="primary" 
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleApproveUser(user.user_id)}
                        loading={approvingUser === user.user_id}
                        className="bg-green-500 border-0 shadow hover:bg-green-600"
                      >
                        Approve
                      </Button>,
                      <Button 
                        type="default" 
                        icon={<UserDeleteOutlined />}
                        danger
                        onClick={() => handleDeleteUser(user.user_id)}
                        loading={processingUser === user.user_id}
                      >
                        Delete User
                      </Button>
                    ]}
                    className="p-4 border border-gray-100 rounded-xl mb-3 bg-white/90"
                  >
                    <List.Item.Meta
                      avatar={<UserOutlined style={{ fontSize: 24 }} />}
                      title={<Text strong>{user.email}</Text>}
                      description={
                        <>
                          <Text type="secondary">Rejected: {new Date(user.updated_at).toLocaleString()}</Text>
                          <Tag color="red" className="ml-2">Rejected</Tag>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </TabPane>
            <TabPane
              tab={
                <span>
                  <LockOutlined />
                  User Management
                </span>
              }
              key="usermanagement"
            >
              <div className="mb-4">
                <Button 
                  type="primary"
                  onClick={() => {
                    message.destroy(messageKey);
                    message.loading({ content: 'Refreshing user roles...', key: messageKey });
                    ensureUserRoles().then(() => {
                      message.success({ 
                        content: 'User roles refreshed',
                        key: messageKey
                      });
                    });
                  }}
                >
                  Refresh User List
                </Button>
                <Text className="ml-4 text-gray-500">
                  {userRoles.length} users total ({userRoles.filter(u => u.role === 'admin').length} admins, {userRoles.filter(u => u.role === 'user').length} regular users)
                </Text>
              </div>
              <List
                dataSource={userRoles}
                locale={{ emptyText: 'No users found' }}
                renderItem={user => (
                  <List.Item
                    actions={[
                      user.role === 'admin' ? (
                        <Button
                          type="default"
                          danger
                          disabled={currentUserId === user.user_id}
                          onClick={() => handleRoleChange(user.user_id, 'user')}
                          loading={processingUser === user.user_id}
                        >
                          Remove Admin
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          onClick={() => handleRoleChange(user.user_id, 'admin')}
                          loading={processingUser === user.user_id}
                        >
                          Make Admin
                        </Button>
                      )
                    ]}
                    className="p-4 border border-gray-100 rounded-xl mb-3 bg-white/90"
                  >
                    <List.Item.Meta
                      avatar={<UserOutlined style={{ fontSize: 24 }} />}
                      title={<Text strong>{user.email}</Text>}
                      description={
                        <>
                          <Text type="secondary">Role: {user.role}</Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  )
} 