import { memo } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface DeleteNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteTitle?: string
  isDeleting: boolean
  onConfirm: (e: React.MouseEvent) => void
  onCancel: () => void
}

const DeleteNoteDialog = memo(({
  open,
  onOpenChange,
  noteTitle,
  isDeleting,
  onConfirm,
  onCancel
}: DeleteNoteDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this note?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "<strong>{noteTitle}</strong>". This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4 text-current" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

export default DeleteNoteDialog
