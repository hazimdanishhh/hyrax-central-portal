import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceActivitiesMetadata } from "../api/attendanceActivitiesMetadataService";

export function useAttendanceActivitiesMetadata() {
  const query = useQuery({
    queryKey: ["attendanceActivitiesMetadata"],
    queryFn: fetchAttendanceActivitiesMetadata,
    staleTime: 1000 * 60 * 10,
  });

  return {
    ...query,
    employees: query.data?.employees || [],
    departments: query.data?.departments || [],
    attendanceTypes: query.data?.attendanceTypes || [],
  };
}
