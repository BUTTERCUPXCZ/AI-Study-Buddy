import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Star, Calendar, Brain, CheckCircle } from 'lucide-react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContextDefinition'
import { useNote } from '@/hooks/useNotes'
import { useGenerateQuizFromNote } from '@/hooks/useQuiz'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { downloadNotePdf } from '@/lib/pdfUtils'
import NotesService from '@/services/NotesService'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
    } catch (error: unknown) {
      console.error('Error generating quiz:', error)
      const message = (error as { message?: string }).message || 'Failed to generate quiz. Please try again.'
      alert(message)
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
          <LoadingSpinner className="h-12 w-12" />
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

  return (
    <AppLayout>
    <div className="max-w-4xl mx-auto py-4 mt-10">
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
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(note.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content - ChatGPT Style */}
      <div className="bg-background rounded-lg mb-6">
        <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4 prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-p:text-base prose-p:leading-7 prose-p:mb-4 prose-li:my-1 prose-ul:my-4 prose-ol:my-4 prose-strong:font-semibold prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({...props}) => <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0" {...props} />,
              h2: ({...props}) => <h2 className="text-2xl font-bold mt-8 mb-4 first:mt-0" {...props} />,
              h3: ({...props}) => <h3 className="text-xl font-bold mt-6 mb-3 first:mt-0" {...props} />,
              h4: ({...props}) => <h4 className="text-lg font-semibold mt-5 mb-2 first:mt-0" {...props} />,
              p: ({...props}) => <p className="text-base leading-7 mb-4" {...props} />,
              ul: ({...props}) => <ul className="list-disc list-outside ml-6 my-4 space-y-2" {...props} />,
              ol: ({...props}) => <ol className="list-decimal list-outside ml-6 my-4 space-y-2" {...props} />,
              li: ({...props}) => <li className="text-base leading-7" {...props} />,
              strong: ({...props}) => <strong className="font-semibold" {...props} />,
              em: ({...props}) => <em className="italic" {...props} />,
              code: ({className, ...props}) => {
                const isInline = !className?.includes('language-')
                return isInline 
                  ? <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                  : <code className={className} {...props} />
              },
              pre: ({...props}) => <pre className="bg-muted border rounded-lg p-4 overflow-x-auto my-4" {...props} />,
              blockquote: ({...props}) => <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic my-4" {...props} />,
              a: ({...props}) => <a className="text-primary underline hover:text-primary/80 transition-colors" {...props} />,
              hr: ({...props}) => <hr className="my-8 border-border" {...props} />,
              table: ({...props}) => (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full divide-y divide-border" {...props} />
                </div>
              ),
              thead: ({...props}) => <thead className="bg-muted" {...props} />,
              tbody: ({...props}) => <tbody className="divide-y divide-border" {...props} />,
              tr: ({...props}) => <tr {...props} />,
              th: ({...props}) => <th className="px-4 py-2 text-left text-sm font-semibold" {...props} />,
              td: ({...props}) => <td className="px-4 py-2 text-sm" {...props} />,
            }}
          >
            {note.content}
          </ReactMarkdown>
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
              <LoadingSpinner className="h-5 w-5 text-current" />
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
