import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, Eye, MoreVertical, Filter, Search, FolderOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import AppLayout from '@/components/app-layout'

export const Route = createFileRoute('/__protected/library')({
  component: RouteComponent,
})

function RouteComponent() {
  const sampleFiles = [
    { 
      name: 'Introduction to Algorithms.pdf', 
      uploadedDate: 'Nov 10, 2025',
      size: '2.4 MB',
      pages: 12,
      status: 'Processed'
    },
    { 
      name: 'Data Structures Lecture.pdf', 
      uploadedDate: 'Nov 8, 2025',
      size: '1.8 MB',
      pages: 8,
      status: 'Processed'
    },
    { 
      name: 'Operating Systems Basics.pdf', 
      uploadedDate: 'Nov 5, 2025',
      size: '3.2 MB',
      pages: 15,
      status: 'Processing'
    },
  ]

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Processed': return 'bg-green-500/10 text-green-700 dark:text-green-400'
      case 'Processing': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
      case 'Failed': return 'bg-red-500/10 text-red-700 dark:text-red-400'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  return (
    <AppLayout>
    <div className="space-y-6 mt-5">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Library</h2>
          <p className="text-muted-foreground mt-1">Manage your uploaded lectures and generated content</p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="pl-9 h-11"
          />
        </div>
        <Button variant="outline" size="lg" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Files</p>
                <p className="text-2xl font-bold mt-1">18</p>
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
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold mt-1">5</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold mt-1">47 MB</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold mt-1">1</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Files</CardTitle>
          <CardDescription>All your uploaded lectures and documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sampleFiles.map((file, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{file.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{file.uploadedDate}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{file.size}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{file.pages} pages</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`text-xs ${getStatusColor(file.status)}`}>
                    {file.status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Open
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {sampleFiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No files in your library yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Upload lectures from the Upload page to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  )
}
 
