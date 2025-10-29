/**
 * Pagination Component
 * 
 * Advanced pagination component for large datasets.
 * Provides page navigation, page size selection, and jump-to-page functionality.
 * 
 * Features:
 * - Page navigation with previous/next buttons
 * - Page size selection
 * - Jump to page functionality
 * - Page range display
 * - Responsive design
 * - Accessibility features
 * - Keyboard navigation
 * 
 * Version: 1.0.0
 * Last Updated: January 2025
 */

import React, { useState } from 'react';
import { Button, Input } from '@/components/ui';

// =============================================================================
// TYPES
// =============================================================================

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];
const MAX_VISIBLE_PAGES = 7;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const generatePageNumbers = (currentPage: number, totalPages: number): (number | string)[] => {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];
  const halfVisible = Math.floor(MAX_VISIBLE_PAGES / 2);

  // Always show first page
  pages.push(1);

  // Calculate start and end of visible range
  let start = Math.max(2, currentPage - halfVisible);
  let end = Math.min(totalPages - 1, currentPage + halfVisible);

  // Adjust if we're near the beginning or end
  if (currentPage <= halfVisible) {
    end = Math.min(totalPages - 1, MAX_VISIBLE_PAGES - 1);
  } else if (currentPage >= totalPages - halfVisible) {
    start = Math.max(2, totalPages - MAX_VISIBLE_PAGES + 2);
  }

  // Add ellipsis if needed
  if (start > 2) {
    pages.push('...');
  }

  // Add middle pages
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Add ellipsis if needed
  if (end < totalPages - 1) {
    pages.push('...');
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className = ''
}) => {
  const [jumpToPage, setJumpToPage] = useState('');

  // Calculate display values
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = generatePageNumbers(currentPage, totalPages);

  // Handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number') {
      onPageChange(page);
    }
  };

  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpToPage('');
    }
  };

  const handleJumpToPageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(parseInt(e.target.value));
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 ${className}`}>
      {/* Page Info */}
      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-700">
          Showing <span className="font-semibold">{startItem}</span> to{' '}
          <span className="font-semibold">{endItem}</span> of{' '}
          <span className="font-semibold">{totalItems.toLocaleString()}</span> members
        </div>
        
        {/* Page Size Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Show:</label>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="p-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-700">per page</span>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center space-x-2">
        {/* Previous Button */}
        <Button
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          variant="outline"
          size="sm"
          className="flex items-center space-x-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Previous</span>
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center space-x-1">
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                  ...
                </span>
              );
            }

            const pageNumber = page as number;
            const isActive = pageNumber === currentPage;

            return (
              <Button
                key={pageNumber}
                onClick={() => handlePageClick(pageNumber)}
                variant={isActive ? 'primary' : 'outline'}
                size="sm"
                className={`min-w-[40px] ${isActive ? 'bg-blue-600 text-white' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNumber}
              </Button>
            );
          })}
        </div>

        {/* Next Button */}
        <Button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          variant="outline"
          size="sm"
          className="flex items-center space-x-1"
        >
          <span>Next</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      {/* Jump to Page */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-700">Go to:</span>
        <Input
          type="number"
          min="1"
          max={totalPages}
          value={jumpToPage}
          onChange={(e) => setJumpToPage(e.target.value)}
          onKeyDown={handleJumpToPageKeyDown}
          placeholder="Page"
          className="w-20 text-center"
        />
        <Button
          onClick={handleJumpToPage}
          disabled={!jumpToPage || parseInt(jumpToPage) < 1 || parseInt(jumpToPage) > totalPages}
          variant="outline"
          size="sm"
        >
          Go
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
