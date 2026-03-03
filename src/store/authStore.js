import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      subscription: null,
      
      login: (userData, token) => {
        localStorage.setItem('token', token)
        set({ 
          user: userData, 
          token,
          isAuthenticated: true,
          subscription: userData.subscription
        })
      },
      
      logout: () => {
        localStorage.removeItem('token')
        set({ 
          user: null,
          token: null,
          isAuthenticated: false,
          subscription: null 
        })
      },
      
      updateUser: (userData) => set({ 
        user: userData,
        subscription: userData.subscription
      }),
      
      updateSubscription: (subscriptionData) => set({ 
        subscription: subscriptionData 
      }),
    }),
    {
      name: 'auth-storage',
    }
  )
)

export default useAuthStore
