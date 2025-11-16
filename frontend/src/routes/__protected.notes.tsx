import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, Plus, Upload as UploadIcon } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useState } from 'react'
import AppLayout from '@/components/app-layout'

export const Route = createFileRoute('/__protected/notes')({
  component: RouteComponent,
})

function RouteComponent() {
  const [open, setOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...files])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf')
      setSelectedFiles(prev => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleGenerateNotes = () => {
    // TODO: Implement the API call to generate notes
    console.log('Generating notes from:', selectedFiles)
    // Close drawer and reset after generation
    // setOpen(false)
    // setSelectedFiles([])
  }
  const sampleNotes = [
    { title: 'Introduction to Algorithms', date: 'Nov 10, 2025', pages: 5, excerpt: 'Key concepts: Big O notation, time complexity, space complexity...' },
    { title: 'Data Structures Overview', date: 'Nov 8, 2025', pages: 3, excerpt: 'Arrays, linked lists, stacks, queues, and their use cases...' },
    { title: 'Operating Systems Basics', date: 'Nov 5, 2025', pages: 7, excerpt: 'Process management, threading, synchronization, deadlocks...' },
  ]

  return (
    <AppLayout>
    <div className="space-y-6 mt-5">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Your Generated Notes</h2>
          <p className="text-muted-foreground mt-1">AI-generated study notes from your lecture materials</p>
        </div>
        <div className="flex gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="lg" className="gap-2">
                <UploadIcon className="h-4 w-4" />
                Upload Lecture PDF's
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Upload Lecture PDF's</SheetTitle>
                <SheetDescription>
                  Upload your lecture PDF files to generate AI-powered study notes
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <UploadIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Drop your PDF files here</h3>
                      <p className="text-sm text-muted-foreground">or click to browse from your computer</p>
                    </div>
                    <label htmlFor="file-upload">
                      <Button type="button" onClick={() => document.getElementById('file-upload')?.click()}>
                        Choose Files
                      </Button>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <p className="text-xs text-muted-foreground">Supports: PDF files up to 10MB each</p>
                  </div>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Selected Files ({selectedFiles.length})</h4>
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
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
                            onClick={() => removeFile(index)}
                            className="shrink-0"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleGenerateNotes}
                  disabled={selectedFiles.length === 0}
                >
                  Generate Study Notes
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

     
      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sampleNotes.map((note, index) => (
          <Link key={index} to="/notes/$noteId" params={{ noteId: String(index) }} className="block">
            <Card className="hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 transition-all duration-200 bg-card border-muted cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">{note.title}</CardTitle>
                    <CardDescription className="text-xs">{note.date}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{note.excerpt}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {note.pages} pages
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.preventDefault()
                      // Handle download
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Empty State (show when no notes) */}
      {sampleNotes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No notes yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Upload a lecture to generate concise study notes using AI
            </p>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Note
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  )
}
 
