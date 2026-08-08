/**
 * Hybrid Client & Server Authentication Data Access Layer (DAL)
 * 
 * Modes:
 * 1. SERVER MODE: Uses Express backend API (/api/auth & /api/admin) with SQLite/Supabase database.
 * 2. CLIENT MOCK MODE: Fallback when static server or local environment without Node.js is used.
 *    Uses localStorage persistence with exact same role, status, password validation, and approval workflow.
 */

const Auth = {
  currentUser: null,
  isServerAvailable: null,

  async init() {
    if (this.isServerAvailable !== null) return;
    try {
      const res = await fetch('/api/auth/me', { method: 'GET' });
      // If server responds with 200 or 401, backend is active
      if (res.status === 200 || res.status === 401) {
        this.isServerAvailable = true;
        return;
      }
    } catch (e) {
      console.warn('Backend API server not detected. Switching to Local Storage Auth Engine.');
    }
    this.isServerAvailable = false;
    this._initLocalStorageDb();
  },

  // --- LOCAL STORAGE DB SEED & HELPERS ---
  _initLocalStorageDb() {
    if (!localStorage.getItem('kvs_users_db')) {
      const defaultDb = [
        {
          id: 1,
          fullName: 'System Administrator',
          username: 'superadmin',
          email: 'admin@system.local',
          mobile: '9999999999',
          passwordHash: this._hashSimple('admin123'),
          role: 'SUPERADMIN',
          status: 'APPROVED',
          approved: true,
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('kvs_users_db', JSON.stringify(defaultDb));
    }
  },

  _getUsersDb() {
    this._initLocalStorageDb();
    try {
      return JSON.parse(localStorage.getItem('kvs_users_db') || '[]');
    } catch (e) {
      return [];
    }
  },

  _saveUsersDb(users) {
    localStorage.setItem('kvs_users_db', JSON.stringify(users));
  },

  _hashSimple(str) {
    // Lightweight obfuscation hash for client-side offline mock mode
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16) + '_' + btoa(str).slice(0, 10);
  },

  // --- PUBLIC AUTH METHODS ---

  async checkAuth() {
    await this.init();

    if (this.isServerAvailable) {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (res.ok && data.success) {
          this.currentUser = data.user;
          this.updateUserUI(data.user);
          return data.user;
        }
      } catch (e) {}
    } else {
      // Local Storage Mode
      const session = sessionStorage.getItem('kvs_current_user');
      if (session) {
        try {
          const user = JSON.parse(session);
          if (user && user.status === 'APPROVED' && user.approved) {
            this.currentUser = user;
            this.updateUserUI(user);
            return user;
          }
        } catch (e) {}
      }
    }

    this.redirectToLogin();
    return null;
  },

  redirectToLogin() {
    const currentPath = window.location.pathname;
    if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register') && !currentPath.startsWith('/superuser')) {
      window.location.href = '/login';
    }
  },

  async login(identifier, password) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      return await res.json();
    } else {
      // Client Mock Mode
      const users = this._getUsersDb();
      const user = users.find(u => 
        u.username.toLowerCase() === identifier.toLowerCase() || 
        u.email.toLowerCase() === identifier.toLowerCase()
      );

      if (!user) {
        return { success: false, message: 'Invalid credentials. User not found.' };
      }

      if (user.passwordHash !== this._hashSimple(password)) {
        return { success: false, message: 'Invalid username/email or password.' };
      }

      if (user.status === 'PENDING' || !user.approved) {
        return { success: false, message: 'Your account has not yet been approved by the administrator.', status: 'PENDING' };
      }

      if (user.status === 'REJECTED') {
        return { success: false, message: 'Your registration request was rejected by the administrator.', status: 'REJECTED' };
      }

      if (user.status === 'DISABLED') {
        return { success: false, message: 'Your account has been disabled by the administrator.', status: 'DISABLED' };
      }

      const payload = {
        id: user.id,
        fullName: user.fullName,
        kvName: user.kvName || '',
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        approved: user.approved
      };

      sessionStorage.setItem('kvs_current_user', JSON.stringify(payload));
      this.currentUser = payload;

      return { success: true, message: 'Login successful.', user: payload };
    }
  },

  async register(userData) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return { status: res.status, data: await res.json() };
    } else {
      // Client Mock Mode
      const users = this._getUsersDb();

      if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
        return { status: 400, data: { success: false, message: 'Username is already taken.' } };
      }

      if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return { status: 400, data: { success: false, message: 'Email address is already registered.' } };
      }

      const newUser = {
        id: Date.now(),
        fullName: userData.fullName,
        designation: userData.designation || '',
        kvName: userData.kvName || '',
        username: userData.username,
        email: userData.email,
        mobile: userData.mobile,
        passwordHash: this._hashSimple(userData.password),
        role: 'USER',
        status: 'PENDING',
        approved: false,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      this._saveUsersDb(users);

      return {
        status: 201,
        data: {
          success: true,
          message: 'Registration submitted successfully. Your account is awaiting approval from the System Administrator.',
          user: { id: newUser.id, username: newUser.username, status: newUser.status }
        }
      };
    }
  },

  async superadminLogin(username, password) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return await res.json();
    } else {
      // Client Mock Mode
      const users = this._getUsersDb();
      const superadmin = users.find(u => u.role === 'SUPERADMIN');

      if (username === 'superadmin' && (password === 'admin123' || (superadmin && superadmin.passwordHash === this._hashSimple(password)))) {
        const payload = {
          id: superadmin ? superadmin.id : 0,
          fullName: 'System Administrator',
          kvName: '',
          username: 'superadmin',
          email: 'admin@system.local',
          role: 'SUPERADMIN'
        };
        sessionStorage.setItem('kvs_current_user', JSON.stringify(payload));
        return { success: true, message: 'Superadmin login successful.', user: payload };
      }

      return { success: false, message: 'Invalid Super Admin credentials.' };
    }
  },

  async getAdminUsers() {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch('/api/admin/users');
      return await res.json();
    } else {
      const users = this._getUsersDb();
      const regularUsers = users.filter(u => u.role !== 'SUPERADMIN');
      return {
        success: true,
        data: {
          all: regularUsers,
          pending: regularUsers.filter(u => u.status === 'PENDING'),
          approved: regularUsers.filter(u => u.status === 'APPROVED'),
          rejected: regularUsers.filter(u => u.status === 'REJECTED' || u.status === 'DISABLED')
        }
      };
    }
  },

  async approveUser(id) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch(`/api/admin/users/${id}/approve`, { method: 'POST' });
      return await res.json();
    } else {
      const users = this._getUsersDb();
      const user = users.find(u => u.id == id);
      if (!user) return { success: false, message: 'User not found.' };

      user.status = 'APPROVED';
      user.approved = true;
      user.approvedBy = 'SUPERADMIN';
      user.approvedAt = new Date().toISOString();
      this._saveUsersDb(users);

      return { success: true, message: `User '${user.username}' has been APPROVED. They can now log in.` };
    }
  },

  async rejectUser(id) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch(`/api/admin/users/${id}/reject`, { method: 'POST' });
      return await res.json();
    } else {
      const users = this._getUsersDb();
      const user = users.find(u => u.id == id);
      if (!user) return { success: false, message: 'User not found.' };

      user.status = 'REJECTED';
      user.approved = false;
      this._saveUsersDb(users);

      return { success: true, message: `User '${user.username}' has been REJECTED.` };
    }
  },

  async disableUser(id) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch(`/api/admin/users/${id}/disable`, { method: 'POST' });
      return await res.json();
    } else {
      const users = this._getUsersDb();
      const user = users.find(u => u.id == id);
      if (!user) return { success: false, message: 'User not found.' };

      user.status = 'DISABLED';
      user.approved = false;
      this._saveUsersDb(users);

      return { success: true, message: `User '${user.username}' has been DISABLED.` };
    }
  },

  async deleteUser(id) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      return await res.json();
    } else {
      let users = this._getUsersDb();
      users = users.filter(u => u.id != id);
      this._saveUsersDb(users);
      return { success: true, message: 'User account deleted successfully.' };
    }
  },

  async changePassword(currentPassword, newPassword, confirmPassword) {
    await this.init();

    if (this.isServerAvailable) {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      return await res.json();
    } else {
      // Client Mock Mode
      if (!currentPassword || !newPassword || !confirmPassword) {
        return { success: false, message: 'All fields are required.' };
      }
      if (newPassword !== confirmPassword) {
        return { success: false, message: 'New password and Confirm Password do not match.' };
      }
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return { success: false, message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 digit.' };
      }

      const session = sessionStorage.getItem('kvs_current_user');
      if (!session) return { success: false, message: 'User session not found. Please log in again.' };

      const currentUser = JSON.parse(session);
      const users = this._getUsersDb();
      const user = users.find(u => u.id == currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase());

      if (!user) return { success: false, message: 'User account not found.' };

      if (user.passwordHash !== this._hashSimple(currentPassword)) {
        return { success: false, message: 'Incorrect current password.' };
      }

      user.passwordHash = this._hashSimple(newPassword);
      this._saveUsersDb(users);

      return { success: true, message: 'Password changed successfully.' };
    }
  },

  async logout() {
    try {
      if (this.isServerAvailable !== false) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } catch (e) {
      console.warn('Logout request failed:', e);
    } finally {
      sessionStorage.removeItem('kvs_current_user');
      this.currentUser = null;
      window.location.href = '/login';
    }
  },

  // --- ACCOUNT MANAGEMENT (Enterprise) ---

  /**
   * Delete the current user's account permanently.
   * Requires password confirmation for security.
   * Clears all user-scoped localStorage data before deletion.
   */
  async deleteAccount(password) {
    await this.init();

    if (!this.currentUser) {
      return { success: false, message: 'No active session. Please log in again.' };
    }

    if (this.isServerAvailable) {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        // Clear user-scoped localStorage data
        this._clearUserData(this.currentUser.id);
        sessionStorage.removeItem('kvs_current_user');
        this.currentUser = null;
      }
      return data;
    } else {
      // Client Mock Mode
      const users = this._getUsersDb();
      const user = users.find(u => u.id == this.currentUser.id);

      if (!user) return { success: false, message: 'User account not found.' };

      if (user.role === 'SUPERADMIN') {
        return { success: false, message: 'Super Admin accounts cannot be deleted through this interface.' };
      }

      if (user.passwordHash !== this._hashSimple(password)) {
        return { success: false, message: 'Incorrect password. Account deletion cancelled.' };
      }

      // Clear user-scoped localStorage data
      this._clearUserData(user.id);

      // Remove user from DB
      const updatedUsers = users.filter(u => u.id != user.id);
      this._saveUsersDb(updatedUsers);
      sessionStorage.removeItem('kvs_current_user');
      this.currentUser = null;

      return { success: true, message: 'Your account has been permanently deleted.' };
    }
  },

  /**
   * Reset all application data (candidates, school settings) for the current user.
   * Does NOT delete the user account itself.
   */
  resetDatabase() {
    if (!this.currentUser) {
      return { success: false, message: 'No active session.' };
    }
    this._clearUserData(this.currentUser.id);
    return { success: true, message: 'All your admission data (candidates, school settings) has been reset. The page will reload.' };
  },

  /**
   * Clear all user-scoped localStorage keys for a given user ID.
   */
  _clearUserData(userId) {
    localStorage.removeItem(`kvs_candidates_${userId}`);
    localStorage.removeItem(`kvs_school_settings_${userId}`);
  },

  updateUserUI(user) {
    const userBadge = document.getElementById('loggedInUserBadge');
    if (userBadge && user) {
      userBadge.innerHTML = `<i class="bi bi-person-circle me-1 text-primary"></i> ${user.fullName || user.username} (${user.role})`;
    }
    const saBtn = document.getElementById('superadminPortalBtn');
    if (saBtn) {
      saBtn.style.display = (user && user.role === 'SUPERADMIN') ? 'block' : 'none';
    }
    const saHeaderBtn = document.getElementById('superadminHeaderBtn');
    if (saHeaderBtn) {
      saHeaderBtn.style.display = (user && user.role === 'SUPERADMIN') ? 'inline-block' : 'none';
    }
  }
};

window.Auth = Auth;
