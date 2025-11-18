import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Play, FileText, Trash2 } from 'lucide-react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContext'
import { useQuizzes, useDeleteQuiz } from '@/hooks/useQuiz'

export const Route = createFileRoute('/__protected/quizzes/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const { data: quizzes = [], isLoading } = useQuizzes(user?.id)
  const { mutateAsync: deleteQuiz } = useDeleteQuiz()

  const handleDeleteQuiz = async (quizId: string) => {
    if (!user) return
    
    if (confirm('Are you sure you want to delete this quiz?')) {
      try {
        await deleteQuiz({ quizId, userId: user.id })
        alert('Quiz deleted successfully!')
      } catch (error) {
        console.error('Error deleting quiz:', error)
        alert('Failed to delete quiz. Please try again.')
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

  return (
    <AppLayout>
    <div className="space-y-6 mt-5">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quizzes</h2>
          <p className="text-muted-foreground mt-1">Test your knowledge with interactive quizzes</p>
        </div>
      </div>

      {/* Quizzes Grid */}
      {quizzes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => {
            const questions = Array.isArray(quiz.questions) ? quiz.questions : []
            const questionCount = questions.length

            return (
              <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg">{quiz.title}</CardTitle>
                      {quiz.note && (
                        <CardDescription className="text-xs flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          From: {quiz.note.title}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {questionCount} questions
                      </Badge>
                      {quiz.score !== null && quiz.score !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          Best: {quiz.score}%
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(quiz.createdAt)}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        className="flex-1 gap-1.5" 
                        size="sm"
                        onClick={() => window.location.href = `/quizzes/${quiz.id}`}
                      >
                        <Play className="h-3.5 w-3.5" />
                        {quiz.score !== null && quiz.score !== undefined ? 'Retake' : 'Start'}
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="gap-1.5"
                        onClick={() => handleDeleteQuiz(quiz.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Brain className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No quizzes yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Generate a quiz from your study notes to start testing your knowledge
            </p>
            <Link to="/notes">
              <Button className="gap-2">
                <Brain className="h-4 w-4" />
                Go to Notes
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  )
}
 
