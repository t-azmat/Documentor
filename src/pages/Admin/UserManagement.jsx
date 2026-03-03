import { useState, useEffect } from 'react'
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { FaUserShield, FaUser, FaEdit, FaTrash, FaSearch, FaCrown } from 'react-icons/fa'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [roleToUpdate, setRoleToUpdate] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'))
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setUsers(usersData)
    } catch (error) {
      console.error('Error fetching users:', error)
      // Generate mock data for demo
      generateMockUsers()
    } finally {
      setLoading(false)
    }
  }

  const generateMockUsers = () => {
    const mockUsers = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        status: 'active',
        lastLogin: new Date(Date.now() - 2 * 3600000).toISOString(),
        documentsCount: 45
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'user',
        status: 'active',
        lastLogin: new Date(Date.now() - 5 * 3600000).toISOString(),
        documentsCount: 23
      },
      {
        id: '3',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        role: 'editor',
        status: 'active',
        lastLogin: new Date(Date.now() - 24 * 3600000).toISOString(),
        documentsCount: 67
      },
      {
        id: '4',
        name: 'Alice Williams',
        email: 'alice@example.com',
        role: 'user',
        status: 'inactive',
        lastLogin: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
        documentsCount: 12
      }
    ]
    setUsers(mockUsers)
  }

  const handleUpdateRole = async (userId) => {
    if (!roleToUpdate) return

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: roleToUpdate,
        updatedAt: new Date().toISOString()
      })
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: roleToUpdate } : user
      ))
      
      alert('User role updated successfully!')
      setEditingUser(null)
      setRoleToUpdate('')
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update user role')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      await deleteDoc(doc(db, 'users', userId))
      setUsers(users.filter(user => user.id !== userId))
      alert('User deleted successfully!')
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-700 border-purple-200',
      editor: 'bg-blue-100 text-blue-700 border-blue-200',
      user: 'bg-gray-100 text-gray-700 border-gray-200'
    }
    const icons = {
      admin: <FaCrown className="text-xs" />,
      editor: <FaUserShield className="text-xs" />,
      user: <FaUser className="text-xs" />
    }
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded ${styles[role] || styles.user}`}>
        {icons[role] || icons.user}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    )
  }

  const getStatusBadge = (status) => {
    return status === 'active' ? (
      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
        Active
      </span>
    ) : (
      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
        Inactive
      </span>
    )
  }

  const formatLastLogin = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000) // seconds

    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading users...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">User Management</h2>
          <p className="text-sm text-gray-600">{users.length} total user(s)</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingUser === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={roleToUpdate}
                            onChange={(e) => setRoleToUpdate(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select role</option>
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="user">User</option>
                          </select>
                          <button
                            onClick={() => handleUpdateRole(user.id)}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(null)
                              setRoleToUpdate('')
                            }}
                            className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        getRoleBadge(user.role)
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatLastLogin(user.lastLogin)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {user.documentsCount}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingUser(user.id)
                            setRoleToUpdate(user.role)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit role"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete user"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Role Permissions</h3>
        <div className="space-y-1 text-sm text-blue-800">
          <div><strong>Admin:</strong> Full system access, can manage users and templates</div>
          <div><strong>Editor:</strong> Can create and edit all documents</div>
          <div><strong>User:</strong> Can create and edit their own documents</div>
        </div>
      </div>
    </div>
  )
}

export default UserManagement
