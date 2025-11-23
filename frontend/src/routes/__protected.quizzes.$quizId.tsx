import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle2, XCircle, Award, RotateCcw } from 'lucide-react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContextDefinition'
import { useQuiz, useUpdateQuizScore } from '@/hooks/useQuiz'
import { useState } from 'react'
import type { QuizQuestion } from '@/services/QuizService'

export const Route = createFileRoute('/__protected/quizzes/$quizId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { quizId } = Route.useParams()
  const { user } = useAuth()
  const { data: quiz, isLoading, isError } = useQuiz(quizId, user?.id || '')
  const { mutateAsync: updateScore } = useUpdateQuizScore()
  
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    )
  }

  if (isError || !quiz) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="text-2xl font-bold mb-2">Quiz not found</h2>
          <p className="text-muted-foreground mb-4">The quiz you are looking for does not exist.</p>
          <Link to="/quizzes">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Quizzes
            </Button>
          </Link>
        </div>
      </AppLayout>
    )
  }

  const questions = quiz.questions as QuizQuestion[]
  
  const handleAnswerChange = (questionIndex: number, answer: string) => {
    if (showResults || showFeedback) return
    
    // Save the answer
    const newAnswers = {
      ...userAnswers,
      [questionIndex]: answer,
    }
    setUserAnswers(newAnswers)
    
    // Show feedback immediately
    setShowFeedback(true)
    
    // After 2 seconds, move to next question or submit
    setTimeout(() => {
      setShowFeedback(false)
      
      if (questionIndex < questions.length - 1) {
        // Move to next question
        setCurrentQuestionIndex(questionIndex + 1)
      } else {
        // All questions answered, auto-submit
        handleAutoSubmit(newAnswers)
      }
    }, 2000)
  }
  
  const handleAutoSubmit = async (finalAnswers = userAnswers) => {
    setIsSubmitting(true)
    
    let correctCount = 0
    questions.forEach((question, index) => {
      if (finalAnswers[index] === question.correctAnswer) {
        correctCount++
      }
    })
    
    const scorePercentage = Math.round((correctCount / questions.length) * 100)
    
    try {
      await updateScore({
        quizId: quiz.id,
        userId: user!.id,
        score: scorePercentage,
      })
      
      setShowResults(true)
      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Error saving score:', error)
      alert('Failed to save score. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRetake = () => {
    setUserAnswers({})
    setShowResults(false)
    setCurrentQuestionIndex(0)
    setShowFeedback(false)
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getScore = () => {
    let correctCount = 0
    questions.forEach((question, index) => {
      if (userAnswers[index] === question.correctAnswer) {
        correctCount++
      }
    })
    return {
      correct: correctCount,
      total: questions.length,
      percentage: Math.round((correctCount / questions.length) * 100),
    }
  }

  const score = showResults ? getScore() : null

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-4">
        <div className="mb-6 space-y-4">
          <Link to="/quizzes">
            <Button variant="ghost" size="sm" className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Quizzes
            </Button>
          </Link>

          <div>
            <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary" className="text-xs font-medium">
                {questions.length} Questions
              </Badge>
              {quiz.note && (
                <Badge variant="outline" className="text-xs font-medium hover:bg-secondary cursor-pointer">
                  From: {quiz.note.title}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {showResults && score && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-6 w-6 text-primary" />
                Quiz Completed!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-primary">{score.percentage}%</p>
                    <p className="text-sm text-muted-foreground">
                      {score.correct} out of {score.total} correct
                    </p>
                  </div>
                  <Button onClick={handleRetake} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Retake Quiz
                  </Button>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: score.percentage + '%' }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6 mb-6">
          {!showResults ? (
            // Show only current question during quiz
            (() => {
              const question = questions[currentQuestionIndex]
              const index = currentQuestionIndex
              const userAnswer = userAnswers[index]
              const isCorrect = userAnswer === question.correctAnswer
              const hasAnswered = userAnswer !== undefined
              const showQuestionFeedback = hasAnswered && showFeedback

              return (
                <Card 
                  key={index} 
                  className={`transition-all duration-500 animate-in fade-in slide-in-from-right-5 ${
                    showQuestionFeedback && userAnswer 
                      ? (isCorrect ? 'border-green-500' : 'border-red-500') 
                      : 'border-primary shadow-lg'
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-start gap-3">
                      <span className="text-primary font-bold shrink-0">Q{index + 1}.</span>
                      <span>{question.question}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={userAnswer || ''}
                      onValueChange={(value: string) => handleAnswerChange(index, value)}
                      disabled={hasAnswered}
                    >
                      {Object.entries(question.options).map(([letter, text]) => {
                        const isThisCorrect = letter === question.correctAnswer
                        const isThisSelected = letter === userAnswer
                        
                        let optionClass = ''
                        if (showQuestionFeedback) {
                          if (isThisCorrect) {
                            optionClass = 'border-green-500 bg-green-50 dark:bg-green-950 transition-all duration-500'
                          } else if (isThisSelected && !isThisCorrect) {
                            optionClass = 'border-red-500 bg-red-50 dark:bg-red-950 transition-all duration-500'
                          }
                        }

                        const divClass = 'flex items-start space-x-3 p-4 rounded-lg border ' + optionClass
                        const radioId = 'q' + index + '-' + letter

                        return (
                          <div key={letter} className={divClass}>
                            <RadioGroupItem value={letter} id={radioId} />
                            <Label 
                              htmlFor={radioId} 
                              className="flex-1 cursor-pointer text-base leading-relaxed"
                            >
                              <span className="font-semibold mr-2">{letter}.</span>
                              {text}
                            </Label>
                            {showQuestionFeedback && isThisCorrect && (
                              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 animate-in fade-in zoom-in duration-500" />
                            )}
                            {showQuestionFeedback && isThisSelected && !isThisCorrect && (
                              <XCircle className="h-5 w-5 text-red-600 shrink-0 animate-in fade-in zoom-in duration-500" />
                            )}
                          </div>
                        )
                      })}
                    </RadioGroup>

                    {showQuestionFeedback && userAnswer && (
                      <div className={`animate-in slide-in-from-top-2 duration-500 ${isCorrect ? 'p-4 rounded-lg bg-green-50 dark:bg-green-950' : 'p-4 rounded-lg bg-blue-50 dark:bg-blue-950'}`}>
                        <p className="font-semibold mb-1">
                          {isCorrect ? '✓ Correct!' : 'ℹ Explanation:'}
                        </p>
                        <p className="text-sm">{question.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })()
          ) : (
            // Show all questions with answers in results view
            questions.map((question, index) => {
              const userAnswer = userAnswers[index]
              const isCorrect = userAnswer === question.correctAnswer

              return (
                <Card 
                  key={index} 
                  className={`transition-all duration-300 ${
                    userAnswer 
                      ? (isCorrect ? 'border-green-500' : 'border-red-500') 
                      : 'opacity-60'
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-start gap-3">
                      <span className="text-primary font-bold shrink-0">Q{index + 1}.</span>
                      <span>{question.question}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={userAnswer || ''}
                      disabled={true}
                    >
                      {Object.entries(question.options).map(([letter, text]) => {
                        const isThisCorrect = letter === question.correctAnswer
                        const isThisSelected = letter === userAnswer
                        
                        let optionClass = ''
                        if (isThisCorrect) {
                          optionClass = 'border-green-500 bg-green-50 dark:bg-green-950'
                        } else if (isThisSelected && !isThisCorrect) {
                          optionClass = 'border-red-500 bg-red-50 dark:bg-red-950'
                        }

                        const divClass = 'flex items-start space-x-3 p-4 rounded-lg border ' + optionClass
                        const radioId = 'q' + index + '-' + letter

                        return (
                          <div key={letter} className={divClass}>
                            <RadioGroupItem value={letter} id={radioId} />
                            <Label 
                              htmlFor={radioId} 
                              className="flex-1 cursor-pointer text-base leading-relaxed"
                            >
                              <span className="font-semibold mr-2">{letter}.</span>
                              {text}
                            </Label>
                            {isThisCorrect && (
                              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                            )}
                            {isThisSelected && !isThisCorrect && (
                              <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                            )}
                          </div>
                        )
                      })}
                    </RadioGroup>

                    {userAnswer && (
                      <div className={isCorrect ? 'p-4 rounded-lg bg-green-50 dark:bg-green-950' : 'p-4 rounded-lg bg-blue-50 dark:bg-blue-950'}>
                        <p className="font-semibold mb-1">
                          {isCorrect ? '✓ Correct!' : 'ℹ Explanation:'}
                        </p>
                        <p className="text-sm">{question.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {!showResults && (
          <div className="sticky bottom-6 bg-background/80 backdrop-blur-sm p-4 rounded-lg border">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                <span>{Object.keys(userAnswers).length} answered</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              {isSubmitting && (
                <p className="text-sm text-center text-primary font-medium">
                  Submitting quiz...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
