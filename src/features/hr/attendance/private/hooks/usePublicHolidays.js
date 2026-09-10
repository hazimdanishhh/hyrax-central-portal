import { useQuery } from "@tanstack/react-query";
import { fetchPublicHolidays } from "../api/publicHolidaysService";

export default function usePublicHolidays() {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["public_holidays"],
    queryFn: fetchPublicHolidays,
  });

  return {
    holidays: data || [],
    isLoading,
    isFetching,
    error,
  };
}
