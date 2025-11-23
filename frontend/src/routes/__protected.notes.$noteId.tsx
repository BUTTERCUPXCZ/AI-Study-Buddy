import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Star, Calendar, Brain, Loader2, CheckCircle } from 'lucide-react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContext'
import { useNote } from '@/hooks/useNotes'
import { useGenerateQuizFromNote } from '@/hooks/useQuiz'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { downloadNotePdf } from '@/lib/pdfUtils'
import NotesService from '@/services/NotesService'

export const Route = createFileRoute('/__protected/notes/$noteId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { noteId } = Route.useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: note, isLoading, isError } = useNote(noteId, user?.id || '')
  const { mutateAsync: generateQuiz, isPending: isGeneratingQuiz } = useGenerateQuizFromNote()
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [generatedQuizId, setGeneratedQuizId] = useState<string | null>(null)

  // Prefetch notes list when viewing a single note for faster back navigation
  useEffect(() => {
    if (user?.id) {
      queryClient.prefetchQuery({
        queryKey: ['notes', user.id],
        queryFn: () => NotesService.getUserNotes(user.id),
        staleTime: 1000 * 60 * 5, // 5 minutes
      })
    }
  }, [user?.id, queryClient])

  const handleGenerateQuiz = async () => {
    if (!note || !user) {
      alert('Unable to generate quiz. Please try again.')
      return
    }

    try {
      const result = await generateQuiz({
        noteId: note.id,
        userId: user.id,
        noteTitle: note.title,
        noteContent: note.content,
      })

      if (result.success && result.quizId) {
        setGeneratedQuizId(result.quizId)
        setShowSuccessModal(true)
        
        // Invalidate quizzes query to show the new quiz
        queryClient.invalidateQueries({ queryKey: ['quizzes', user.id] })
      } else {
        alert(result.error || 'Failed to generate quiz. Please try again.')
      }
    } catch (error: any) {
      console.error('Error generating quiz:', error)
      alert(error.message || 'Failed to generate quiz. Please try again.')
    }
  }

  const handleNavigateToQuiz = () => {
    if (generatedQuizId) {
      navigate({ to: `/quizzes/${generatedQuizId}` })
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

  if (isError || !note) {
    return (
      <AppLayout>
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-2xl font-bold mb-2">Note not found</h2>
        <p className="text-muted-foreground mb-4">The note you are looking for does not exist.</p>
        <Link to="/notes">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Notes
          </Button>
        </Link>
      </div>
      </AppLayout>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Process content to handle markdown-like formatting
  const formatContent = (content: string) => {
    return content
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      // Bullet points
      .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br/>')
  }

  return (
    <AppLayout>
    <div className="max-w-4xl mx-auto py-4">
      {/* Compact Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/notes">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Notes
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Star className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => downloadNotePdf(note.title, note.content)}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Title and Metadata */}
        <div>
          <h1 className="text-3xl font-bold mb-2 leading-tight">{note.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="secondary" className="text-xs font-medium">
              {note.source ? 'PDF Generated' : 'Manual'}
            </Badge>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(note.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content - ChatGPT Style */}
      <div className="bg-background rounded-lg mb-6">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <div 
            className="text-base leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ 
              __html: `<p class="mb-4">${formatContent(note.content)}</p>` 
            }}
            style={{
              fontSize: '16px',
              lineHeight: '1.75',
              color: 'inherit'
            }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="sticky bottom-6 flex gap-3 bg-background/80 backdrop-blur-sm p-4 rounded-lg border">
        <Button 
          className="flex-1 h-12 text-base font-semibold gap-2"
          size="lg"
          onClick={handleGenerateQuiz}
          disabled={isGeneratingQuiz}
        >
          {isGeneratingQuiz ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Quiz...
            </>
          ) : (
            <>
              <Brain className="h-5 w-5" />
              Generate Quiz from This Note
            </>
          )}
        </Button>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Quiz Generated Successfully!
            </DialogTitle>
            <DialogDescription>
              Your quiz has been created from this note. You can now start taking the quiz or view it later from the Quizzes page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuccessModal(false)}>
              Stay Here
            </Button>
            <Button onClick={handleNavigateToQuiz}>
              Go to Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  )
}
