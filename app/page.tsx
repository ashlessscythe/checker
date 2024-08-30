'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { init, tx, id } from '@instantdb/react';
import Header from './components/header';

// Replace with your actual APP_ID
const APP_ID = 'b9a54fed-8d71-46b3-aa0f-045d7b411655';

type Schema = {
  users: User;
  punches: Punch;
  admin_users: AdminUser;
}

type User = {
  id: string;
  name: string;
  barcode: string;
  lastStatus: 'checked_in' | 'checked_out' | null;
}

type Punch = {
  id: string;
  userId: string;
  timestamp: number;
  direction: 'in' | 'out';
}

type AdminUser = {
  id: string;
  barcode: string;
}

const db = init<Schema>({ appId: APP_ID });

function App() {
  const [barcode, setBarcode] = useState('');
  const [message, setMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [adminBarcode, setAdminBarcode] = useState('');
  const router = useRouter();

  const { data } = db.useQuery({
    users: {},
    punches: {},
    admin_users: {},
  });

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = data?.users.find(u => u.barcode === barcode);

    if (!user) {
      setMessage('User not found');
      return;
    }

    const newStatus = user.lastStatus === 'checked_in' ? 'checked_out' : 'checked_in';

    await db.transact([
      tx.users[user.id].update({ lastStatus: newStatus }),
      tx.punches[id()].update({
        userId: user.id,
        timestamp: Date.now(),
        direction: newStatus === 'checked_in' ? 'in' : 'out'
      })
    ]);

    setMessage(`${user.name} ${newStatus.replace('_', ' ')}`);
    setBarcode('');
  };

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const openLoginModal = () => setIsLoginModalOpen(true);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const adminUser = data?.admin_users.find(u => u.barcode === adminBarcode);

    if (adminUser) {
      router.push('/admindashboard');
    } else {
      setMessage('Invalid admin barcode');
    }
    setAdminBarcode('');
    setIsLoginModalOpen(false);
  };

  return (
    <div style={styles.container}>
      <Header openLoginModal={openLoginModal} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      <main style={styles.main}>
        <form onSubmit={handleScan} style={styles.form}>
          <input
            type="password"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan barcode"
            autoFocus
            style={styles.input}
          />
        </form>
        {message && <div style={styles.message}>{message}</div>}
      </main>
        {isLoginModalOpen && (
          <div style={styles.modal}>
            <div style={styles.modalContent}>
              <h2>Admin Login</h2>
              <form onSubmit={handleAdminLogin}>
                <input
                  type="text"
                  value={adminBarcode}
                  onChange={(e) => setAdminBarcode(e.target.value)}
                  placeholder="Scan admin barcode"
                  style={styles.input}
                />
                <button type="submit" style={styles.loginButton}>Login</button>
              </form>
              <button onClick={() => setIsLoginModalOpen(false)} style={styles.closeButton}>Close</button>
            </div>
          </div>
        )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    fontFamily: 'code, monospace',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    minHeight: 'calc(100vh - 80px)',
  },
  form: {
    width: '100%',
    maxWidth: '300px',
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '18px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  message: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: 'var(--accent-color)',
    color: 'white',
    borderRadius: '4px',
    textAlign: 'center',
    maxWidth: '300px',
    width: '100%',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'var(--bg-secondary)',
    padding: '2rem',
    borderRadius: '8px',
    maxWidth: '400px',
    width: '100%',
  },
  closeButton: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--accent-color)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default App;