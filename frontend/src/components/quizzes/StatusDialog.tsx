import { memo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertTriangle } from 'lucide-react'

interface StatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'success' | 'error'
  title: string
  description: string
}

const StatusDialog = memo(({ open, onOpenChange, type, title, description }: StatusDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
            {type === 'success' ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export default StatusDialog
