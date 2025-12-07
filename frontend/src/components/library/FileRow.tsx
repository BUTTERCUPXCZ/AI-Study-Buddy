import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, Download } from 'lucide-react'

interface FileRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  file: any
  onDelete: (id: string, name: string) => void
}

export const FileRow = memo(({ file, onDelete }: FileRowProps) => (
  <div 
    className="grid grid-cols-12 gap-4 px-4 md:px-6 py-4 items-center hover:bg-muted/30 transition-colors group"
  >
    <div className="col-span-8 md:col-span-6 flex items-center gap-4 min-w-0">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <h3 className="font-medium text-sm text-foreground truncate">{file.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">ID: {file.id.slice(0, 8)}</p>
      </div>
    </div>
    
    <div className="col-span-2 hidden md:flex items-center text-sm text-muted-foreground">
      {/* Placeholder for date if available in file object, otherwise just ID based sort implies date */}
      <span className="truncate">Recent</span>
    </div>
    
    <div className="col-span-2 hidden md:flex items-center">
      <Badge variant="secondary" className="font-normal bg-secondary/50 text-secondary-foreground hover:bg-secondary/70">
        PDF Document
      </Badge>
    </div>
    
    <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-2">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
        title="Download file"
        asChild
      >
        <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" />
        </a>
      </Button>

      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
        onClick={() => onDelete(file.id, file.name)}
        title="Delete file"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
))

FileRow.displayName = 'FileRow'
