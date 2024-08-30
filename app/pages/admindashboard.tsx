
    import React from 'react';
    import { init } from '@instantdb/react';

    // Replace with your actual APP_ID
    const APP_ID = 'b9a54fed-8d71-46b3-aa0f-045d7b411655';

    type Schema = {
        users: User;
        punches: Punch;
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

    const db = init<Schema>({ appId: APP_ID });

    function AdminDashboard() {
        const { data } = db.useQuery({
        users: {},
        punches: {}
        });

        return (
        <div style={styles.container}>
            <h1 style={styles.header}>Admin Dashboard</h1>
            <h2>Users</h2>
            <ul>
            {data?.users.map(user => (
                <li key={user.id}>
                {user.name} - {user.lastStatus || 'No status'}
                </li>
            ))}
            </ul>
            <h2>Recent Punches</h2>
            <ul>
            {data?.punches
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10)
                .map(punch => {
                const user = data.users.find(u => u.id === punch.userId);
                return (
                    <li key={punch.id}>
                    {user?.name} - {punch.direction} at {new Date(punch.timestamp).toLocaleString()}
                    </li>
                );
                })}
            </ul>
        </div>
        );
    }

    const styles: Record<string, React.CSSProperties> = {
        container: {
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        },
        header: {
        fontSize: '24px',
        marginBottom: '20px',
        },
    };

    export default AdminDashboard;