import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Play, Eye, MoreVertical, Plus } from 'lucide-react'
import AppLayout from '@/components/app-layout'

export const Route = createFileRoute('/__protected/quizzes')({
  component: RouteComponent,
})

function RouteComponent() {
  const sampleQuizzes = [
    { 
      title: 'Algorithms Fundamentals', 
      questions: 15, 
      difficulty: 'Medium', 
      bestScore: 87,
      attempts: 3,
      topic: 'Computer Science'
    },
    { 
      title: 'Data Structures Quiz', 
      questions: 10, 
      difficulty: 'Easy', 
      bestScore: 92,
      attempts: 2,
      topic: 'Computer Science'
    },
    { 
      title: 'OS Concepts Challenge', 
      questions: 20, 
      difficulty: 'Hard', 
      bestScore: 78,
      attempts: 5,
      topic: 'Operating Systems'
    },
  ]

  const getDifficultyColor = (difficulty: string) => {
    switch(difficulty) {
      case 'Easy': return 'bg-green-500/10 text-green-700 dark:text-green-400'
      case 'Medium': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
      case 'Hard': return 'bg-red-500/10 text-red-700 dark:text-red-400'
      default: return 'bg-secondary text-secondary-foreground'
    }
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
        <Button size="lg" className="gap-2">
          <Plus className="h-4 w-4" />
          Create Quiz
        </Button>
      </div>


      {/* Quizzes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sampleQuizzes.map((quiz, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg">{quiz.title}</CardTitle>
                  <CardDescription className="text-xs">{quiz.topic}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {quiz.questions} questions
                  </Badge>
                  <Badge className={`text-xs ${getDifficultyColor(quiz.difficulty)}`}>
                    {quiz.difficulty}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Best Score</span>
                    <span className="font-semibold">{quiz.bestScore}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Attempts</span>
                    <span className="font-semibold">{quiz.attempts}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 gap-1.5" size="sm">
                    <Play className="h-3.5 w-3.5" />
                    Start
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {sampleQuizzes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Brain className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No quizzes yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Generate a quiz from a lecture or create one manually to start testing your knowledge
            </p>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Quiz
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </AppLayout>
  )
}
 
