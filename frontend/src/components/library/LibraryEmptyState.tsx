import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Search, FolderOpen, FileText } from 'lucide-react'

interface LibraryEmptyStateProps {
  searchQuery: string
}

export function LibraryEmptyState({ searchQuery }: LibraryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-card rounded-xl border border-dashed">
      <div className="h-24 w-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        {searchQuery ? <Search className="h-10 w-10 text-muted-foreground/50" /> : <FolderOpen className="h-10 w-10 text-muted-foreground/50" />}
      </div>
      <h3 className="font-bold text-xl mb-2 text-foreground">
        {searchQuery ? 'No files found' : 'Library is empty'}
      </h3>
      <p className="text-muted-foreground mb-8 text-center max-w-md text-base">
        {searchQuery 
          ? `We couldn't find any files matching "${searchQuery}". Try adjusting your search terms.`
          : 'Your library is looking a bit empty. Upload your first lecture or document to get started.'}
      </p>
      {!searchQuery && (
        <Link to="/notes">
          <Button size="lg" className="gap-2">
            <FileText className="h-5 w-5" />
            Upload Your First File
          </Button>
        </Link>
      )}
    </div>
  )
}
