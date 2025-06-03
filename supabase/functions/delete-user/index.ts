import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

console.log('delete-user function loaded');

// Simple Edge Function to delete users
serve(async (req) => {
  console.log('delete-user function invoked');
  
  try {
    // Get URL parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const adminId = url.searchParams.get('adminId');
    console.log('URL params:', { userId, adminId });
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );
    
    // Validate params
    if (!userId || !adminId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or adminId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
      );
    }
    
    // Validate admin role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId)
      .eq('role', 'admin')
      .single();
      
    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
      );
    }
    
    console.log('Admin verified. Deleting user:', userId);
    
    // Delete from auth
    await supabaseAdmin.auth.admin.deleteUser(userId);
    
    // Delete from user_approval
    await supabaseAdmin.from('user_approval').delete().eq('user_id', userId);
    
    // Delete from user_roles
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    
    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
    );
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
    );
  }
}); 