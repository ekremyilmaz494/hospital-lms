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
  type RowSelectionState,
} from '@tanstack/react-table';
import React, { useState, useMemo, useEffect, memo, type ReactNode } from 'react';
import { useMobile } from '@/hooks/use-mobile';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  /** Called when a row is clicked (excluding actions column). Receives the row data. */
  onRowClick?: (row: TData) => void;
  /** Server-side pagination: total record count from API */
  totalCount?: number;
  /** Server-side pagination: total page count from API */
  pageCount?: number;
  /** Server-side pagination: current page (1-based) */
  currentPage?: number;
  /** Server-side pagination: rows per page (limit). Doğru "X-Y arası" etiketi için gerekli;
   *  verilmezse totalCount/pageCount'tan tahmin edilir (son sayfa dolu değilse kayar). */
  pageSize?: number;
  /** Server-side pagination: called when page changes (1-based) */
  onPageChange?: (page: number) => void;
  /** Server-side search: called when search text changes */
  onSearchChange?: (query: string) => void;
  /** Arama kutusunun başlangıç değeri (URL'den restore için). */
  defaultSearch?: string;
  /** Server-side sorting: kontrollü sorting state. Verilince tablo manualSorting moduna geçer. */
  sorting?: SortingState;
  /** Server-side sorting: başlık tıklanınca yeni sorting state ile çağrılır (API'ye çevir). */
  onSortingChange?: (sorting: SortingState) => void;
  /** Satır çoklu-seçimi: verilince başa checkbox kolonu eklenir (varsayılan kapalı). */
  enableRowSelection?: boolean;
  /** Seçim değişince seçili (orijinal) satırlarla çağrılır. */
  onSelectionChange?: (rows: TData[]) => void;
  /** Stabil satır kimliği — seçim için (örn. (s) => s.id). */
  getRowId?: (row: TData) => string;
  /** Değeri değişince seçim sıfırlanır — parent'ın "seçimi temizle" tetiği. */
  selectionResetKey?: number | string;
  /** Sayfa boyutu seçenekleri (örn. [10,25,50,100]). onPageSizeChange ile birlikte footer'da seçici gösterir. */
  pageSizeOptions?: number[];
  /** Sayfa boyutu değişince çağrılır (limit'i güncelle, sayfayı 1'e al). */
  onPageSizeChange?: (size: number) => void;
}

export const DataTable = memo(function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Ara...',
  mobileCardRenderer,
  onRowClick,
  totalCount,
  pageCount: serverPageCount,
  currentPage,
  pageSize: pageSizeProp,
  onPageChange,
  onSearchChange,
  defaultSearch,
  sorting: sortingProp,
  onSortingChange,
  enableRowSelection = false,
  onSelectionChange,
  getRowId,
  selectionResetKey,
  pageSizeOptions,
  onPageSizeChange,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(defaultSearch ?? '');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const isMobile = useMobile();

  const isServerPagination = onPageChange !== undefined && currentPage !== undefined;
  // Server-side sorting: parent kontrollü sorting verdiyse manualSorting moduna geç.
  const isServerSort = onSortingChange !== undefined;
  const sorting = sortingProp ?? internalSorting;

  const stableData = useMemo(() => data, [data]);
  // Seçim aktifken başa checkbox kolonu enjekte et (opt-in; diğer tablolar etkilenmez).
  const stableColumns = useMemo(() => {
    if (!enableRowSelection) return columns;
    const selectColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      size: 44,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Tüm satırları seç"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Satırı seç"
        />
      ),
    };
    return [selectColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data: stableData,
    columns: stableColumns,
    ...(getRowId ? { getRowId } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Server-side arama aktifken client-side filtre yapma — API zaten filtrelenmiş veri döndürüyor
    ...(isServerPagination && onSearchChange ? {} : { getFilteredRowModel: getFilteredRowModel() }),
    // Server-side pagination: tablo client-side bölmesin, API zaten sayfalamış
    ...(isServerPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      if (onSortingChange) onSortingChange(next);
      else setInternalSorting(next);
    },
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      ...(isServerPagination ? { pagination: { pageIndex: 0, pageSize: 99999 } } : {}),
    },
    ...(isServerSort ? { manualSorting: true } : {}),
    ...(isServerPagination ? {
      manualPagination: true,
      pageCount: serverPageCount ?? -1,
    } : {}),
    initialState: isServerPagination ? undefined : { pagination: { pageSize: 10 } },
  });

  // Seçim değişince seçili orijinal satırları parent'a bildir.
  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(table.getSelectedRowModel().rows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  // Sayfa değişimi / refetch (data referansı değişince) seçimi sıfırla —
  // bayat çapraz-sayfa seçim ve toplu işlem sonrası kalıntı seçimi önler.
  useEffect(() => {
    if (enableRowSelection) setRowSelection({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableData]);

  // Parent "seçimi temizle" tetiği (selectionResetKey değişince).
  useEffect(() => {
    if (enableRowSelection) setRowSelection({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionResetKey]);

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
              onChange={(e) => {
                const value = e.target.value;
                setGlobalFilter(value);
                if (onSearchChange) onSearchChange(value);
              }}
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
                    const isNarrowCol = header.column.id === 'actions' || header.column.id === 'select';
                    const sortDir = header.column.getIsSorted();
                    return (
                    <TableHead
                      key={header.id}
                      className={`text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap${isNarrowCol ? ' w-px' : ''}`}
                      style={{
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-body)',
                        padding: isNarrowCol ? '14px 4px' : '14px 16px',
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
                          role={header.column.getCanSort() ? 'button' : undefined}
                          aria-label={header.column.getCanSort()
                            ? `${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : ''} sütununa göre sırala`
                            : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            sortDir === 'asc'
                              ? <ArrowUp className="h-3 w-3" style={{ color: 'var(--color-primary)' }} />
                              : sortDir === 'desc'
                                ? <ArrowDown className="h-3 w-3" style={{ color: 'var(--color-primary)' }} />
                                : <ArrowUpDown className="h-3 w-3" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
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
                    className={onRowClick ? 'clickable-row cursor-pointer hover:bg-black/[0.02] transition-colors' : 'clickable-row'}
                    style={{ borderColor: 'var(--color-border)' }}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isActionsCell = cell.column.id === 'actions';
                      const isNarrowCell = isActionsCell || cell.column.id === 'select';
                      return (
                      <TableCell
                        key={cell.id}
                        className={isNarrowCell ? 'w-px' : ''}
                        onClick={isNarrowCell && onRowClick ? (e) => e.stopPropagation() : undefined}
                        style={{
                          color: 'var(--color-text-primary)',
                          padding: isNarrowCell ? '14px 4px' : '14px 16px',
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
                    colSpan={stableColumns.length}
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
      {(() => {
        // Server-side pagination uses API total/page counts; client-side uses table model
        const srvPage = currentPage ?? 1;
        const totalRows = isServerPagination
          ? (totalCount ?? data.length)
          : table.getFilteredRowModel().rows.length;
        const totalPages = isServerPagination
          ? (serverPageCount ?? 1)
          : table.getPageCount();
        const pageSize = isServerPagination
          ? (pageSizeProp ?? (totalRows > 0 && totalPages > 0 ? Math.ceil(totalRows / totalPages) : data.length))
          : table.getState().pagination.pageSize;
        const activePageIdx = isServerPagination ? srvPage - 1 : table.getState().pagination.pageIndex;
        const canPrev = isServerPagination ? srvPage > 1 : table.getCanPreviousPage();
        const canNext = isServerPagination ? srvPage < totalPages : table.getCanNextPage();

        const goToPage = (p: number) => {
          if (isServerPagination) onPageChange!(p);
          else table.setPageIndex(p - 1);
        };

        // rangeEnd: server-pagination'da o sayfada GERÇEKTEN gösterilen satır sayısına
        // dayan (son sayfa dolu değilse etiket kaymasın); totalRows ile sınırla.
        const rangeStart = totalRows === 0
          ? 0
          : (isServerPagination ? (srvPage - 1) * pageSize + 1 : activePageIdx * pageSize + 1);
        const rangeEnd = isServerPagination
          ? Math.min(rangeStart > 0 ? rangeStart + data.length - 1 : 0, totalRows)
          : Math.min((activePageIdx + 1) * pageSize, totalRows);

        return (
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <p className="text-xs text-center md:text-left" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {totalRows}
                </span>{' '}
                kayıttan{' '}
                <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {rangeStart}-{rangeEnd}
                </span>{' '}
                arası
              </p>
              {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && (
                <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>Sayfa başına</span>
                  <select
                    value={pageSizeProp ?? pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    aria-label="Sayfa başına satır sayısı"
                    className="rounded-lg border px-2 py-1 text-xs outline-none"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    {pageSizeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5" role="navigation" aria-label="Sayfa gezintisi">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={!canPrev}
                  aria-label="İlk sayfa"
                  className="h-8 w-8 p-0 rounded-lg"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(isServerPagination ? srvPage - 1 : activePageIdx)}
                  disabled={!canPrev}
                  aria-label="Önceki sayfa"
                  className="h-8 w-8 p-0 rounded-lg"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {/* Page numbers — show fewer on mobile to prevent overflow */}
                {Array.from({ length: Math.min(totalPages, isMobile ? 3 : 5) }, (_, i) => {
                  const maxVisible = isMobile ? 3 : 5;
                  const halfVisible = Math.floor(maxVisible / 2);
                  let pageNum = i;
                  if (activePageIdx > halfVisible) pageNum = activePageIdx - halfVisible + i;
                  if (pageNum >= totalPages) return null;
                  const isActive = pageNum === activePageIdx;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum + 1)}
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
                  onClick={() => goToPage(isServerPagination ? srvPage + 1 : activePageIdx + 2)}
                  disabled={!canNext}
                  aria-label="Sonraki sayfa"
                  className="h-8 w-8 p-0 rounded-lg"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={!canNext}
                  aria-label="Son sayfa"
                  className="h-8 w-8 p-0 rounded-lg"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}) as <TData, TValue>(props: DataTableProps<TData, TValue>) => React.JSX.Element;
