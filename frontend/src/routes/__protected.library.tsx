import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Search, Calendar, SortAsc, SortDesc, ArrowUpDown, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContextDefinition'
import { useUserFiles, useDeleteFile } from '@/hooks/useUpload'
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { FileRow } from '@/components/library/FileRow'
import { LibraryEmptyState } from '@/components/library/LibraryEmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// Lazy load dialogs
const DeleteFileDialog = lazy(() => import('@/components/library/DeleteFileDialog').then(module => ({ default: module.DeleteFileDialog })))

export const Route = createFileRoute('/__protected/library')({
  component: RouteComponent,
})

type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'

function RouteComponent() {
  const { user } = useAuth()
  const { data: files = [], isLoading } = useUserFiles(user?.id || '')
  const { mutate: deleteFile, isPending: isDeleting } = useDeleteFile()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    const result = files.filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Sort files
    switch (sortBy) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'date-asc':
        result.sort((a, b) => a.id.localeCompare(b.id))
        break
      case 'date-desc':
        result.sort((a, b) => b.id.localeCompare(a.id))
        break
    }

    return result
  }, [files, searchQuery, sortBy])

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedFiles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedFiles = filteredAndSortedFiles.slice(startIndex, endIndex)

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  const handleDelete = (fileId: string) => {
    if (!user?.id) return
    
    deleteFile(
      { fileId, userId: user.id },
      {
        onSuccess: () => {
          setFileToDelete(null)
        },
        onError: (error) => {
          alert('Error: ' + (error.message || 'Failed to delete file'))
        },
      }
    )
  }

  const getSortIcon = () => {
    if (sortBy.includes('asc')) return <SortAsc className="h-4 w-4" />
    if (sortBy.includes('desc')) return <SortDesc className="h-4 w-4" />
    return <ArrowUpDown className="h-4 w-4" />
  }

  const handleSetFileToDelete = useCallback((id: string, name: string) => {
    setFileToDelete({ id, name })
  }, [])

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <LoadingSpinner className="h-12 w-12" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Library</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your uploaded lectures and documents</p>
        </div>
        <Link to="/notes">
          <Button size="lg" className="gap-2 shadow-sm hover:shadow-md transition-all">
            <FileText className="h-5 w-5" />
            Upload New File
          </Button>
        </Link>
      </div>

      {/* Search and Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="pl-12 h-12 text-base bg-card border-border/60 focus:border-primary/50 focus:ring-primary/20 transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <Button 
            variant="outline" 
            size="lg" 
            className="h-12 px-6 gap-2 bg-card border-border/60 hover:bg-accent hover:text-accent-foreground transition-all shadow-sm"
            onClick={() => setShowSortMenu(!showSortMenu)}
          >
            {getSortIcon()}
            <span className="font-medium">Sort</span>
          </Button>
          {showSortMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-popover border rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sort by</p>
                <div className="space-y-1">
                  <button
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center gap-3 transition-colors ${sortBy === 'date-desc' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                    onClick={() => {
                      setSortBy('date-desc')
                      setShowSortMenu(false)
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                    Newest First
                  </button>
                  <button
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center gap-3 transition-colors ${sortBy === 'date-asc' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                    onClick={() => {
                      setSortBy('date-asc')
                      setShowSortMenu(false)
                    }}
                  >
                    <Calendar className="h-4 w-4" />
                    Oldest First
                  </button>
                  <button
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center gap-3 transition-colors ${sortBy === 'name-asc' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                    onClick={() => {
                      setSortBy('name-asc')
                      setShowSortMenu(false)
                    }}
                  >
                    <SortAsc className="h-4 w-4" />
                    Name (A-Z)
                  </button>
                  <button
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center gap-3 transition-colors ${sortBy === 'name-desc' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'}`}
                    onClick={() => {
                      setSortBy('name-desc')
                      setShowSortMenu(false)
                    }}
                  >
                    <SortDesc className="h-4 w-4" />
                    Name (Z-A)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Files List */}
      {filteredAndSortedFiles.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {/* List Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-8 md:col-span-6">Name</div>
              <div className="col-span-2 hidden md:block">Date Added</div>
              <div className="col-span-2 hidden md:block">Type</div>
              <div className="col-span-4 md:col-span-2 text-right">Actions</div>
            </div>

            {/* List Items */}
            <div className="divide-y">
              {paginatedFiles.map((file) => (
                <FileRow 
                  key={file.id}
                  file={file}
                  onDelete={handleSetFileToDelete}
                />
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-6 border-t space-y-4">
              {/* Rows per page selector */}
              <div className="flex items-center justify-end gap-3">
                <label htmlFor="items-per-page" className="text-sm text-muted-foreground whitespace-nowrap">
                  Rows per page
                </label>
                <select
                  id="items-per-page"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              
              {/* Pagination and info row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground text-center sm:text-left order-2 sm:order-1">
                  Showing <span className="font-medium text-foreground">{startIndex + 1}</span> to <span className="font-medium text-foreground">{Math.min(endIndex, filteredAndSortedFiles.length)}</span> of <span className="font-medium text-foreground">{filteredAndSortedFiles.length}</span> files
                </p>
                
                <div className="order-1 sm:order-2">
                  <Pagination>
                    <PaginationContent className="gap-9">
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(Math.max(1, currentPage - 1))
                          }}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      
                      {getPageNumbers().map((page, index) => (
                        <PaginationItem key={index}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setCurrentPage(page as number)
                              }}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(Math.min(totalPages, currentPage + 1))
                          }}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <LibraryEmptyState searchQuery={searchQuery} />
      )}
    </div>

    {/* Delete Confirmation Dialog */}
    <Suspense fallback={null}>
      <DeleteFileDialog 
        fileToDelete={fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </Suspense>
    </AppLayout>
  )
}

