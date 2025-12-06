import { memo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Upload as UploadIcon, FileText, X, AlertCircle } from 'lucide-react'

interface UploadSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  isDragging: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  selectedFiles: File[]
  onRemoveFile: (index: number) => void
  validationError: string
  uploadError: string | null
  onGenerate: () => void
  hasFileTooLarge: boolean
}

const UploadSheet = memo(({
  open,
  onOpenChange,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging,
  onFileChange,
  selectedFiles,
  onRemoveFile,
  validationError,
  uploadError,
  onGenerate,
  hasFileTooLarge
}: UploadSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">Upload Lecture PDF's</SheetTitle>
          <SheetDescription className="text-base">
            Upload your lecture PDF files to generate AI-powered study notes
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-8 space-y-6">
          {/* Upload Area */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
              isDragging 
                ? 'border-primary bg-primary/5 scale-[1.02]' 
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <UploadIcon className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Drop your PDF files here</h3>
                <p className="text-sm text-muted-foreground">or click to browse from your computer</p>
              </div>
              <label htmlFor="file-upload">
                <Button type="button" variant="outline" className="mt-4" onClick={() => document.getElementById('file-upload')?.click()}>
                  Choose Files
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                multiple
                onChange={onFileChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-4">Supports: PDF files up to 10MB each</p>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h4 className="font-semibold text-sm text-foreground">Selected Files ({selectedFiles.length})</h4>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 bg-card border rounded-lg shadow-sm"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {(validationError || uploadError) && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{validationError || uploadError}</p>
            </div>
          )}

          {/* Generate Button */}
          <Button 
            className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all" 
            size="lg"
            onClick={onGenerate}
            disabled={selectedFiles.length === 0 || hasFileTooLarge}
          >
            Generate Study Notes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
})

export default UploadSheet
