import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, FileText, Trash2 } from 'lucide-react'

interface QuizCardProps {
  quiz: {
    id: string
    title: string
    createdAt: string
    score?: number | null
    questions?: unknown[]
    note?: {
      title: string
    }
  }
  onDelete: (id: string) => void
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const QuizCard = memo(({ quiz, onDelete }: QuizCardProps) => {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : []
  const questionCount = questions.length

  return (
    <Card className="hover:shadow-lg transition-all duration-300 will-change-transform h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
            {quiz.note && (
              <CardDescription className="text-xs flex items-center gap-1">
                <FileText className="h-3 w-3" />
                From: {quiz.note.title}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end">
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
              className="flex-1 gap-1.5 shadow-sm hover:shadow-md transition-all" 
              size="sm"
              onClick={() => window.location.href = `/quizzes/${quiz.id}`}
            >
              <Play className="h-3.5 w-3.5" />
              {quiz.score !== null && quiz.score !== undefined ? 'Retake' : 'Start'}
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="gap-1.5 shadow-sm hover:shadow-md transition-all"
              onClick={() => onDelete(quiz.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export default QuizCard
