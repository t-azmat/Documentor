import { useEffect, useState } from 'react'
import { FaUserShield, FaUser, FaEdit, FaSearch, FaCrown } from 'react-icons/fa'
import { adminAPI } from '../../services/api'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [roleToUpdate, setRoleToUpdate] = useState('')
  const [statusToUpdate, setStatusToUpdate] = useState('')

  const fetchUsers = async () => {
    try {
      const response = await adminAPI.getUsers()
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      alert(error.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleUpdateUser = async (userId) => {
    try {
      await adminAPI.updateUser(userId, { role: roleToUpdate, status: statusToUpdate })
      setEditingUser(null)
      setRoleToUpdate('')
      setStatusToUpdate('')
      fetchUsers()
    } catch (error) {
      console.error('Error updating user:', error)
      alert(error.response?.data?.message || 'Failed to update user')
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
      <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${styles[role] || styles.user}`}>
        {icons[role] || icons.user}
        {role}
      </span>
    )
  }

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="py-12 text-center text-gray-600">Loading users...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="mb-1 text-xl font-bold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-600">{users.length} total user(s)</p>
      </div>

      <div className="mb-6 relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search users by name or email..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {['User', 'Role', 'Status', 'Last Login', 'Documents', 'Actions'].map((label) => (
                  <th key={label} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id || user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {editingUser === (user.id || user._id) ? (
                      <select
                        value={roleToUpdate}
                        onChange={(e) => setRoleToUpdate(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="admin">admin</option>
                        <option value="editor">editor</option>
                        <option value="user">user</option>
                      </select>
                    ) : getRoleBadge(user.role || 'user')}
                  </td>
                  <td className="px-6 py-4">
                    {editingUser === (user.id || user._id) ? (
                      <select
                        value={statusToUpdate}
                        onChange={(e) => setStatusToUpdate(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                        <option value="suspended">suspended</option>
                      </select>
                    ) : (
                      <span className={`rounded px-2 py-1 text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {user.status || 'active'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{user.documentsCount || 0}</td>
                  <td className="px-6 py-4">
                    {editingUser === (user.id || user._id) ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateUser(user.id || user._id)}
                          className="rounded bg-blue-600 px-3 py-1 text-xs text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUser(user.id || user._id)
                          setRoleToUpdate(user.role || 'user')
                          setStatusToUpdate(user.status || 'active')
                        }}
                        className="rounded p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <FaEdit />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default UserManagement
