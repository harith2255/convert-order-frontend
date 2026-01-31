import React, { useEffect, useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { Card } from "../Card";
import { Button } from "../Button";
import { Input } from "../Input";
import { Dropdown } from "../Dropdown";
import { Table } from "../Table";
import { Badge } from "../Badge";
import { CustomModal } from "../Modal";
import { toast } from "sonner";
import { adminUsersApi } from "../../services/adminUserApi";

export function UserAccessPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<any>(null);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "User",
    status: "Active",
  });

  /* ---------------- LOAD USERS ---------------- */
  const loadUsers = async (search = "") => {
    try {
      setLoading(true);
      const res = await adminUsersApi.getUsers(search);
      setUsers(res.data.data); // ✅ Extract array
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  /* ---------------- SEARCH ---------------- */
  useEffect(() => {
    const delay = setTimeout(() => {
      loadUsers(searchTerm);
    }, 400);

    return () => clearTimeout(delay);
  }, [searchTerm]);

  /* ---------------- ROLE CHANGE ---------------- */
  const handleRoleChange = async (id: string, role: string) => {
    try {
      const normalizedRole = role.toLowerCase();
      await adminUsersApi.updateRole(id, normalizedRole);

      setUsers(prev =>
        prev.map(u =>
          u.id === id ? { ...u, role: normalizedRole } : u // ✅ Match backend "id"
        )
      );

      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    }
  };

  /* ---------------- STATUS TOGGLE ---------------- */
  const confirmStatusChange = async () => {
    try {
      await adminUsersApi.toggleStatus(confirmModal.id); // ✅ Match backend "id"

      setUsers(prev =>
        prev.map(u =>
          u.id === confirmModal.id // ✅ Match backend "id"
            ? {
                ...u,
                status: u.status === "Active" ? "Disabled" : "Active",
              }
            : u
        )
      );

      toast.success("User status updated");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setConfirmModal(null);
    }
  };

  /* ---------------- DELETE USER ---------------- */
  const handleDeleteUser = async () => {
    if (!deleteModal) return;
    try {
      await adminUsersApi.deleteUser(deleteModal.id);
      setUsers(prev => prev.filter(u => u.id !== deleteModal.id));
      toast.success("User deleted successfully");
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeleteModal(null);
    }
  };

  /* ---------------- ADD USER ---------------- */
  const handleAddUser = async () => {
    try {
      const payload = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role.toLowerCase(),
        status: newUser.status,
      };

      const res = await adminUsersApi.addUser(payload);

      setUsers(prev => [res.data.user, ...prev]); // ✅ Extract user object
      toast.success("User added");

      setIsAddModalOpen(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "User",
        status: "Active",
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add user");
    }
  };

  /* ---------------- TABLE ---------------- */
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },

    {
      key: "role",
      label: "Role",
      render: (value: string, row: any) => (
        <Dropdown
          options={[
            { value: "user", label: "User" },
            { value: "admin", label: "Admin" },
          ]}
          value={value}
          onChange={e => handleRoleChange(row.id, e.target.value)} // ✅ row.id
        />
      ),
    },

    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <Badge variant={value === "Active" ? "success" : "neutral"}>
          {value}
        </Badge>
      ),
    },

    {
      key: "lastLogin",
      label: "Last Login",
      render: (v: string, row: any) => {
        const val = v || row.last_login || row.lastActive || row.updatedAt;
        return val ? new Date(val).toLocaleString() : "—";
      },
    },

    {
      key: "conversions",
      label: "Conversions",
      render: (v: any, row: any) => {
        return v ?? row.conversionCount ?? row.conversionsCount ?? row.uploadsCount ?? 0;
      },
    },

    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.status === "Active"}
            onChange={() => setConfirmModal(row)}
            className="toggle-checkbox" // Assuming you have some styles for this or using a custom component
          />
          <Button
            variant="ghost" // or "destructive" if available/preferred for icons
            className="p-1 hover:bg-red-50 text-red-500"
            onClick={() => setDeleteModal(row)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between">
        <h1 className="text-3xl font-bold">User Access Management</h1>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* SEARCH */}
      <Card>
        <Input
          placeholder="Search by name or email"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </Card>

      {/* TABLE */}
      <Card padding="none">
        <Table columns={columns} data={users} />
      </Card>

      {/* ADD USER MODAL */}
      <CustomModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New User"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Add User</Button>
          </>
        }
      >
        <Input
          label="Name"
          value={newUser.name}
          onChange={e => setNewUser({ ...newUser, name: e.target.value })}
        />
        <Input
          label="Email"
          value={newUser.email}
          onChange={e => setNewUser({ ...newUser, email: e.target.value })}
        />
        <Input
          label="Password"
          type="password"
          value={newUser.password}
          onChange={e =>
            setNewUser({ ...newUser, password: e.target.value })
          }
        />
        <Dropdown
          label="Role"
          options={[
            { value: "User", label: "User" },
            { value: "Admin", label: "Admin" },
          ]}
          value={newUser.role}
          onChange={e => setNewUser({ ...newUser, role: e.target.value })}
        />
        <Dropdown
          label="Status"
          options={[
            { value: "Active", label: "Active" },
            { value: "Disabled", label: "Disabled" },
          ]}
          value={newUser.status}
          onChange={e => setNewUser({ ...newUser, status: e.target.value })}
        />
      </CustomModal>

      {/* CONFIRM MODAL */}
      <CustomModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title="Confirm Status Change"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmModal(null)}
            >
              Cancel
            </Button>
            <Button onClick={confirmStatusChange}>Confirm</Button>
          </>
        }
      >
        Are you sure you want to change status for{" "}
        <b>{confirmModal?.name}</b>?
      </CustomModal>

      {/* DELETE MODAL */}
      <CustomModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete User"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteModal(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" // Changed from destructive to danger
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteUser}
            >
              Delete
            </Button>
          </>
        }
      >
        Are you sure you want to permanently delete user{" "}
        <b>{deleteModal?.name}</b>?
        <p className="text-sm text-gray-500 mt-2">
          This action cannot be undone.
        </p>
      </CustomModal>
    </div>
  );
}
