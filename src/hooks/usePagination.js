import { useState, useEffect } from "react";

export default function usePagination(data, rowsPerPage = 50) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / rowsPerPage);

  const paginatedData = data.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedData,
  };
}
