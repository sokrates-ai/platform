'use client'

import { useOrg } from '@components/Contexts/OrgContext';
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext';
import { useEffect, useMemo, useState } from 'react';

interface Role {
  org: { id: number };
  role: { id: number; role_uuid: string };
}

const COURSE_STAFF_ROLE_UUIDS = new Set([
  'role_global_admin',
  'role_global_maintainer',
  'role_global_tutor',
]);

function useCourseStaffStatus() {
  const session = useSokratesSession() as any;
  const org = useOrg() as any;
  const [isCourseStaff, setIsCourseStaff] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const userRoles = useMemo(
    () => session?.data?.roles || [],
    [session?.data?.roles],
  );

  useEffect(() => {
    if (session.status === 'authenticated' && org?.id) {
      const isStaff = userRoles.some((role: Role) => {
        if (role.org.id !== org.id) return false;
        const roleUuid = role.role.role_uuid;
        const roleId = role.role.id;
        return (
          roleId === 1 ||
          roleId === 2 ||
          roleId === 4 ||
          COURSE_STAFF_ROLE_UUIDS.has(roleUuid)
        );
      });
      setIsCourseStaff(isStaff);
      setLoading(false);
    } else {
      setIsCourseStaff(false);
      setLoading(false);
    }
  }, [session.status, userRoles, org?.id]);

  return { isCourseStaff, loading };
}

export default useCourseStaffStatus;
