// src/pages/SettingsPage.jsx

import React, { useState, useEffect } from 'react';
import styles from './SettingsPage.module.css';
import API from '../api';
import { FiUser, FiShield, FiSearch } from 'react-icons/fi';
import { useStudentProfile } from '../context/StudentProfileContext';

const SettingsPage = () => {
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [roleUsers, setRoleUsers] = useState([]);
    const [rolesMessage, setRolesMessage] = useState('');
    const [rolesError, setRolesError] = useState('');
    const [isRolesLoading, setIsRolesLoading] = useState(false);
    const [updatingUserId, setUpdatingUserId] = useState('');
    const [currentUserId, setCurrentUserId] = useState(localStorage.getItem('userId') || '');
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const currentRole = localStorage.getItem('userRole');
    const isAdmin = currentRole === 'admin';
    const { showProfile } = useStudentProfile();

    useEffect(() => {
        const currentName = localStorage.getItem('userName');
        if (currentName) {
            setName(currentName);
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }

        const loadUsers = async () => {
            setIsRolesLoading(true);
            setRolesError('');

            try {
                const response = await API.get('/api/user/roles');
                setRoleUsers(response.data.users || []);
                if (response.data.currentUserId) {
                    setCurrentUserId(response.data.currentUserId);
                    localStorage.setItem('userId', response.data.currentUserId);
                }
            } catch (err) {
                setRolesError(err.response?.data?.message || 'Error loading users');
            } finally {
                setIsRolesLoading(false);
            }
        };

        loadUsers();
    }, [isAdmin]);

    const handleNameChange = (e) => {
        setName(e.target.value);
        if (error) {
            setError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setIsLoading(true);

        if (!name.trim()) {
            setError('Name cannot be empty');
            setIsLoading(false);
            return;
        }

        try {
            const response = await API.put('/api/user/profile', { name });

            localStorage.setItem('userName', response.data.user.name);
            window.dispatchEvent(new Event('userProfileUpdated'));

            setMessage(response.data.message);
            setTimeout(() => setMessage(''), 3000);

        } catch (err) { // <--- Removed arrow =>
            setError(err.response?.data?.message || 'Error updating profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (userId, role) => {
        setRolesMessage('');
        setRolesError('');
        setUpdatingUserId(userId);

        try {
            const response = await API.patch(`/api/user/roles/${userId}`, { role });
            const updatedUser = response.data.user;

            setRoleUsers(users => users.map(user => (
                user._id === updatedUser._id ? updatedUser : user
            )));
            setRolesMessage(response.data.message);
            setTimeout(() => setRolesMessage(''), 3000);
        } catch (err) {
            setRolesError(err.response?.data?.message || 'Error updating role');
        } finally {
            setUpdatingUserId('');
        }
    };
    
    const messageClassName = error 
        ? styles.errorMessage 
        : (message ? styles.successMessage : '');
    const rolesMessageClassName = rolesError
        ? styles.errorMessage
        : (rolesMessage ? styles.successMessage : '');

    return (
        <div className={styles.settingsWrapper}>
            <div className={styles.pageHeader}>
                <h1>Settings</h1>
                <p>Manage your profile and preferences</p>
            </div>

            <div className={styles.settingsGrid}>
                <div className={styles.settingsContainer}>
                    <div className={styles.header}>
                        <div className={styles.headerIcon}><FiUser size={20} /></div>
                        <div className={styles.headerText}>
                            <h2>Profile</h2>
                            <p>Update your display name</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className={styles.settingsForm}>
                        <div className={styles.formGroup}>
                            <label htmlFor="name">Your Name</label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={handleNameChange}
                                className={styles.input}
                                placeholder='Enter your name'
                            />
                        </div>
                        
                        <div className={styles.footer}>
                            <div className={`${styles.message} ${messageClassName}`}>
                                {message || error}
                            </div>
                            
                            <button type="submit" className={styles.saveButton} disabled={isLoading}>
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>

                {isAdmin && (
                    <div className={styles.settingsContainer}>
                        <div className={styles.header}>
                            <div className={styles.headerIcon}><FiShield size={20} /></div>
                            <div className={styles.headerText}>
                                <h2>User Roles</h2>
                                <p>Manage access for registered users</p>
                            </div>
                        </div>

                        <div className={styles.rolesSection}>
                            <div className={styles.rolesFilters}>
                                <div className={styles.searchWrapper}>
                                    <FiSearch className={styles.searchIcon} size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className={styles.searchInput}
                                    />
                                </div>
                                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={styles.roleFilterSelect}>
                                    <option value="all">All Roles</option>
                                    <option value="student">Students</option>
                                    <option value="teacher">Teachers</option>
                                    <option value="admin">Admins</option>
                                </select>
                            </div>

                            {isRolesLoading ? (
                                <p className={styles.emptyState}>Loading users...</p>
                            ) : (
                                <div className={styles.usersTableWrapper}>
                                    <table className={styles.usersTable}>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th className={styles.emailCell}>Email</th>
                                                <th>Role</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {roleUsers
                                                .filter(user => {
                                                    const matchesSearch = !searchQuery || user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.email.toLowerCase().includes(searchQuery.toLowerCase());
                                                    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
                                                    return matchesSearch && matchesRole;
                                                })
                                                .map(user => {
                                                const isCurrentUser = user._id === currentUserId;
                                                return (
                                                    <tr key={user._id}>
                                                        <td>
                                                            <span className={styles.clickableName} onClick={() => showProfile(user._id)}>
                                                                {user.name}
                                                            </span>
                                                        </td>
                                                        <td className={styles.emailCell}>{user.email}</td>
                                                        <td>
                                                            <select
                                                                value={user.role}
                                                                onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                                                className={styles.roleSelect}
                                                                disabled={updatingUserId === user._id || isCurrentUser}
                                                                title={isCurrentUser ? 'You cannot change your own admin role' : 'Change user role'}
                                                            >
                                                                <option value="student">Student</option>
                                                                <option value="teacher">Teacher</option>
                                                                <option value="admin">Admin</option>
                                                            </select>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className={`${styles.message} ${rolesMessageClassName}`}>
                                {rolesMessage || rolesError}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
