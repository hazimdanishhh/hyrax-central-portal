// hooks/itAssets/useITAssetsMetadata.js
import { useQuery } from "@tanstack/react-query";
import { fetchEmployeesMetadata } from "../../services/employeesServices/employeesMetadataService";
import { fetchAttendanceActivitiesMetadata } from "../../services/attendanceActivitiesServices/attendanceActivitiesMetadataService";

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
