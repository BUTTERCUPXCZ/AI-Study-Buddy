import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu'
import { Download, Trash2, MoreVertical, FileText} from 'lucide-react'

// Helper functions
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const getExcerpt = (content: string, maxLength: number = 100) => {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + '...'
}

interface NoteCardProps {
  note: { 
    id: string
    title: string
    content: string
    source?: string
    createdAt: string 
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigate: (opts: any) => void
  onDownload: (id: string, title: string, content: string, e: React.MouseEvent) => void
  onDelete: (id: string, title: string, e: React.MouseEvent) => void
  onPrefetch: (noteId: string) => void
}

const NoteCard = memo(({ 
  note, 
  navigate, 
  onDownload, 
  onDelete,
  onPrefetch
}: NoteCardProps) => (
  <Card 
    className="h-full flex flex-col hover:shadow-lg hover:border-primary/30 transition-all duration-300 bg-card cursor-pointer overflow-hidden group border-border/60 will-change-transform"
    onMouseEnter={() => onPrefetch(note.id)}
    onClick={() => {
      console.log('Navigating to note:', note.id)
      navigate({ 
        to: '/notes/$noteId', 
        params: { noteId: note.id } 
      })
    }}
  >
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <CardTitle className="text-lg font-bold line-clamp-2 group-hover:text-primary transition-colors leading-tight">
            {note.title}
          </CardTitle>  
          <div className="flex items-center gap-2 flex-wrap">

            <span className="text-xs text-muted-foreground flex items-center gap-1">
             
              {formatDate(note.createdAt)}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-primary/10 -mr-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={(e) => onDownload(note.id, note.title, note.content, e)}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" />
              <span>Download as PDF</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => onDelete(note.id, note.title, e)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Note</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardHeader>
    <CardContent className="pt-0 flex-1 flex flex-col">
      <p className="text-sm text-muted-foreground line-clamp-4 mb-6 leading-relaxed flex-1">
        {getExcerpt(note.content, 150)}
      </p>
      <div className="flex items-center justify-between pt-4 border-t mt-auto">
        <span className="text-xs font-medium text-primary group-hover:underline underline-offset-4">
          View details
        </span>
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <FileText className="h-3 w-3 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
))

export default NoteCard
