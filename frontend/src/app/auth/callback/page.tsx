"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/stores/supabase-client"
import { Skeleton } from "../../../components/ui/skeleton"
import { toast } from "sonner"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔐 Auth callback started');
        
        // Get URL parameters for magic links and email confirmations
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        const tokenFromSearch = searchParams.get('token');
        const tokenFromHash = hashParams.get('access_token');
        const authType = hashParams.get('type') || searchParams.get('type');
        
        console.log('🔐 URL params:', { 
          searchToken: !!tokenFromSearch,
          hashAccessToken: !!tokenFromHash, 
          type: authType,
          fullURL: window.location.href
        });

        // For magic links, we need to wait longer and try multiple approaches
        let data, error;
        
        // First attempt - wait for Supabase to process URL tokens automatically
        await new Promise(resolve => setTimeout(resolve, 500));
        ({ data, error } = await supabase.auth.getSession());
        
        // If still no session, try getting user which might trigger token exchange
        if (!data.session && !error) {
          console.log('🔐 No session found, trying getUser to trigger token exchange...');
          const { data: userData, error: userError } = await supabase.auth.getUser();
          
          if (userData.user && !userError) {
            console.log('🔐 User found via getUser, trying session again...');
            await new Promise(resolve => setTimeout(resolve, 200));
            ({ data, error } = await supabase.auth.getSession());
          }
        }
        
        console.log('🔐 Session result:', { 
          hasSession: !!data.session, 
          error: error?.message,
          userEmail: data.session?.user?.email,
          userCreated: data.session?.user?.created_at,
          emailConfirmed: data.session?.user?.email_confirmed_at
        });
        
        if (error) {
          console.error("Auth callback error:", error)
          toast.error("Authentication failed. Please try again.", {
            description: error.message || "Authentication Error"
          })
          router.push('/login')
          return
        }

        if (data.session) {
          const user = data.session.user
          console.log('🔐 Auth callback - user session found:', {
            user_id: user.id,
            email: user.email,
            email_confirmed_at: user.email_confirmed_at,
            created_at: user.created_at
          });
          
          // Check if this is a new user who just confirmed their email
          const now = new Date()
          const userCreated = new Date(user.created_at)
          const isVeryNewUser = (now.getTime() - userCreated.getTime()) < (10 * 60 * 1000) // Less than 10 minutes old
          
          // Check if user was just confirmed (email_confirmed_at is very recent)
          const justConfirmed = user.email_confirmed_at && 
            (now.getTime() - new Date(user.email_confirmed_at).getTime()) < (5 * 60 * 1000) // Confirmed within 5 minutes
          
          console.log('🔐 User analysis:', { isVeryNewUser, justConfirmed });
          
          try {
            const response = await fetch('/api/organizations', {
              headers: {
                'Authorization': `Bearer ${data.session.access_token}`
              }
            })
            
            if (response.ok) {
              const orgData = await response.json()
              const hasOrganization = orgData.organizations && orgData.organizations.length > 0
              
              // If user is very new AND just confirmed email, send to onboarding regardless of org
              if ((isVeryNewUser || justConfirmed) && hasOrganization) {
                // New user who just confirmed - go to onboarding even though they have an org
                let message = "🎉 Welcome to AdHub!";
                if (authType === 'signup') {
                  message = "🎉 Email verified successfully! Welcome to AdHub!";
                } else if (authType === 'magiclink') {
                  message = "🎉 Magic link sign in successful! Welcome to AdHub!";
                } else {
                  message = "🎉 Email confirmed successfully! Welcome to AdHub!";
                }
                toast.success(message, {
                  description: "Let's get you set up"
                })
                router.push('/onboarding')
              } else if (hasOrganization) {
                // Existing user with organization - go to dashboard
                const message = authType === 'magiclink' ? 
                  "🎉 Magic link sign in successful! Welcome back!" : 
                  "Welcome back!";
                toast.success(message, {
                  description: "Signed in successfully"
                })
                router.push('/dashboard')
              } else {
                // User without organization (edge case) - go to onboarding
                toast.success("Welcome to AdHub! Let's get you set up.", {
                  description: "Account Created"
                })
                router.push('/onboarding')
              }
            } else {
              // Can't check organization, but if user is very new, send to onboarding
              if (isVeryNewUser || justConfirmed) {
                const message = authType === 'signup' ? 
                  "🎉 Email verified successfully! Welcome to AdHub!" : 
                  "🎉 Email confirmed successfully! Welcome to AdHub!";
                toast.success(message, {
                  description: "Let's get you set up"
                })
                router.push('/onboarding')
              } else {
                // Fallback to dashboard for existing users
                toast.success("Welcome back!")
                router.push('/dashboard')
              }
            }
          } catch (orgError) {
            console.error("Error checking organization:", orgError)
            // If we can't check organization but user is new, default to onboarding
            if (isVeryNewUser || justConfirmed) {
              const message = authType === 'signup' ? 
                "🎉 Email verified successfully! Welcome to AdHub!" : 
                "🎉 Email confirmed successfully! Welcome to AdHub!";
              toast.success(message, {
                description: "Let's get you set up"
              })
              router.push('/onboarding')
            } else {
              // Fallback to dashboard for existing users
              toast.success("Welcome back!")
              router.push('/dashboard')
            }
          }
        } else {
          // No session found - likely came from email link but confirmation failed
          console.log("No session found in auth callback - tokens may be invalid/expired")
          
          if (authType === 'magiclink') {
            toast.error("Magic link has expired or is invalid.", {
              description: "Please request a new magic link"
            })
            router.push('/magic-link')
          } else if (authType === 'signup') {
            toast.error("Email verification link has expired or is invalid.", {
              description: "Please try registering again"
            })
            router.push('/register')
          } else {
            toast.error("Authentication failed. Please try signing in again.", {
              description: "Link may be expired or invalid"
            })
            router.push('/login')
          }
        }
      } catch (error) {
        console.error("Unexpected error in auth callback:", error)
        toast.error("Something went wrong. Please try signing in again.", {
          description: "Authentication Error"
        })
        router.push('/login')
      } finally {
        setIsProcessing(false)
      }
    }

    handleAuthCallback()
  }, [router])

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <p className="text-muted-foreground">Confirming your email...</p>
        </div>
      </div>
    )
  }

  return null
} 