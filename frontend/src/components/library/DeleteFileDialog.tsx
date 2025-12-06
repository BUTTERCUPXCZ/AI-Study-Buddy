import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteFileDialogProps {
  fileToDelete: { id: string; name: string } | null
  onClose: () => void
  onConfirm: (id: string) => void
  isDeleting: boolean
}

export function DeleteFileDialog({ 
  fileToDelete, 
  onClose, 
  onConfirm, 
  isDeleting 
}: DeleteFileDialogProps) {
  return (
    <Dialog open={!!fileToDelete} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-medium text-foreground">"{fileToDelete?.name}"</span>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => fileToDelete && onConfirm(fileToDelete.id)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
