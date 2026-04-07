'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import React, { useState, useMemo, memo, type ReactNode } from 'react';
import { useMobile } from '@/hooks/use-mobile';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Custom renderer for mobile card view. Receives the row data and returns a ReactNode. */
type MobileCardRenderer<TData> = (row: TData) => ReactNode;

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  /** Optional custom card renderer for mobile view. If omitted, columns are auto-rendered as label/value pairs. */
  mobileCardRenderer?: MobileCardRenderer<TData>;
}

/** @deprecated Use useMobile() from @/hooks/use-mobile instead */
const useMobileView = useMobile;

export const DataTable = memo(function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Ara...',
  mobileCardRenderer,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const isMobile = useMobileView();

  const stableData = useMemo(() => data, [data]);
  const stableColumns = useMemo(() => columns, [columns]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: stableData,
    columns: stableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div>
      {/* Search */}
      {searchKey !== undefined && (
        <div className="mb-5 flex items-center gap-3">
          <div className="relative max-w-sm md:max-w-sm max-md:max-w-none flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-10 pl-10 text-sm"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                borderRadius: '12px',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      {isMobile ? (
        <div className="flex flex-col gap-3">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              if (mobileCardRenderer) {
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border p-4"
                    style={{
                      background: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    {mobileCardRenderer(row.original)}
                  </div>
                );
              }

              // Auto-detect: render each column as a label/value pair
              return (
                <div
                  key={row.id}
                  className="rounded-xl border p-4"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="flex flex-col gap-2.5">
                    {row.getVisibleCells().map((cell) => {
                      if (cell.column.id === 'actions') {
                        return (
                          <div
                            key={cell.id}
                            className="flex items-center gap-2 pt-2 mt-1"
                            style={{ borderTop: '1px solid var(--color-border)' }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        );
                      }

                      const headerContent = cell.column.columnDef.header;
                      const label =
                        typeof headerContent === 'string' ? headerContent : cell.column.id;

                      return (
                        <div key={cell.id} className="flex items-start justify-between gap-3">
                          <span
                            className="text-[11px] font-semibold uppercase tracking-[0.08em] shrink-0"
                            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
                          >
                            {label}
                          </span>
                          <span
                            className="text-sm text-right"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              className="flex flex-col items-center gap-2 py-12"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">Kayıt bulunamadı</p>
              <p className="text-xs">Arama kriterlerinizi değiştirmeyi deneyin</p>
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div
          className="overflow-x-auto rounded-xl border"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  style={{
                    background: 'var(--color-surface-hover)',
                    borderColor: 'var(--color-border)',
                    borderBottomWidth: '2px',
                  }}
                >
                  {headerGroup.headers.map((header) => {
                    const isActionsCol = header.column.id === 'actions';
                    return (
                    <TableHead
                      key={header.id}
                      className={`text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap${isActionsCol ? ' w-px' : ''}`}
                      style={{
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-body)',
                        padding: isActionsCol ? '14px 4px' : '14px 16px',
                        ...(header.getSize() !== 150 ? { width: header.getSize(), minWidth: header.getSize() } : {}),
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={
                            header.column.getCanSort()
                              ? 'flex cursor-pointer select-none items-center gap-1.5'
                              : ''
                          }
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <ArrowUpDown className="h-3 w-3" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
                          )}
                        </div>
                      )}
                    </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="clickable-row"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isActionsCell = cell.column.id === 'actions';
                      return (
                      <TableCell
                        key={cell.id}
                        className={isActionsCell ? 'w-px' : ''}
                        style={{
                          color: 'var(--color-text-primary)',
                          padding: isActionsCell ? '14px 4px' : '14px 16px',
                          fontSize: '14px',
                          ...(cell.column.getSize() !== 150 ? { width: cell.column.getSize(), minWidth: cell.column.getSize() } : {}),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-30" />
                      <p className="text-sm font-medium">Kayıt bulunamadı</p>
                      <p className="text-xs">Arama kriterlerinizi değiştirmeyi deneyin</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-center md:text-left" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {table.getFilteredRowModel().rows.length}
          </span>{' '}
          kayıttan{' '}
          <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}
          </span>{' '}
          arası
        </p>
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-center gap-1.5" role="navigation" aria-label="Sayfa gezintisi">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="İlk sayfa"
              className="h-8 w-8 p-0 rounded-lg"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Önceki sayfa"
              className="h-8 w-8 p-0 rounded-lg"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {/* Page numbers — show fewer on mobile to prevent overflow */}
            {Array.from({ length: Math.min(table.getPageCount(), isMobile ? 3 : 5) }, (_, i) => {
              const pageIdx = table.getState().pagination.pageIndex;
              const maxVisible = isMobile ? 3 : 5;
              const halfVisible = Math.floor(maxVisible / 2);
              let pageNum = i;
              if (pageIdx > halfVisible) pageNum = pageIdx - halfVisible + i;
              if (pageNum >= table.getPageCount()) return null;
              const isActive = pageNum === pageIdx;
              return (
                <button
                  key={pageNum}
                  onClick={() => table.setPageIndex(pageNum)}
                  aria-label={`Sayfa ${pageNum + 1}`}
                  aria-current={isActive ? 'page' : undefined}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition-[background,color,transform] duration-150 active:scale-90 active:duration-75"
                  style={{
                    background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isActive ? 'white' : 'var(--color-text-secondary)',
                    border: isActive ? 'none' : '1px solid var(--color-border)',
                    boxShadow: isActive ? '0 2px 8px rgba(var(--color-primary-rgb), 0.3)' : 'none',
                  }}
                >
                  {pageNum + 1}
                </button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Sonraki sayfa"
              className="h-8 w-8 p-0 rounded-lg"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Son sayfa"
              className="h-8 w-8 p-0 rounded-lg"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}) as <TData, TValue>(props: DataTableProps<TData, TValue>) => React.JSX.Element;
