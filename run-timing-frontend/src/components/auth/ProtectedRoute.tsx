import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** If set, only users with this role can access; otherwise any authenticated user */
    role?: 'admin' | 'organizer';
}

export default function ProtectedRoute({ children, role }: Props) {
    const { currentUser } = useAuth();
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (role && currentUser.role !== role) {
        // organizer trying to access admin-only area
        return <Navigate to="/admin" replace />;
    }

    return <>{children}</>;
}
