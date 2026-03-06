'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus';
import { usePathname, useRouter } from 'next/navigation';
import PageLoading from '@components/Objects/Loaders/PageLoading';

type AuthorizationProps = {
  children: React.ReactNode;
  authorizationMode: 'component' | 'page';
};

const COURSE_STAFF_PATHS = [
  '/dash/courses/*',
  '/dash/courses',
];

const ADMIN_ONLY_PATHS = [
  '/dash/org/*',
  '/dash/org',
  '/dash/users/*',
  '/dash/users',
  '/dash/org/settings/general',
];

const ADMIN_PATHS = [...ADMIN_ONLY_PATHS, ...COURSE_STAFF_PATHS];

const AdminAuthorization: React.FC<AuthorizationProps> = ({ children, authorizationMode }) => {
  const session = useSokratesSession() as any;  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus() as any
  const { isCourseStaff, loading: courseStaffLoading } = useCourseStaffStatus() as any
  const [isAuthorized, setIsAuthorized] = useState(false);

  const isUserAuthenticated = useMemo(() => session.status === 'authenticated', [session.status]);

  const checkPathname = useCallback((pattern: string, pathname: string) => {
    // Ensure the inputs are strings
    if (typeof pattern !== 'string' || typeof pathname !== 'string') {
      return false;
    }

    // Convert pattern to a regex pattern
    const regexPattern = new RegExp(`^${pattern.replace(/[\/.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);

    // Test the pathname against the regex pattern
    return regexPattern.test(pathname);
  }, []);


  const isAdminPath = useMemo(() => ADMIN_PATHS.some(path => checkPathname(path, pathname)), [pathname, checkPathname]);
  const isCourseStaffPath = useMemo(
    () => COURSE_STAFF_PATHS.some(path => checkPathname(path, pathname)),
    [pathname, checkPathname],
  );

  const authorizeUser = useCallback(() => {
    if (loading || courseStaffLoading) {
      return; // Wait until the admin status is determined
    }

    if (!isUserAuthenticated) {
      router.push('/login');
      return;
    }

    if (authorizationMode === 'page') {
      if (isAdminPath) {
        const isAllowed = isAdmin || (isCourseStaffPath && isCourseStaff);
        if (isAllowed) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          router.push('/dash');
        }
      } else {
        setIsAuthorized(true);
      }
    } else if (authorizationMode === 'component') {
      setIsAuthorized(isAdmin);
    }
  }, [loading, courseStaffLoading, isUserAuthenticated, isAdmin, isAdminPath, isCourseStaff, isCourseStaffPath, authorizationMode, router]);

  useEffect(() => {
    authorizeUser();
  }, [authorizeUser]);

  if (loading || courseStaffLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <PageLoading />
      </div>
    );
  }

  if (authorizationMode === 'page' && !isAuthorized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <h1 className="text-2xl">You are not authorized to access this page</h1>
      </div>
    );
  }

  return <>{isAuthorized && children}</>;
};

export default AdminAuthorization;
