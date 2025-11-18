import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, Search, FolderOpen, Calendar, SortAsc, SortDesc, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContext'
import { useUserFiles, useDeleteFile } from '@/hooks/useUpload'
import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

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
    let result = files.filter(file =>
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
  useMemo(() => {
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

  const getSortLabel = () => {
    switch (sortBy) {
      case 'name-asc': return 'Name (A-Z)'
      case 'name-desc': return 'Name (Z-A)'
      case 'date-asc': return 'Oldest First'
      case 'date-desc': return 'Newest First'
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
    <div className="space-y-6 mt-5">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Library</h2>
          <p className="text-muted-foreground mt-1">Manage your uploaded lectures and documents</p>
        </div>
        <Link to="/notes">
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            Upload New File
          </Button>
        </Link>
      </div>

      {/* Search and Sort Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="pl-9 h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <Button 
            variant="outline" 
            size="lg" 
            className="gap-2"
            onClick={() => setShowSortMenu(!showSortMenu)}
          >
            {getSortIcon()}
            Sort
          </Button>
          {showSortMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-popover border rounded-md shadow-lg z-10">
              <div className="p-2">
                <p className="px-2 py-1.5 text-sm font-semibold">Sort by</p>
                <div className="border-t my-1"></div>
                <button
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2"
                  onClick={() => {
                    setSortBy('date-desc')
                    setShowSortMenu(false)
                  }}
                >
                  <Calendar className="h-4 w-4" />
                  Newest First
                </button>
                <button
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2"
                  onClick={() => {
                    setSortBy('date-asc')
                    setShowSortMenu(false)
                  }}
                >
                  <Calendar className="h-4 w-4" />
                  Oldest First
                </button>
                <button
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2"
                  onClick={() => {
                    setSortBy('name-asc')
                    setShowSortMenu(false)
                  }}
                >
                  <SortAsc className="h-4 w-4" />
                  Name (A-Z)
                </button>
                <button
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2"
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
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Files</p>
                <p className="text-2xl font-bold mt-1">{files.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Filtered Results</p>
                <p className="text-2xl font-bold mt-1">{filteredAndSortedFiles.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Page</p>
                <p className="text-2xl font-bold mt-1">{currentPage} / {totalPages || 1}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                {getSortIcon()}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sort Order</p>
                <p className="text-lg font-bold mt-1 truncate">{getSortLabel()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files List */}
      {filteredAndSortedFiles.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Your Files</CardTitle>
              <CardDescription>
                {searchQuery ? `Found ${filteredAndSortedFiles.length} file(s) matching "${searchQuery}"` : 'All your uploaded documents'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paginatedFiles.map((file) => (
                  <div 
                    key={file.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{file.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">ID: {file.id.slice(0, 8)}...</span>
                          {file.user && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">By {file.user.Fullname}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">PDF</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setFileToDelete({ id: file.id, name: file.name })}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="space-y-6 pt-2">
              {/* Pagination Controls - Top */}
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {getPageNumbers().map((page, index) => (
                      <PaginationItem key={index}>
                        {page === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>

              {/* Info and Items Per Page - Bottom */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2">
                <p className="text-sm text-muted-foreground text-center sm:text-left">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredAndSortedFiles.length)}</span> of <span className="font-medium">{filteredAndSortedFiles.length}</span> files
                </p>
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <label htmlFor="items-per-page" className="text-sm text-muted-foreground whitespace-nowrap">
                    Items per page:
                  </label>
                  <select
                    id="items-per-page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="h-9 px-3 pr-8 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              {searchQuery ? <Search className="h-10 w-10 text-muted-foreground" /> : <FolderOpen className="h-10 w-10 text-muted-foreground" />}
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {searchQuery ? 'No files found' : 'No files in your library yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              {searchQuery 
                ? `No files match your search for "${searchQuery}". Try a different search term.`
                : 'Upload lectures from the Notes page to get started'}
            </p>
            {!searchQuery && (
              <Link to="/notes">
                <Button className="gap-2">
                  <FileText className="h-4 w-4" />
                  Upload Your First File
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>

    {/* Delete Confirmation Dialog */}
    <Dialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{fileToDelete?.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setFileToDelete(null)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => fileToDelete && handleDelete(fileToDelete.id)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </AppLayout>
  )
}

