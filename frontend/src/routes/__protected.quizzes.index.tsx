import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain } from 'lucide-react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContextDefinition'
import { useQuizzes, useDeleteQuiz } from '@/hooks/useQuiz'
import { useState, useCallback, Suspense, lazy } from 'react'
import QuizSkeleton from '@/components/quizzes/QuizSkeleton'
import QuizCard from '@/components/quizzes/QuizCard'

// Lazy load dialogs
const DeleteQuizDialog = lazy(() => import('@/components/quizzes/DeleteQuizDialog'))
const StatusDialog = lazy(() => import('@/components/quizzes/StatusDialog'))

export const Route = createFileRoute('/__protected/quizzes/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const { data: quizzes = [], isLoading } = useQuizzes(user?.id)
  const { mutateAsync: deleteQuiz } = useDeleteQuiz()
  
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleDeleteQuiz = useCallback((quizId: string) => {
    if (!user) return
    setQuizToDelete(quizId)
    setShowDeleteModal(true)
  }, [user])

  const confirmDelete = useCallback(async () => {
    if (!user || !quizToDelete) return
    
    setShowDeleteModal(false)
    
    try {
      await deleteQuiz({ quizId: quizToDelete, userId: user.id })
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error deleting quiz:', error)
      setErrorMessage('Failed to delete quiz. Please try again.')
      setShowErrorModal(true)
    } finally {
      setQuizToDelete(null)
    }
  }, [user, quizToDelete, deleteQuiz])

  if (isLoading) {
    return (
      <AppLayout>
        <QuizSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6 mt-5 mt-15">
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
            {quizzes.map((quiz) => (
              <QuizCard 
                key={quiz.id} 
                quiz={quiz} 
                onDelete={handleDeleteQuiz} 
              />
            ))}
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
                <Button className="gap-2 shadow-sm hover:shadow-md transition-all">
                  <Brain className="h-4 w-4" />
                  Go to Notes
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Dialogs */}
        <Suspense fallback={null}>
          <DeleteQuizDialog 
            open={showDeleteModal} 
            onOpenChange={setShowDeleteModal} 
            onConfirm={confirmDelete} 
          />
          
          <StatusDialog
            open={showSuccessModal}
            onOpenChange={setShowSuccessModal}
            type="success"
            title="Quiz Deleted Successfully!"
            description="The quiz has been permanently removed from your account."
          />

          <StatusDialog
            open={showErrorModal}
            onOpenChange={setShowErrorModal}
            type="error"
            title="Error"
            description={errorMessage}
          />
        </Suspense>
      </div>
    </AppLayout>
  )
}
